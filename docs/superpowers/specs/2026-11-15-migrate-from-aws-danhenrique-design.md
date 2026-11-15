# Migrate the Stardew Valley Helper from `aws-danhenrique` to `stardew-valley-helper`

Date: 2026-11-15
Status: design approved in conversation, written spec pending review

## Goal

Move the whole Stardew Valley Helper (db, api, website, infra and the shared pieces it uses) from the
`danhenrique/aws-danhenrique` monorepo to `danhenrique/stardew-valley-helper`, fully separated:

- Every current feature keeps working at `https://stardew.danhenrique.com.br`.
- The new repository depends on nothing from the old one.
- When done, `aws-danhenrique` has no Stardew reference left.
- Everything is generated and maintained with `@aws/nx-plugin` (Terraform, Docker, pnpm catalogs).

## Decisions

| # | Topic | Choice |
|---|---|---|
| 1 | Production resources | Same AWS account. Existing resources are kept: nothing is recreated, no player data or Cognito user is lost |
| 2 | Code names | Rename everything to the new repository's scope, keeping the domain names the generators derive from (`stardew-valley-api`, `stardew-valley-db`) |
| 3 | Git history | Start fresh: projects are created by the plugin generators and the code is ported on top. History stays readable in `aws-danhenrique` |
| 4 | Repository rules | Copy the old `.claude/CLAUDE.md` and the Nx block of the root `CLAUDE.md` |
| 5 | Community scheduler | Copied to `.tmp/stardew-valley-scheduler`; `.tmp/` is git-ignored (third-party code) |
| 6 | Import dataset | Versioned in `packages/db/data`, with `build-data.py` |
| 7 | Infra cutover | Copy the state to a new key and require a no-change `plan` |
| 8 | DNS | The `danhenrique.com.br` zone stays in the old repository; the `stardew.` subdomain records live in the new one |

### Bootstrap

The plugin's bootstrap creates the bucket `${accountId}-tf-state-${region}`. In the same account and
region, the new repository's bootstrap **adopts the same bucket** instead of creating another one.
Separation comes from the state key:

- Old: `aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate`
- New: `stardew-valley-helper-infra/prod/terraform.tfstate`

The new repository keeps the generated `bootstrap` and `bootstrap-destroy` targets. The README warns
that `bootstrap-destroy` must not run while `aws-danhenrique` uses the same bucket.

## New repository layout

```
stardew-valley-helper/
├── packages/
│   ├── db/              stardew_valley_helper.stardew_valley_db   (py#dynamodb)  module stardew_valley_db
│   │   ├── data/        versioned dataset
│   │   └── scripts/     build-data.py
│   ├── api/             stardew_valley_helper.stardew_valley_api  (py#fast-api)  module stardew_valley_api
│   ├── website/         @stardew-valley-helper/website  (ts#react-website)  dev 4201, preview 4301
│   ├── infra/           @stardew-valley-helper/infra    (terraform#project, with bootstrap)
│   └── common/
│       ├── terraform/   @stardew-valley-helper/terraform
│       └── scripts/     @stardew-valley-helper/scripts  (DynamoDB Local)
├── docs/superpowers/{specs,plans}/
├── .claude/CLAUDE.md
├── CLAUDE.md
├── pyproject.toml + uv.lock
├── .github/workflows/ci.yml
└── .tmp/                (git-ignored)
```

### Source → destination map

