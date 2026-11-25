"""Folder migration guard rails: `nx run stardew_valley_helper.stardew_valley_db:migrate-<snapshot|validate|cleanup>`.

The production migration is backup -> deploy -> import (write only) -> validate -> cleanup --apply.

- `snapshot --out FILE` stores the number of player records per kind, before the import.
- `validate --user-snapshot FILE` is read-only and exits 1 when the table does not match `data/`.
- `cleanup` lists the game records `data/` no longer produces; only `--apply --user-snapshot FILE`
  deletes them, after `validate` passes in the same run, and it never touches player records.
"""

import argparse
import json
from collections import Counter
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from aws_lambda_powertools import Logger
from boto3.dynamodb.types import TypeDeserializer

from ..entities import BaseModel
from .cli import DEFAULT_DATA_DIR, convert
from .legacy import LEGACY_FOLDERS
from .load import ImportValidationError

logger = Logger(service="stardew-valley-migrate")

USER_PREFIX = "PLAYER#"
LEGACY_TYPES: frozenset[str] = frozenset(
    f"TYPE#{old}" for old in LEGACY_FOLDERS if old not in set(LEGACY_FOLDERS.values())
)

Key = tuple[str, str]
RawItem = dict[str, dict[str, Any]]

_deserializer = TypeDeserializer()


def is_user_key(pk: str) -> bool:
    return pk.startswith(USER_PREFIX)


def load_models(data_dir: Path) -> list[BaseModel]:
    """The records the import writes for `data_dir` (raises ImportValidationError on an invalid file)."""
    result, _ = convert(data_dir)
    return result.models


def _scan_raw() -> Iterator[RawItem]:
    """Every stored item as raw DynamoDB JSON (strongly consistent, all pages)."""
    connection = BaseModel._get_connection()
    start_key = None
    while True:
        page = connection.scan(exclusive_start_key=start_key, consistent_read=True)
        yield from page.get("Items", [])
        start_key = page.get("LastEvaluatedKey")
        if not start_key:
            return


def _key(item: RawItem) -> Key:
    return item["pk"]["S"], item["sk"]["S"]


def _plain(item: RawItem) -> dict[str, Any]:
    # Numbers become Decimal, so 1 and 1.0 compare equal whatever DynamoDB normalised them to.
    return {name: _deserializer.deserialize(value) for name, value in item.items()}


def same_content(expected: RawItem, stored: RawItem) -> bool:
    return _plain(expected) == _plain(stored)


def _produced(models: list[BaseModel]) -> dict[Key, RawItem]:
    """Serialized records by key; a later model with the same key wins, as in the import's batch write."""
    return {(model.pk, model.sk): model.serialize() for model in models}


def user_counts() -> dict[str, int]:
    counts = Counter(_key(item)[1].split("#")[0] for item in _scan_raw() if is_user_key(_key(item)[0]))
    return dict(sorted(counts.items()))


def validate(models: list[BaseModel], expected_user_counts: dict[str, int]) -> list[str]:
    """Compare the table with the records `models` produce. Returns readable problems; empty means valid."""
    produced = _produced(models)
    if not produced:
        return ["the dataset produced no records; check --data-dir"]

    stored: dict[Key, RawItem] = {}
    stored_type_counts: Counter[str] = Counter()
    actual_user_counts: Counter[str] = Counter()
    for item in _scan_raw():
        pk, sk = _key(item)
        if is_user_key(pk):
            actual_user_counts[sk.split("#")[0]] += 1
            continue
        stored[(pk, sk)] = item
        if "gsi1pk" in item:
            stored_type_counts[item["gsi1pk"]["S"]] += 1

    problems: list[str] = []
    for (pk, sk), expected in sorted(produced.items()):
        item = stored.get((pk, sk))
        if item is None:
            problems.append(f"missing record {pk} / {sk}")
            continue
        old_type = item.get("gsi1pk", {}).get("S")
        if old_type in LEGACY_TYPES:
            problems.append(f"record {pk} / {sk} still has the old type {old_type}")
        if not same_content(expected, item):
            problems.append(f"record {pk} / {sk} differs from data/")

    expected_type_counts = Counter(item["gsi1pk"]["S"] for item in produced.values() if "gsi1pk" in item)
    for type_key, expected_count in sorted(expected_type_counts.items()):
        if stored_type_counts[type_key] != expected_count:
            problems.append(f"{type_key}: {stored_type_counts[type_key]} stored records, data/ has {expected_count}")

    if dict(actual_user_counts) != {kind: count for kind, count in expected_user_counts.items() if count}:
        problems.append(
            f"player record counts changed: snapshot {dict(sorted(expected_user_counts.items()))}, "
            f"now {dict(sorted(actual_user_counts.items()))}"
        )
    return problems


