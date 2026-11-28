"""Aggregate a runtime-config namespace and publish it to AppConfig only when it changed.

Local divergence from the @aws/nx-plugin template: the template creates a new hosted
configuration version and a deployment for every namespace on every apply, even when
the content is identical. Each deployment makes every warm Lambda download the
configuration again, and AppConfig bills per configuration received.

Inputs (environment): NAMESPACE, ENTRIES_DIR, CONFIG_DIR, APPLICATION_ID,
ENVIRONMENT_ID, CONFIGURATION_PROFILE_ID, DEPLOYMENT_STRATEGY_ID, AWS_REGION.
"""

import json
import os
import pathlib
import sys

import boto3


def log(level: str, message: str, **fields) -> None:
    stream = sys.stderr if level != "INFO" else sys.stdout
    print(json.dumps({"level": level, "message": message, **fields}), file=stream)


def deep_merge(target: dict, source: dict) -> dict:
    for k, v in source.items():
        if k in target and isinstance(target[k], dict) and isinstance(v, dict):
            deep_merge(target[k], v)
        else:
            target[k] = v
    return target


def aggregate(entries_dir: pathlib.Path) -> dict:
    # Each entry file is named '<key>-<sha>.json': callers that share the same
    # (namespace, key) pair hash their value into a distinct sha suffix, and their
    # contributions are deep-merged back together under 'key' here.
    merged: dict = {}
    if entries_dir.is_dir():
        for entry_path in sorted(entries_dir.glob("*.json")):
            section = entry_path.stem.rsplit("-", 1)[0]
            try:
                contribution = json.loads(entry_path.read_text())
            except json.JSONDecodeError as e:
                log(
                    "WARNING",
                    "Skipping malformed entry",
                    entry=str(entry_path),
                    error=str(e),
                )
                continue
            existing = merged.get(section)
            if isinstance(existing, dict) and isinstance(contribution, dict):
                deep_merge(existing, contribution)
            else:
                merged[section] = contribution
    return merged


def deployed_content(client, app_id: str, env_id: str, profile_id: str) -> dict | None:
    """Content of the latest completed deployment of this profile, or None."""
    profile_name = client.get_configuration_profile(
        ApplicationId=app_id, ConfigurationProfileId=profile_id
    )["Name"]
    pages = client.get_paginator("list_deployments").paginate(
        ApplicationId=app_id, EnvironmentId=env_id
    )
    deployments = [
        d
        for page in pages
        for d in page["Items"]
        if d["ConfigurationName"] == profile_name and d["State"] == "COMPLETE"
    ]
    if not deployments:
        return None
    latest = max(deployments, key=lambda d: d["DeploymentNumber"])
    version = client.get_hosted_configuration_version(
        ApplicationId=app_id,
        ConfigurationProfileId=profile_id,
        VersionNumber=int(latest["ConfigurationVersion"]),
    )
    return json.loads(version["Content"].read())


def main() -> None:
    env = os.environ
    namespace = env["NAMESPACE"]
    app_id = env["APPLICATION_ID"]
    env_id = env["ENVIRONMENT_ID"]
    profile_id = env["CONFIGURATION_PROFILE_ID"]

    merged = aggregate(pathlib.Path(env["ENTRIES_DIR"]) / namespace)
    content = json.dumps(merged, indent=2)

    output_file = pathlib.Path(env["CONFIG_DIR"]) / f"{namespace}.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(content)
    log("INFO", "Aggregated namespace", namespace=namespace, sections=len(merged))

    client = boto3.client("appconfig", region_name=env["AWS_REGION"])
    if deployed_content(client, app_id, env_id, profile_id) == merged:
        log("INFO", "Unchanged, skipping AppConfig deployment", namespace=namespace)
        return

    version = client.create_hosted_configuration_version(
        ApplicationId=app_id,
        ConfigurationProfileId=profile_id,
        Content=content.encode(),
        ContentType="application/json",
    )["VersionNumber"]
    deployment = client.start_deployment(
        ApplicationId=app_id,
        EnvironmentId=env_id,
        ConfigurationProfileId=profile_id,
        ConfigurationVersion=str(version),
        DeploymentStrategyId=env["DEPLOYMENT_STRATEGY_ID"],
    )["DeploymentNumber"]
    log(
        "INFO",
        "Deployed to AppConfig",
        namespace=namespace,
        hostedVersion=version,
        deploymentNumber=deployment,
    )


if __name__ == "__main__":
    main()