| Source (`aws-danhenrique`) | Destination | New name |
|---|---|---|
| `packages/stardew-valley/db` (`aws_danhenrique.stardew_valley_db`, module `aws_danhenrique_stardew_valley_db`) | `packages/db` | `stardew_valley_helper.stardew_valley_db`, module `stardew_valley_db` |
| `packages/stardew-valley/api` (`aws_danhenrique.stardew_valley_api`, module `stardew_valley_api`) | `packages/api` | `stardew_valley_helper.stardew_valley_api`, module `stardew_valley_api` |
| `packages/stardew-valley/website` (`@aws-danhenrique/stardew-valley-helper-website`) | `packages/website` | `@stardew-valley-helper/website` |
| `packages/stardew-valley/infra` (`@aws-danhenrique/stardew-valley-infra`) | `packages/infra` | `@stardew-valley-helper/infra` |
| `packages/common/terraform` (modules the Stardew uses) | `packages/common/terraform` | `@stardew-valley-helper/terraform` |
| `packages/common/scripts` (`src/dynamodb/*`) | `packages/common/scripts` | `@stardew-valley-helper/scripts` |
| `.tmp/data` + `.tmp/scripts/build-data.py` | `packages/db/data` | without the `*:Zone.Identifier` files |
| `.tmp/stardew-valley-scheduler` | `.tmp/stardew-valley-scheduler` | not versioned |
| `docs/superpowers/{specs,plans}/*stardew*` | `docs/superpowers/{specs,plans}/` | same file names |

The Python distribution names change from `aws-danhenrique-stardew-valley-*` to
`stardew-valley-helper-*`, together with the root `pyproject.toml` and the `uv export` command.

### How projects are created

1. `@aws/nx-plugin` generators create each project, as the old repository did: `py#dynamodb`
   (`name=stardew-valley-db`, `moduleName=stardew_valley_db`), `py#fast-api` (`name=stardew-valley-api`,
   `moduleName=stardew_valley_api`, `auth=iam`, `infra=rest-lambda`), `ts#react-website` (`name=website`,
   `ux=none`, Tailwind, TanStack Router), `ts#react-website#auth`, `terraform#project` (`name=infra`), and
   the `connection` generator for api → db (`py#dynamodb#fast-api-connection`) and website → api
   (`py#fast-api#react-connection`).

   The generator `name` drives the Nx project name, the API class names (`StardewValleyApi`), the
   website hook (`useStardewValleyApi`), `StardewValleyApiProvider`, `src/generated/stardew-valley-api`
   and the `app/apis/stardew-valley-api` Terraform module. Keeping `stardew-valley-api` and
   `stardew-valley-db` leaves the 81 website files that use those names unchanged.
2. Each project's code is ported on top of the scaffold, with the renames.
3. The generated `project.json` is diffed against the old one, and the old custom targets are
   re-applied: `import`, `openapi`, `dev` with DynamoDB Local, `generate:stardew-valley-api-client`,
   `generate:stardew-valley-api-operations`, `sync_icons` and the openapi cache fix (commit `6369574`).
4. When a generator output differs from the old behavior, the old behavior wins and the difference is
   recorded in the plan.

### Versions

Same as the old repository: pnpm catalog, Nx 23.2.1, `@aws/nx-plugin` 1.0.4, Terraform providers
(aws 6.66.0, null 3.3.2, local 2.9.1, archive 2.8.1, random 3.9.1), Python, ruff, ty and checkov
3.3.20. The migration upgrades nothing.

### Terraform

- **Same root addresses.** The `packages/infra` root module keeps the old module names
  (`module.metrics`, `module.runtime_config_appconfig`, `module.asset_bucket`, `module.table`,
  `module.user_identity`, `module.api`, the website module, `module.runtime_config_appconfig_deployment`)
  and resource names (`aws_acm_certificate.website`, `aws_route53_record.*`,
  `aws_cognito_user_pool_domain.auth`, ...). Only `source` changes, which recreates nothing.
- **Duplicated `core/*` modules.** `metrics`, `core/asset-bucket`, `core/runtime-config/*`,
  `core/user-identity/*`, `core/static-website` and `core/api/*` (the ones the Stardew uses) are
  copied. The old repository keeps its own copies for the personal website.
- **Modules removed from the old repository:** `app/apis/stardew-valley-api`,
  `app/dynamodb/stardew-valley-db`, `app/static-websites/stardew-valley-helper-website` and
  `generated/stardew-valley-api`.
