# Migrate from aws-danhenrique Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Stardew Valley Helper (db, api, website, infra) from `aws-danhenrique` into this repository with no behavior change and no AWS resource recreated, then remove it from `aws-danhenrique`.

**Architecture:** Each project is created by the `@aws/nx-plugin` generator the old project came from, and the old code is ported on top. The Terraform root keeps the old module and resource addresses, so copying the old state to a new key yields a no-change plan. The old state stays in place, frozen by a permanent lock object.

**Tech Stack:** Nx 23.2.1, `@aws/nx-plugin` 1.0.4, pnpm catalogs, uv workspace (Python 3.14, FastAPI, PynamoDB), React + Vite + Tailwind + TanStack Router, Terraform (aws 6.66.0), checkov 3.3.20.

**Spec:** `docs/superpowers/specs/2026-11-15-migrate-from-aws-danhenrique-design.md`

**Paths used below:**
- `OLD` = `/home/danhenrique/projects/danhenrique/aws-danhenrique`
- `NEW` = `/home/danhenrique/projects/stardew-valley/stardew-valley-helper`

## Global Constraints

- Branch: `feature/migrate-from-aws-danhenrique` (NEW, already created). The old-repository removal uses `feature/remove-stardew-valley` (OLD). Each branch ends with push and a PR to `main`, then the local checkout returns to `main`.
- Project names: `stardew_valley_helper.stardew_valley_db` (module `stardew_valley_db`), `stardew_valley_helper.stardew_valley_api` (module `stardew_valley_api`), `@stardew-valley-helper/website`, `@stardew-valley-helper/infra`, `@stardew-valley-helper/terraform`, `@stardew-valley-helper/scripts`.
- Generator `name` values: `stardew-valley-db`, `stardew-valley-api`, `website`, `infra`, `scripts`.
- Versions are identical to OLD: copy the `catalog:` block of `OLD/pnpm-workspace.yaml`, the Python pins of `OLD/pyproject.toml` and the provider pins of `OLD/packages/stardew-valley/infra/src/providers.tf`. Upgrade nothing.
- Frozen physical names stay literal, with a `# Frozen: physical name from aws-danhenrique; renaming replaces the resource` comment:
  - `aws-danhenrique-stardew-valley-db-${random_string.suffix.result}` (table)
  - `danhenrique-stardew-valley-helper-website` (Cognito domain prefix)
  - `stardew-helper` (website name)
  - `stardew-valley-helper-runtime-config` (AppConfig)
  - `stardew-valley-assets` (asset bucket prefix)
  - `StardewValleyApi-*` (API name)
