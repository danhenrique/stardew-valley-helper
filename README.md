# Stardew Valley Helper

Helper website for Stardew Valley players. Players register planted seeds and saplings and get the
first harvest, regrowth harvests and season-end death computed for the current in-game date. The
whole game dataset lives in a single DynamoDB table, imported once from `packages/db/data`.

This repository was split out of `aws-danhenrique` on 2026-11-15. The production resources were kept
as they were: the Terraform state moved to a new key, and nothing was recreated. Design and plan:
`docs/superpowers/specs/2026-11-15-migrate-from-aws-danhenrique-design.md` and
`docs/superpowers/plans/2026-11-15-migrate-from-aws-danhenrique.md`. Earlier Stardew designs are in
`docs/superpowers/` too.

## Projects

Every project was created with `@aws/nx-plugin`.

| Path | Nx project | Python module / package | Purpose |
|---|---|---|---|
| `packages/db/` | `stardew_valley_helper.stardew_valley_db` | `stardew_valley_db` | PynamoDB entities, one-shot import, game dataset (`data/`) |
| `packages/api/` | `stardew_valley_helper.stardew_valley_api` | `stardew_valley_api` | FastAPI (REST API + Lambda, IAM auth) |
| `packages/website/` | `@stardew-valley-helper/website` | — | React website (dev port 4201, preview 4301) |
| `packages/infra/` | `@stardew-valley-helper/infra` | — | Terraform, prod only |
| `packages/common/terraform/` | `@stardew-valley-helper/terraform` | — | Terraform modules used by `infra` |
| `packages/common/scripts/` | `@stardew-valley-helper/scripts` | — | DynamoDB Local scripts used by `db:dev` |

The website's API client hook is `useStardewValleyApi`. The API Terraform module lives in
`packages/common/terraform/src/app/apis/stardew-valley-api`.

## Deploy (prod)

Only `prod` exists. The site is served at `https://stardew.danhenrique.com.br`.

### State and bootstrap

The state is in the bootstrap bucket `<account>-tf-state-sa-east-1`, under its own key:
`stardew-valley-helper-infra/prod/terraform.tfstate`.

`aws-danhenrique` uses the same bucket for its own state, because the bucket name only depends on the
account and region. **Never run `bootstrap-destroy` here**: it would delete the bucket that holds the
`aws-danhenrique` state too.

After the cutover, the old key (`aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate`) stays
in place for rollback, with a permanent `.tflock` object next to it so any plan or apply from the old
repository fails.

### DNS

| Repository | Owns |
|---|---|
| `aws-danhenrique` | The `danhenrique.com.br` hosted zone and the main domain records |
| `stardew-valley-helper` (this one) | `stardew.danhenrique.com.br` (A/AAAA → CloudFront), `auth.stardew.danhenrique.com.br` (Cognito managed login) and the ACM validation of `stardew.*` / `*.stardew.*` |

This repository only reads the zone (`data "aws_route53_zone"`) and never changes it.

### Frozen physical names

Some AWS names still carry the old repository's name, because renaming them would replace live
resources. They are marked `# Frozen` in the Terraform modules, and `packages/infra/src/tests`
guards the most important ones:

- the table `aws-danhenrique-stardew-valley-db-<suffix>`: player data, deletion protection on
- the Cognito domain prefix `danhenrique-stardew-valley-helper-website`
- the website name `stardew-helper`

### AWS credentials

Nx loads `.env.local` (git-ignored) from the repository root. Create it once with the AWS profile to
deploy with; without it, `plan`/`apply` fail with `CredentialsProviderError: Could not load
credentials from any providers`:

```bash
echo 'AWS_PROFILE=danhenrique-prod' > .env.local
aws sso login --profile danhenrique-prod   # when the SSO session has expired
```

### Steps

`apply` re-runs `plan` and applies it without asking. Review the plan first. It runs with
`-parallelism=1` because AppConfig accepts one deployment at a time per environment; parallel
deployments fail with `BadRequestException: Internal error`.

1. Plan and review:
   ```bash
   pnpm nx run @stardew-valley-helper/infra:plan
   ```
2. Apply the reviewed plan:
   ```bash
   pnpm nx run @stardew-valley-helper/infra:apply
   ```
3. Import the game data (only for a fresh table; see `packages/db/README.md`):
   ```bash
   RUNTIME_CONFIG_APP_ID=$(cd packages/infra/src && terraform output -raw runtime_config_app_id) \
     AWS_REGION=sa-east-1 pnpm nx run stardew_valley_helper.stardew_valley_db:import
   ```

### Cost choices

To keep the bill minimal (≈ US$ 5/month at low traffic), the stack uses:

- no WAF (CloudFront, API, Cognito)
- AWS-owned encryption for the table
- S3-managed encryption for the website buckets
- no KMS key for the API access logs
- Cognito Essentials (10k MAU free)

See `packages/infra/src/locals.tf` (`cost_settings`).

## Local development

`pnpm nx dev @stardew-valley-helper/website` starts the website, the API and DynamoDB Local (requires
Docker). Without a `runtime-config.json`, login is mocked.

Tests mock DynamoDB with moto, so they do not need Docker.

`.tmp/` is git-ignored. It holds a local copy of the community `stardew-valley-scheduler`, used as a
reference and as the source for `packages/db/scripts/build-data.py` and
`packages/website/scripts/sync_icons.py`.

## Data license

Game data and icons are © ConcernedApe LLC and partly from the Stardew Valley Wiki (CC BY-NC-SA 3.0),
for non-commercial fan use only.