- **Frozen physical names.** Values derived from the old repository name stay literal, with a comment
  explaining why:
  - the table: `aws-danhenrique-stardew-valley-db-${random_string.suffix.result}`. Renaming replaces
    the table, and `deletion_protection` would block it.
  - the Cognito domain prefix: `danhenrique-stardew-valley-helper-website`.
  - any other physical name that the `plan` shows as a replacement.
- **State bucket:** the same bucket, with key `stardew-valley-helper-infra/prod/terraform.tfstate` set
  by `STATE_KEY_PREFIX` in `scripts/init.ts`.

### DNS

| Repository | Owns |
|---|---|
| `aws-danhenrique` (`packages/infra`) | The `danhenrique.com.br` hosted zone and the apex/main domain records |
| `stardew-valley-helper` (`packages/infra`) | Reads the zone through `data "aws_route53_zone"`. Owns `stardew.danhenrique.com.br` (A/AAAA → CloudFront), `auth.stardew.danhenrique.com.br` (A → Cognito) and the ACM validation of `stardew.*` and `*.stardew.*` |

This is how it already works today; those records move with the state.

### Import dataset

- The dataset moves from `aws-danhenrique/.tmp/data` to `packages/db/data` (JSON files, `README.md`
  and `_meta/`). `build-data.py` goes to `packages/db/scripts/`, outside `data/`, because it wipes everything in its
  output directory except `README.md`.
- `*:Zone.Identifier` files (Windows metadata) are left out.
- `importer/cli.py` `DEFAULT_DATA_DIR` points to `packages/db/data`. Today it points to
  `../../stardew-valley/game-data/data`, which does not exist.
- The website `sync_icons.py` uses the new dataset path and the scheduler in
  `.tmp/stardew-valley-scheduler`.
- License: data is © ConcernedApe LLC and partly from the Stardew Valley Wiki (CC BY-NC-SA 3.0),
  non-commercial fan use only. `packages/db/data/README.md` carries the attribution.

### Root files

- **Copied from the old repository:** `.husky`, `.git-secrets`, `.gitallowed`, `biome.json`,
  `.editorconfig`, `.gitignore` (plus `.tmp/`), `pnpm-workspace.yaml` (`packages/*`,
  `packages/common/*`) and `.github/workflows/ci.yml`.
- **Rules:**
  - root `CLAUDE.md`: the generated Nx block.
  - `.claude/CLAUDE.md`: the old instructions, copied verbatim (Tailwind and the `.tailwind`
    directory, Heroicons, light/dark theme, `feature/*` branch with a PR to `main`), with the scheduler
    reference pointing to `.tmp/stardew-valley-scheduler`.
- **Not copied:** `.env.local`, any real `runtime-config.json`, `.venv`.

## Migration sequence

Each phase starts only after the previous gate passes.

### Phase 1: Scaffold

On the new repository's `feature/migrate-from-aws-danhenrique` branch:

- Generators create the projects and connections.
- Root files, rules and CI are added.

**Gate:** `pnpm install` and `pnpm nx run-many -t build` pass on the scaffold.

### Phase 2: Port the code

Port db, api, website, scripts, Terraform modules, the dataset and the docs, with the renames.

**Gate:**
- `pnpm nx run-many -t lint test build typecheck` passes.
- The test count per project matches the old repository, with no test removed or skipped.
- The OpenAPI spec generated in both repositories has an empty diff.
- `import --dry-run` with the versioned dataset reports the same per-entity totals as the old
  repository with `.tmp/data`.
- `checkov` passes with the same `checkov.yml` and no new suppressions.
- `nx dev @stardew-valley-helper/website` starts the website, the API and DynamoDB Local.

### Phase 3: State cutover

> Updated during execution: the Phase 4 lock is written **before** the copy, so the old state cannot
> change after it was copied. The gate is equivalence with OLD's own prod plan, which is never empty
> (see `docs/superpowers/plans/2026-11-15-migration-baseline.md`), not `No changes`.

