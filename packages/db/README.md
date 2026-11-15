# stardew_valley_helper.stardew_valley_db

Project description here.

## Local development

`config.json` keeps the `localDev` table and container names from `aws-danhenrique`
(`aws-danhenrique-stardew-valley-db`, `aws-danhenrique-dynamodb`) so an existing DynamoDB Local
volume (`aws-danhenrique-dynamodb-data`) keeps its data.

## Importing the game data

The dataset in `packages/db/data` is imported **once**; afterwards DynamoDB is the only source the
application reads. It is generated from the community scheduler (git-ignored in
`.tmp/stardew-valley-scheduler`) with:

```bash
python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data
```

The script lives outside `data/` on purpose: it wipes everything in the output directory except
`README.md`.

```bash
# Validate and convert only (no writes)
pnpm nx run stardew_valley_helper.stardew_valley_db:import --dry-run

# Write to the deployed table (prod). The table name is resolved from AWS AppConfig.
RUNTIME_CONFIG_APP_ID=$(cd packages/infra/src && terraform output -raw runtime_config_app_id) \
  AWS_REGION=sa-east-1 pnpm nx run stardew_valley_helper.stardew_valley_db:import
```

All files are validated before the first write: if any file is invalid the command exits with code 1
and writes nothing. Keys are deterministic, so re-running overwrites instead of duplicating.