- State key prefix: `stardew-valley-helper-infra`. Bucket: `${accountId}-tf-state-${region}`, the same one as OLD.
- Documentation, code and commits in English. `.claude/CLAUDE.md` is copied verbatim (user content, Portuguese).
- No secrets, no `.env.local`, no real `runtime-config.json`, no AWS account id in any committed file.
- Never run `terraform apply`, `destroy`, `bootstrap-destroy` or any S3 write without the user's explicit go-ahead in that moment.
- Every git commit ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ntabp9VU7hrWnGaud8CxFs
  ```

## Review Focus

1. **Lambda bundle drift.** The renamed distribution in `uv export --package ...` can drop `stardew_valley_db` from the bundle. Tests pass locally, but the Lambdas fail at import in production. Task 4 imports the app from the built bundle.
2. **Physical-name drift.** A generator default replaces a literal, and the plan shows a replace on the table, Cognito, a bucket or a Lambda. Task 6 asserts the frozen names in `main.tftest.hcl`. Task 8 rejects any replace.
3. **Dataset path.** The importer runs from another cwd, or `*:Zone.Identifier` files leak into git. Task 3 tests that `DEFAULT_DATA_DIR` resolves to `packages/db/data` with `_meta/index.json`, and that no versioned file name contains `:`.
4. **Stale old writer.** Someone runs `plan` or `apply` from OLD after the cutover. Task 9 proves that OLD's `plan` fails with a lock error.
5. **Local dev wiring.** The `connection.json` path (`dist/packages/common/terraform/runtime-config/connection.json`) and the DynamoDB Local port 8000 / API port 8001 change. Login silently stops being mocked or the API cannot reach the table. Task 5 runs `dev` and loads the Hoje page against the local API.

---

### Task 0: Baseline from OLD

**Files:**
- Create: `NEW/docs/superpowers/plans/2026-11-15-migration-baseline.md`

**Interfaces:**
- Produces: the baseline numbers used by the gates of Tasks 3–6. These are:
  - pytest collected count for api and db
  - vitest test count for the website
  - `import --dry-run` per-entity totals
  - the OpenAPI spec
  - a no-change result from OLD's prod plan

- [ ] **Step 1:** In OLD on `main`, run `uv run pytest --collect-only -q` in `packages/stardew-valley/api` and in `packages/stardew-valley/db`. Record the `N tests collected` lines.
- [ ] **Step 2:** Run `pnpm nx test @aws-danhenrique/stardew-valley-helper-website --watch=false` and record the `Tests N passed` line.
- [ ] **Step 3:** Run `pnpm nx run aws_danhenrique.stardew_valley_db:import --data-dir $OLD/.tmp/data --dry-run` and record the per-entity totals it logs.
- [ ] **Step 4:** Run `pnpm nx run aws_danhenrique.stardew_valley_api:openapi` and copy the generated spec to `/tmp/claude-1000/-home-danhenrique-projects/567f153b-1901-46c4-b35f-39f275f47007/scratchpad/baseline-openapi.json`.
- [ ] **Step 5:** Run `pnpm nx run @aws-danhenrique/stardew-valley-infra:plan`.
  - Expected: `No changes.`
  - If there are changes, stop and report them to the user. Production must be clean before the migration.
- [ ] **Step 6:** Write the numbers from Steps 1–3 and the result from Step 5 into the baseline file. Leave out the account id and resource ids.
- [ ] **Step 7: Commit** `docs: record the migration baseline`.

---

### Task 1: Workspace root

**Files:**
- Copy from OLD into NEW: `.husky/`, `.git-secrets`, `.gitallowed`, `biome.json`, `.editorconfig`, `.github/workflows/ci.yml`
- Modify: `NEW/.gitignore` (OLD content plus a `.tmp/` line), `NEW/pnpm-workspace.yaml` (OLD catalog and settings; `packages:` is `packages/*` and `packages/common/*`), `NEW/package.json` (OLD devDependencies, keeping `@stardew-valley-helper/source` as the name)
- Create: `NEW/CLAUDE.md` (the Nx block of `OLD/CLAUDE.md`), `NEW/.claude/CLAUDE.md` (verbatim copy of `OLD/.claude/CLAUDE.md`)
- Create (not versioned): `NEW/.tmp/stardew-valley-scheduler/` (copy of `OLD/.tmp/stardew-valley-scheduler`)

- [ ] **Step 1:** Copy and modify the files above.
- [ ] **Step 2:** Run `pnpm install`. Expected: exit 0.
- [ ] **Step 3:** Run `git status --short`.
  - Expected: `.tmp/` is not listed.
  - Expected: `git check-ignore .tmp/stardew-valley-scheduler` prints the path.
- [ ] **Step 4: Commit** `chore: set up the workspace root from aws-danhenrique`.

---

### Task 2: Common scripts (DynamoDB Local)

**Files:**
- Generate: `pnpm nx g @aws/nx-plugin:ts#project --name=scripts --directory=packages --subDirectory=common/scripts`
- Copy: `OLD/packages/common/scripts/src/dynamodb/{create-local-table,pull-image,start-container}.ts` → `NEW/packages/common/scripts/src/dynamodb/`

**Interfaces:**
- Produces: `tsx ../common/scripts/src/dynamodb/pull-image.ts` and `start-container.ts`, invoked from `packages/db`. The relative path drops one `../` compared to OLD.

- [ ] **Step 1:** Generate the project and copy the files.
- [ ] **Step 2:** Run `pnpm nx run-many -t lint compile -p @stardew-valley-helper/scripts`. Expected: pass.
- [ ] **Step 3: Commit** `feat(scripts): add DynamoDB Local scripts`.

---

### Task 3: db project and dataset

**Files:**
- Generate: `pnpm nx g @aws/nx-plugin:py#dynamodb --name=stardew-valley-db --moduleName=stardew_valley_db --directory=packages --subDirectory=db --iac=terraform`
- Copy: `OLD/packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/**` → `NEW/packages/db/stardew_valley_db/`, `tests/**`, `README.md`, `config.json`
- Copy: `OLD/.tmp/data/**` → `NEW/packages/db/data/` and `OLD/.tmp/scripts/build-data.py` → `NEW/packages/db/data/scripts/build-data.py`, excluding every `*:Zone.Identifier` file
- Modify: `NEW/packages/db/stardew_valley_db/importer/cli.py` (`WORKSPACE_ROOT`, `DEFAULT_DATA_DIR`), `NEW/packages/db/project.json` (reapply OLD targets `import`, `pull-image`, `dev`), `NEW/packages/db/pyproject.toml` (report paths with `../../`)
- Test: `NEW/packages/db/tests/test_import_paths.py`

**Interfaces:**
- Produces:
  - Python package `stardew_valley_db`, with the same public names as OLD's `aws_danhenrique_stardew_valley_db` (`entities.BaseModel`, `importer.cli.main(argv: list[str] | None) -> int`).
  - Nx project `stardew_valley_helper.stardew_valley_db` with targets `import` and `dev` (port 8000).

- [ ] **Step 1:** Generate the project and copy the code and tests.
- [ ] **Step 2:** Replace every `aws_danhenrique_stardew_valley_db` with `stardew_valley_db`, and every `aws_danhenrique.stardew_valley_db` with `stardew_valley_helper.stardew_valley_db`.
- [ ] **Step 3: Write the failing test** `test_import_paths.py`:
  ```python
  def test_default_data_dir_is_the_versioned_dataset():
      assert DEFAULT_DATA_DIR == Path(__file__).resolve().parents[1] / "data"
      assert (DEFAULT_DATA_DIR / "_meta" / "index.json").is_file()

  def test_dataset_has_no_windows_metadata_files():
      assert not [p for p in DEFAULT_DATA_DIR.rglob("*") if ":" in p.name]
  ```
- [ ] **Step 4:** Run `pnpm nx test stardew_valley_helper.stardew_valley_db`. Expected: FAIL on `DEFAULT_DATA_DIR`.
- [ ] **Step 5:** Set `DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"` in `cli.py`, then copy the dataset.
- [ ] **Step 6:** Run `pnpm nx test stardew_valley_helper.stardew_valley_db`.
  - Expected: PASS.
  - Expected: the collected count is the baseline db count + 2.
- [ ] **Step 7:** Run `pnpm nx run stardew_valley_helper.stardew_valley_db:import --dry-run`. Expected: the per-entity totals equal the baseline.
- [ ] **Step 8: Commit** `feat(db): port the DynamoDB project and version the game dataset`.

---

### Task 4: api project

**Files:**
- Generate: `pnpm nx g @aws/nx-plugin:py#fast-api --name=stardew-valley-api --moduleName=stardew_valley_api --directory=packages --subDirectory=api --auth=iam --infra=rest-lambda --iac=terraform`
- Generate: `pnpm nx g @aws/nx-plugin:connection --sourceProject=stardew_valley_helper.stardew_valley_api --targetProject=stardew_valley_helper.stardew_valley_db`
- Copy: `OLD/packages/stardew-valley/api/{stardew_valley_api,tests,scripts}/**`, `README.md`, `run.sh`
- Modify: `NEW/packages/api/project.json`
  - Reapply OLD `openapi` (with the cache fix from OLD commit `6369574`) and `bundle-x86`.
  - In the `uv export` command, use `--package stardew-valley-helper-stardew-valley-api`, or the distribution name the generator wrote in `packages/api/pyproject.toml`.
- Test: `NEW/packages/api/tests/test_bundle.py`

**Interfaces:**
- Consumes: `stardew_valley_db` (Task 3).
- Produces:
  - Nx project `stardew_valley_helper.stardew_valley_api`, with targets `openapi`, `bundle-x86` and `dev` (port 8001).
  - The OpenAPI spec consumed by Task 5.
  - Bundle at `dist/packages/api/bundle-x86/`, consumed by Task 6.

- [ ] **Step 1:** Generate the project and the connection, copy the code, and replace every `aws_danhenrique_stardew_valley_db` / `aws_danhenrique.` import or reference.
- [ ] **Step 2: Write the failing test** `test_bundle.py`. It is marked `@pytest.mark.skipif` when the bundle dir is absent, so plain `test` runs stay hermetic.
  ```python
  def test_bundle_imports_app_and_db():
      out = subprocess.run(
          [sys.executable, "-I", "-c", "import stardew_valley_api.main, stardew_valley_db"],
          env={"PYTHONPATH": str(BUNDLE_DIR)},
          capture_output=True,
      )
      assert out.returncode == 0, out.stderr
  ```
  `BUNDLE_DIR` = workspace `dist/packages/api/bundle-x86`.
- [ ] **Step 3:** Run `pnpm nx run stardew_valley_helper.stardew_valley_api:bundle-x86`, then `pnpm nx test stardew_valley_helper.stardew_valley_api`. Expected: PASS. If it fails, fix the `uv export --package` name.
- [ ] **Step 4:** Check the test count. Expected: the collected count is the baseline api count + 1, with nothing skipped except when the bundle is absent.
- [ ] **Step 5:** Run `pnpm nx run stardew_valley_helper.stardew_valley_api:openapi`, then diff the generated spec against `scratchpad/baseline-openapi.json`. Expected: empty diff.
- [ ] **Step 6: Commit** `feat(api): port the FastAPI project`.

---

### Task 5: website project

**Files:**
- Generate: `pnpm nx g @aws/nx-plugin:ts#react-website --name=website --directory=packages --ux=none --tailwind=true --tanstackRouter=true --iac=terraform`
- Generate: `pnpm nx g @aws/nx-plugin:ts#react-website#auth --project=@stardew-valley-helper/website --cognitoDomain=danhenrique-stardew-valley-helper-website --allowSignup=true`
- Generate: `pnpm nx g @aws/nx-plugin:connection --sourceProject=@stardew-valley-helper/website --targetProject=stardew_valley_helper.stardew_valley_api`
- Copy: `OLD/packages/stardew-valley/website/{src,public,scripts,index.html,README.md}` over the scaffold
- Modify: `NEW/packages/website/project.json`
  - Reapply OLD `dev`, `load-runtime-config`, `generate:stardew-valley-api-client` and `watch-generate:stardew-valley-api-client`, with the project names replaced.
  - Use ports 4201 (dev) and 4301 (preview), and `dist/packages/website/...` paths.
- Modify: `NEW/packages/website/vite.config.mts` (OLD settings, with `../../` paths)
- Modify: `NEW/packages/website/scripts/sync_icons.py` (usage line points to `.tmp/stardew-valley-scheduler/public/icons` and `packages/db/data/_meta/index.json`)

**Interfaces:**
- Consumes: the OpenAPI spec and the `dev` target of the api (Task 4).
- Produces:
  - `dist/packages/website/bundle`, consumed by Task 6.
  - The user-identity Terraform module, which the auth generator creates under `packages/common/terraform/src/core/user-identity`.

- [ ] **Step 1:** Generate, copy, and replace every `@aws-danhenrique/stardew-valley-helper-website` / `aws_danhenrique.` reference.
- [ ] **Step 2:** Run `pnpm nx run-many -t lint typecheck test build -p @stardew-valley-helper/website`.
  - Expected: PASS.
  - Expected: `Tests N passed` equals the baseline website count.
- [ ] **Step 3:** Run `pnpm nx dev @stardew-valley-helper/website` with Docker running.
  - Open `http://localhost:4201`.
  - Expected: mocked login works, Hoje loads data from `localhost:8001`, adding a planting persists after a reload.
- [ ] **Step 4: Commit** `feat(website): port the React website`.

---

### Task 6: Terraform modules and infra

**Files:**
- Generate: `pnpm nx g @aws/nx-plugin:terraform#project --name=infra --type=application --directory=packages`
- Overwrite with OLD content (only `source` paths change):
  - `NEW/packages/common/terraform/src/metrics/`
  - `core/{asset-bucket,runtime-config,user-identity,static-website,api}/`
  - `app/apis/stardew-valley-api/`, `app/dynamodb/stardew-valley-db/`, `app/static-websites/stardew-valley-helper-website/`
- Copy: `OLD/packages/stardew-valley/infra/{src/*.tf,src/env,src/tests,checkov.yml,bootstrap,scripts}` → `NEW/packages/infra/`
- Modify:
  - `NEW/packages/infra/src/main.tf`: `source = "../../common/terraform/src/..."`
  - `NEW/packages/infra/scripts/init.ts`: `STATE_KEY_PREFIX = "stardew-valley-helper-infra"`
  - `NEW/packages/infra/project.json`: `../../../` paths, and the `assemble`/`build` deps point to `@stardew-valley-helper/terraform`
  - `NEW/packages/common/terraform/project.json`: OLD `generate:stardew-valley-api-operations`, with deps limited to the NEW projects
- Test: `NEW/packages/infra/src/tests/main.tftest.hcl` (add frozen-name assertions)

**Interfaces:**
- Consumes: the bundles from Tasks 4 and 5.
- Produces: `@stardew-valley-helper/infra` with targets `plan`, `apply`, `output`, `bootstrap`, `checkov`, `test`, whose root addresses are identical to OLD.

- [ ] **Step 1:** Generate, copy, and fix the paths.
- [ ] **Step 2:** Diff the module directories against OLD with `diff -r OLD/packages/common/terraform/src/<m> NEW/packages/common/terraform/src/<m>` for each module listed above. Expected: only `source` lines and comments differ. Restore any generator-changed literal.
- [ ] **Step 3: Write the failing assertions** in `main.tftest.hcl`. These go in a new `run "frozen_physical_names"` block, using the same `command` and mocks as the existing runs:
  ```hcl
  assert {
    condition     = startswith(module.table.table_name, "aws-danhenrique-stardew-valley-db-")
    error_message = "table name must stay frozen"
  }
  assert {
    condition     = module.user_identity.user_pool_domain_prefix == "danhenrique-stardew-valley-helper-website"
    error_message = "cognito domain prefix must stay frozen"
  }
  ```
  If an output is missing from a module, read the value through the resource attribute available in the existing test runs.
- [ ] **Step 4:** Run `pnpm nx test @stardew-valley-helper/infra`.
  - Expected: PASS.
  - Expected: the run count is the OLD count + 1.
- [ ] **Step 5:** Run `pnpm nx run-many -t lint test build typecheck` for the whole workspace.
  - Expected: PASS.
  - Expected: checkov reports no new failure and no new suppression compared to OLD's `checkov.yml`.
- [ ] **Step 6:** Run `grep -rIi "aws-danhenrique\|aws_danhenrique" packages --exclude-dir=node_modules --exclude-dir=data`. Expected: only lines carrying the frozen-name comment.
- [ ] **Step 7: Commit** `feat(infra): port the Terraform modules and prod root`.

---

### Task 7: Documentation and PR

**Files:**
- Modify: `NEW/README.md`. Replace it with OLD `packages/stardew-valley/README.md`, adapted to cover:
  - the new names
  - the shared bootstrap bucket and the warning against `bootstrap-destroy`
  - the state key and the DNS split
  - the import that uses `packages/db/data`
  - the data license and the migration origin
- Modify: the `api`, `db` and `website` READMEs (new names)
- Copy: the `OLD/docs/superpowers/{specs,plans}/*stardew*` files (8 + 8) into `NEW/docs/superpowers/`

- [ ] **Step 1:** Write or copy the files.
- [ ] **Step 2:** Run `git diff --cached --name-only | grep -E "\.env|runtime-config\.json"`. Expected: nothing.
- [ ] **Step 3: Commit** `docs: document the standalone repository`, then push and open a PR to `main`.
- [ ] **Step 4:** Stop. The user reviews and merges the PR. Then check out `main` and pull.

---

### Task 8: State cutover (with the user)

- [ ] **Step 1:** After the user's go-ahead, copy the state:
  ```bash
  aws s3 cp s3://<account>-tf-state-sa-east-1/aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate \
            s3://<account>-tf-state-sa-east-1/stardew-valley-helper-infra/prod/terraform.tfstate
  ```
- [ ] **Step 2:** Run `pnpm nx run @stardew-valley-helper/infra:plan`.
  - Expected: `No changes.`, or only in-place updates to Lambda code hashes and website objects.
  - Any `must be replaced`, `destroy` or `create` means: do not apply. Fix the code and re-plan.
- [ ] **Step 3:** Show the plan summary to the user and wait for approval.
- [ ] **Step 4:** Run `pnpm nx run @stardew-valley-helper/infra:apply`.
- [ ] **Step 5:** Smoke test on `https://stardew.danhenrique.com.br` with the user:
  - log in
  - list plantings
  - add, edit and remove a planting and a machine
  - the fish page
  - toggle the rain of the day
- [ ] **Step 6:** Run the plan again. Expected: `No changes.`

---

### Task 9: Freeze the old state (with the user)

- [ ] **Step 1:** After the user's go-ahead, write the lock object:
  ```bash
  echo '{"ID":"migrated","Info":"State moved to stardew-valley-helper (stardew-valley-helper-infra/prod)"}' \
    | aws s3 cp - s3://<account>-tf-state-sa-east-1/aws-danhenrique-stardew-valley-infra/prod/terraform.tfstate.tflock
  ```
- [ ] **Step 2:** In OLD, run `pnpm nx run @aws-danhenrique/stardew-valley-infra:plan`. Expected: it fails with a state-lock error.

---

### Task 10: Remove the Stardew from OLD

**Files (OLD, branch `feature/remove-stardew-valley` from `main`):**
- Delete:
  - `packages/stardew-valley/` and `packages/common/scripts/`
  - `packages/common/terraform/src/app/apis/stardew-valley-api/`, `app/dynamodb/stardew-valley-db/`, `app/static-websites/stardew-valley-helper-website/`, `generated/stardew-valley-api/`
  - `pyproject.toml`, `uv.lock`, `.python-version`
  - the 16 `docs/superpowers/{specs,plans}/*stardew*` files
- Modify:
  - `packages/common/terraform/project.json`: drop the Stardew deps and `generate:stardew-valley-api-operations`
  - `tsconfig.base.json`: drop the Stardew alias
  - `pnpm-workspace.yaml`: drop `packages/stardew-valley/*`
  - `package.json`: drop `@nxlv/python` if `pnpm nx show projects` lists no Python project
  - `README.md`: add one line saying the `stardew.` subdomain is managed by `stardew-valley-helper`
- Ask first: whether to edit `OLD/.claude/CLAUDE.md` to drop the scheduler reference (`.claude` rule). Edit only on an explicit yes.

- [ ] **Step 1:** Make the changes above, then run `pnpm install`.
- [ ] **Step 2:** Run `pnpm nx run-many -t lint test build typecheck`. Expected: PASS.
- [ ] **Step 3:** Run `pnpm nx run @aws-danhenrique/infra:plan`. Expected: `No changes.`
- [ ] **Step 4:** Run `grep -rIil stardew . --exclude-dir={node_modules,dist,.git,.nx,.terraform,.tmp,coverage,reports}`. Expected: only `README.md` (the pointer line) and, if the user declined the edit, `.claude/CLAUDE.md`.
- [ ] **Step 5: Commit** `chore: move the Stardew Valley Helper to its own repository`, then push, open a PR to `main`, and return to `main`.