1. Copy `s3://<account>-tf-state-sa-east-1/aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate`
   to `.../stardew-valley-helper-infra/prod/terraform.tfstate`.
2. Run `pnpm nx run @stardew-valley-helper/infra:plan`.

**Gate:**
- The plan reports *"No changes"*. The only acceptable changes are artifacts (Lambda zip hashes,
  website objects). Any other diff is fixed in the code, never on the resource.
- The user reviews the plan before the apply.

3. Apply the reviewed plan.
4. Production smoke test: log in, list plantings, add, edit and remove a planting and a machine, the
   fish page and the rain of the day.

### Phase 4: Freeze the old state

Leave `aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate` untouched and write a permanent lock
object next to it, `aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate.tflock`, whose body
says the state moved to `stardew-valley-helper`. The backend uses `use_lockfile = true`, so any `plan`
or `apply` from the old code fails with a state-lock error instead of planning against it.

Renaming or deleting the old key is not an option: the old code would then see an empty state and
plan to create every resource again.

### Phase 5: Removal in `aws-danhenrique`

On a `feature/remove-stardew-valley` branch with its own PR in `aws-danhenrique`, remove:

- `packages/stardew-valley/` and `packages/common/scripts/`.
- In `packages/common/terraform`: the Stardew `app/*` modules, `generated/stardew-valley-api`, and the
  Stardew dependencies in `project.json` (`assemble`, `build`, `generate:stardew-valley-api-operations`).
- The Stardew alias in `tsconfig.base.json` and `packages/stardew-valley/*` in `pnpm-workspace.yaml`.
- The root `pyproject.toml` and `uv.lock`, and `@nxlv/python` if no Python project is left.
- The Stardew docs in `docs/superpowers/`.
- The scheduler reference in the old `.claude/CLAUDE.md`, only with explicit user approval (`.claude`
  rule).
- Add a line to the old README saying that the `stardew.` subdomain is managed by
  `stardew-valley-helper`.

**Gate:**
- The `packages/infra` `plan` reports *"No changes"*.
- `pnpm nx run-many -t lint test build typecheck` passes.
- `grep -ri stardew` (excluding `node_modules`, `dist` and `.git`) returns nothing.

## Rollback

| Failure point | Action |
|---|---|
| Phases 1 and 2 | Nothing changed in AWS. Discard the branch |
| Phase 3 plan shows changes | Do not apply. Fix the new code; the old state is untouched |
| Phase 3 apply broke something | Redeploy from the old code (the old key is still live), delete the new key, investigate |
| After phase 4 | Delete the old `.tflock` object and redeploy from the old repository |

The two repositories never apply at the same time.

## Testing and CI

- **Equivalence:** tests ported 1:1 (pytest with moto, vitest, Terraform tests in `infra/src/tests`),
  empty OpenAPI diff, matching `--dry-run` import totals, no-change plan.
- **CI:** the same workflow as the old repository (pnpm 12.8.1, Node 24, setup-terraform, setup-uv,
  `nx affected -t lint test build typecheck`).
- **Deploy:** stays manual (local `plan` and `apply`). CI deploys are out of scope.
- **Secrets:** husky and git-secrets hooks are copied. Before each commit, check that no `.env.local`,
  real `runtime-config.json` or credential is in the diff.

## Documentation

- **New README:** the current Stardew README adapted (projects, new names, shared bootstrap and the
  `bootstrap-destroy` warning, state key, DNS split, deploy, import with the local dataset, local
  development, data license, migration origin). It replaces the scaffold's generic README.
- **Per-project READMEs** (`db`, `api`, `website`): ported with the new names.
- **Historical Stardew specs and plans:** moved to `docs/superpowers/` in the new repository.

## Out of scope

- Dependency or version upgrades.
- Changing the AWS account, region or state bucket.
- Automated deploys from CI.
- New features or behavior changes.