def find_orphans(models: list[BaseModel]) -> list[Key]:
    """Stored game records whose key `models` no longer produce, sorted.

    Only keys whose prefix the dataset produces (ITEM#, PERFECTION#, META#...) are considered, so a
    record of an unknown kind is never listed; player keys never are.
    """
    produced = set(_produced(models))
    game_prefixes = {pk.split("#")[0] for pk, _ in produced}
    orphans = [
        key
        for key in (_key(item) for item in _scan_raw())
        if key not in produced and not is_user_key(key[0]) and key[0].split("#")[0] in game_prefixes
    ]
    return sorted(orphans)


def delete_orphans(keys: list[Key]) -> int:
    """Delete `keys` in one batch. Refuses, deleting nothing, if any of them is a player key."""
    user_keys = sum(1 for pk, _ in keys if is_user_key(pk))
    if user_keys:
        raise ValueError(f"refusing to delete: {user_keys} player key(s) in the list, nothing deleted")
    with BaseModel.batch_write() as batch:
        for pk, sk in keys:
            logger.info("Orphan deletion requested", extra={"pk": pk, "sk": sk})
            batch.delete(BaseModel(pk, sk))
    logger.info("Orphan batch delete completed", extra={"requested": len(keys)})
    return len(keys)


def _snapshot(args: argparse.Namespace) -> int:
    counts = user_counts()
    args.out.write_text(json.dumps(counts, indent=2, sort_keys=True) + "\n")
    logger.info("User record snapshot written", extra={"path": str(args.out), "counts": counts})
    return 0


def _validate(args: argparse.Namespace) -> int:
    expected = json.loads(args.user_snapshot.read_text())
    problems = validate(load_models(args.data_dir), expected)
    for problem in problems:
        logger.error("Validation problem", extra={"problem": problem})
    if problems:
        logger.error("Validation failed", extra={"problems": len(problems)})
        return 1
    logger.info("Validation passed")
    return 0


def _cleanup(args: argparse.Namespace) -> int:
    models = load_models(args.data_dir)
    orphans = find_orphans(models)
    for pk, sk in orphans:
        logger.info("Orphan found", extra={"pk": pk, "sk": sk})
    if not args.apply:
        logger.info("Dry run, nothing deleted", extra={"orphans": len(orphans)})
        return 0
    if args.user_snapshot is None:
        logger.error("--apply requires --user-snapshot, nothing deleted")
        return 1
    # Migrate, validate, then delete: --apply only deletes when validation passes right now.
    problems = validate(models, json.loads(args.user_snapshot.read_text()))
    for problem in problems:
        logger.error("Validation problem", extra={"problem": problem})
    if problems:
        logger.error("Validation failed, nothing deleted", extra={"problems": len(problems)})
        return 1
    deleted = delete_orphans(orphans)
    logger.info("Cleanup finished", extra={"deleted": deleted})
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Guard rails for the game data folder migration.")
    commands = parser.add_subparsers(dest="command", required=True)

    snapshot = commands.add_parser("snapshot", help="write the player record counts per kind as JSON")
    snapshot.add_argument("--out", type=Path, required=True)
    snapshot.set_defaults(run=_snapshot)

    check = commands.add_parser("validate", help="read-only comparison of the table with data/")
    check.add_argument("--user-snapshot", type=Path, required=True)
    check.set_defaults(run=_validate)

    cleanup = commands.add_parser("cleanup", help="list (and with --apply delete) orphan game records")
    cleanup.add_argument("--apply", action="store_true", help="delete the listed orphans (validates first)")
    cleanup.add_argument("--user-snapshot", type=Path, help="required with --apply")
    cleanup.set_defaults(run=_cleanup)

    for command in (snapshot, check, cleanup):
        command.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args(argv)

    try:
        return args.run(args)
    except ImportValidationError as error:
        logger.error("Invalid dataset file", extra={"path": str(error.path), "reason": error.reason})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
