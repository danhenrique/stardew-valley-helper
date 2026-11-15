# Stardew Valley Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Stardew Valley Helper app (DynamoDB game database + FastAPI + React site + Terraform) under `packages/stardew-valley/` and make it deployable to prod.

**Architecture:** `@aws/nx-plugin` generators scaffold four projects (py#dynamodb, py#api, ts#website + auth, terraform#project) wired with `connection` generators. All game data is imported once into a single-table DynamoDB model; the API owns the pure planting-schedule calculation; the website renders it with Tailwind Plus components.

**Tech Stack:** Python 3 + uv, PynamoDB, FastAPI + Pydantic v2, AWS Lambda Powertools, pytest; React 19 + TanStack Router/Query, Tailwind 4, `@headlessui/react`, `@heroicons/react`, Vitest + Testing Library; Terraform (AWS provider 6.66.0), checkov.

**Spec:** `docs/superpowers/specs/2026-11-07-stardew-valley-helper-design.md`

## Global Constraints

- Branch `feat/stardew-valley-helper`. Never modify existing files except the additive list in spec §3; if a generator modifies anything else (`packages/infra/**`, `packages/website/**`, `.github/**`, existing `packages/common/terraform/src/{core,app}/*` modules), revert that hunk and report it.
- Never edit `.claude/` or `.obsidian/`.
- Code, docs, identifiers and commit messages in **English**; UI copy in **pt-BR**.
- DynamoDB attribute names, API JSON fields and query params are **camelCase** (Python code stays snake_case, mapped with `attr_name` / Pydantic `alias_generator=to_camel`). Keys `pk`, `sk`, `gsi1pk`, `gsi1sk`, `gsi2pk`, `gsi2sk` keep the generator names. Discriminator attribute: `entityType`.
- No secrets, no PII in code, fixtures, logs. Fixtures use fictitious ids (e.g. `test-seed`). Logging only via Powertools structured JSON `Logger`; never log the Cognito sub.
- Game prices are integer gold; `averageForageValue` / `averageExtraYield` stay `Number` with decimals (user decision).
- Frontend: Tailwind utility classes only; components adapted from `/home/danhenrique/projects/.tailwind/application-ui-v4/react/...` keep their classes; icons from `@heroicons/react` (24/outline or 20/solid as in the source component); icon-only buttons have `aria-label` and identical `title` in pt-BR.
- Every website form field is a selection control (select menu, combobox, radio group, toggle); the only free-text input is the optional planting `label`.
- Run tasks via Nx: `pnpm nx run <project>:<target>`.
- Infra: prod only, `aws_region = "sa-east-1"`, `domain_name = "danhenrique.com.br"`, site at `stardew.danhenrique.com.br`, `enable_waf = false` on website, API and user identity.
- Never run `terraform apply`, `destroy`, or the import against AWS without the user's explicit confirmation at that moment.

**Project/module names:** Task 1 records the real names produced by the generators in `packages/stardew-valley/README.md`. Below, `DB_PROJECT`/`DB_MODULE` (expected `stardew_valley_db`), `API_PROJECT`/`API_MODULE` (`stardew_valley_api`), `WEB_PROJECT` (`@aws-danhenrique/stardew-valley-helper-website`), `INFRA_PROJECT` (`@aws-danhenrique/stardew-valley-infra`), the API client hook `useStardewValleyApi` and the generated API Terraform module dir `stardew-valley-api` mean those recorded values.

## Review Focus

1. **Plantings owned by someone else** — `PUT/DELETE /me/plantings/{id}` with another player's id must return 404 (key is always `PLAYER#<caller sub>`), never touch the other item. Test in Task 8.
2. **Day 28 / year rollover** — a regrowing crop crossing Winter 28 → Spring 1 of the next year (greenhouse) and `GameDate` round-trips at `abs` 112/113. Test in Task 6.
3. **Re-running the import** — a second run writes the same keys (no duplicates) and a dataset with one invalid file writes nothing. Test in Task 5.
4. **Profile not set yet** — `GET /me` for a new player returns a default profile (Year 1, Spring 1, not Agriculturist) instead of 404, and plantings still compute. Test in Task 8.
5. **Seed without `crop` / unknown seed** — `POST /me/plantings` with `acorn`-like items (no `crop`, no `fruitTree`) or a nonexistent id returns 422/404, never 500. Test in Task 8.

---

### Task 1: Scaffold the four projects and connections

**Files:**
- Create (via generators): `packages/stardew-valley/{db,api,website,infra}/**`, new modules under `packages/common/terraform/src/app/**` and missing `core/**`, `packages/common/scripts/**`, root `pyproject.toml`, `uv.lock`, `.python-version`
- Modify (additive only): `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `nx.json` (if touched)
- Create: `packages/stardew-valley/README.md`

**Interfaces:**
- Produces: the projects and names listed in Global Constraints; generated `BaseModel` in `DB_MODULE/entities/base.py`; FastAPI `app`, `logger`, `tracer` in `API_MODULE/init.py`; `useStardewValleyApi` hook in the website.

- [ ] **Step 1: Add the workspace glob.** In `pnpm-workspace.yaml` add `- packages/stardew-valley/*` under `packages:` (additive).
- [ ] **Step 2: Run the generators in this order, with `--preferInstallDependencies=false` except the last:**

```bash
pnpm nx g @aws/nx-plugin:py#dynamodb --no-interactive --name=stardew-valley-db --directory=packages/stardew-valley --subDirectory=db --tableName=stardew-valley-db --framework=pynamodb --infra=dynamodb --iac=terraform --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:py#api --no-interactive --name=stardew-valley-api --moduleName=stardew_valley_api --directory=packages/stardew-valley --subDirectory=api --framework=fastapi --infra=rest-lambda --integrationPattern=isolated --auth=iam --iac=terraform --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:ts#website --no-interactive --name=stardew-valley-helper-website --directory=packages/stardew-valley --subDirectory=website --framework=react --ux=none --tailwind=true --tanstackRouter=true --infra=cloudfront-s3 --iac=terraform --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:ts#website#auth --no-interactive --project=packages/stardew-valley/website --allowSignup=true --iac=terraform --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:terraform#project --no-interactive --name=stardew-valley-infra --type=application --directory=packages/stardew-valley --subDirectory=infra --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:connection --no-interactive --sourceProject=<API_PROJECT> --targetProject=<DB_PROJECT> --preferInstallDependencies=false
pnpm nx g @aws/nx-plugin:connection --no-interactive --sourceProject=<WEB_PROJECT> --targetProject=<API_PROJECT>
```

(Take `<…_PROJECT>` from `pnpm nx show projects` after the earlier generators.)

- [ ] **Step 3: Audit the diff.** Run `git status --porcelain` and `git diff --stat`. Expected: only new paths plus additive changes to the files listed above. Revert any other hunk (`git checkout -p <file>`) and note it for the user.
- [ ] **Step 4: Record names.** Write `packages/stardew-valley/README.md`: one-paragraph overview, table of project name / Python module / path for the four projects, the website dev/preview ports from its `project.json`, and the data-license notice from spec §12.
- [ ] **Step 5: Verify builds.** Run `pnpm nx run-many -t build -p <DB_PROJECT>,<API_PROJECT>,<WEB_PROJECT>` and `pnpm nx run <INFRA_PROJECT>:validate`. Expected: all succeed on the untouched scaffold.
- [ ] **Step 6: Commit** — `feat(stardew-valley): scaffold db, api, website and infra projects`.

---

### Task 2: Game core entities

**Files:**
- Modify: `packages/stardew-valley/db/DB_MODULE/entities/base.py` (discriminator `attr_name="entityType"`)
- Delete: `entities/example.py` and its export
- Create: `entities/keys.py`, `entities/attributes.py`, `entities/game.py`, update `entities/__init__.py`
- Test: `packages/stardew-valley/db/tests/test_game_entities.py`

**Interfaces:**
- Produces (`keys.py`): `SEASONS: tuple[str, ...] = ("spring","summer","fall","winter")`; `SEASON_INDEX: dict[str,int]`; `ITEM_FOLDERS: frozenset[str]` (the 29 item folders of spec §5.1); `entity_pk(prefix: str, entity_id: str) -> str` (`f"{prefix}#{entity_id}"`); `type_gsi1pk(folder: str) -> str` (`f"TYPE#{folder}"`).
- Produces (`attributes.py`): `LocalizedText(MapAttribute)` with `en` and `pt_br` (`attr_name="ptBr"`, nullable); `CropAttribute(MapAttribute)` with `seasons`, `growth_days`, `phases` (nullable list of numbers), `regrow_days` (nullable), `last_planting_day` (nullable), `average_extra_yield`, `produce`, `notes` (nullable) — all camelCase `attr_name`; `FruitTreeAttribute(MapAttribute)` with `fruit`, `season`, `days_to_mature`, `fruits_per_day`, `max_fruit_on_tree`.
- Produces (`game.py`): classes `Item, Villager, Shop, Building, Animal, Festival, Bundle, Category, Movie, Achievement, MonsterGoal, Collection, Perfection, UniversalGifts, GameMeta`, each a `BaseModel` subclass with the attributes of spec §5.1, common fields `entity_id` (`entityId`), `name: LocalizedText`, `name_verified` (`nameVerified`), and a classmethod `build(**fields) -> Self` that fills `pk`, `sk`, `gsi1pk`, `gsi1sk` per spec §5.1 (`sk` = upper-snake entity name, e.g. `ITEM`, `MONSTER_GOAL`). Sub-structures other than crop/fruit tree (`schedule`, `catch`, `processing`, `categories`, `artisan`, `materials`…) are untyped `MapAttribute`/`ListAttribute` holding camelCase keys.
- Pk prefixes: `ITEM, VILLAGER, SHOP, BUILDING, ANIMAL, FESTIVAL, BUNDLE, CATEGORY, MOVIE, ACHIEVEMENT, MONSTER_GOAL, COLLECTION, PERFECTION, META`; `UniversalGifts` pk is the literal `UNIVERSAL_GIFTS`, sk `UNIVERSAL_GIFTS`.

- [ ] **Step 1: Write failing tests** (serialization only, no network — use `model.serialize()`):

```python
def test_item_keys_and_camel_case_attributes():
    item = Item.build(entity_id="test-seed", item_type="sementes", name=LocalizedText(en="Test Seed", pt_br=None),
                      name_verified=False, crop=CropAttribute(seasons=["spring"], growth_days=8, phases=[1,1,2,2,2],
                      regrow_days=4, last_planting_day=20, average_extra_yield=0.02, produce="test-fruit"))
    data = item.serialize()
    assert data["pk"] == {"S": "ITEM#test-seed"} and data["sk"] == {"S": "ITEM"}
    assert data["gsi1pk"] == {"S": "TYPE#sementes"} and data["gsi1sk"] == {"S": "test-seed"}
    assert data["entityType"] == {"S": "Item"}
    assert "growthDays" in data["crop"]["M"] and "regrowDays" in data["crop"]["M"]
    assert "itemType" in data and "nameVerified" in data

def test_festival_gsi1sk_sorts_by_calendar():
    assert Festival.build(entity_id="f", name=..., name_verified=True, season="summer", start_day=9, end_day=9, shops_closed=True).gsi1sk == "1#09"

def test_achievement_gsi1sk_is_zero_padded_order():
    assert Achievement.build(entity_id="a", name=..., name_verified=True, description=..., order=7).gsi1sk == "007"

def test_bundle_gsi1sk_groups_by_room():
    assert Bundle.build(entity_id="b", name=..., name_verified=True, room={"id": "pantry", "name": {...}}, quality="gold", remixed=False, slots_required=3).gsi1sk == "pantry#b"

def test_universal_gifts_and_meta_keys():
    assert UniversalGifts.build(...).pk == "UNIVERSAL_GIFTS"
    assert GameMeta.build(entity_id="enums", payload={...}).pk == "META#enums"
```

- [ ] **Step 2: Run** `pnpm nx run <DB_PROJECT>:test` — expected FAIL (imports missing).
- [ ] **Step 3: Implement** `keys.py`, `attributes.py`, `game.py`, set the discriminator `attr_name`, remove the example entity.
- [ ] **Step 4: Run** `pnpm nx run <DB_PROJECT>:test` — expected PASS.
- [ ] **Step 5: Commit** — `feat(stardew-valley-db): add game core entities`.

---

### Task 3: Relationship and player entities

**Files:**
- Create: `entities/relations.py`, `entities/player.py`; update `entities/__init__.py`
- Test: `packages/stardew-valley/db/tests/test_relations.py`, `tests/test_player.py`

**Interfaces:**
- Consumes: `entity_pk`, `BaseModel` from Task 2.
- Produces (`relations.py`), each with `build(...) -> Self` filling keys exactly as spec §5.2:
  - `GiftTaste.build(owner_pk: str, tier: str, target_kind: Literal["ITEM","CATEGORY"], target_id: str, except_ids: list[str] | None)`; `owner_pk` is `VILLAGER#<v>` or `UNIVERSAL_GIFTS`; `tier ∈ {"loves","likes","neutral","dislikesOrHates"}`; gsi2sk owner part is `VILLAGER#<v>` or `UNIVERSAL`.
  - `MovieTaste.build(villager_id, level: Literal["loved","liked"], target_kind: Literal["MOVIE","ITEM"], target_id)`.
  - `ShopOffer.build(shop_id, item_id, index: int, **offer_fields)` — sk `OFFER#ITEM#<item>#<index:02>`.
  - `Recipe.build(result_id, kind: Literal["crafting","cooking"], ingredients, alternatives=None, note=None)`.
  - `Ingredient.build(result_id, kind, item_id, qty)` — sk `INGREDIENT#<kind>#ITEM#<item>`, gsi2 `ITEM#<item>` / `USED_IN#ITEM#<result>`.
  - `Produces.build(origin_id, product_id, via: Literal["crop","fruit_tree","machine"], days: int | None)`.
  - `Member.build(owner_kind: Literal["CATEGORY","COLLECTION"], owner_id, item_id)`.
  - `BundleRequirement.build(bundle_id, index: int, item_id: str | None, qty=None, gold=None, rain_only=None, seasons=None)` — `item_id=None` → sk `REQUIRES#<index:02>#GOLD`, no gsi2.
- Produces (`player.py`): `GameDateAttribute(MapAttribute)` (`year`, `season`, `day`); `PlayerProfile` (pk `PLAYER#<sub>`, sk `PROFILE`, `agriculturist`, `current_date` → `currentDate`, `updated_at` → `updatedAt`) with `get_or_default(player_id) -> PlayerProfile` (default Year 1, spring, day 1, `agriculturist=False`, not saved); `Planting` (pk `PLAYER#<sub>`, sk `PLANTING#<ulid>`, attrs from spec §5.3 incl. `anchor` (`planted|harvested`, default `planted`), nullable `planted_on` → `plantedOn` and nullable `last_harvest_on` → `lastHarvestOn`; exactly one of them is set) with `new(player_id, **fields) -> Planting` (generates a ULID via `python-ulid`, add with `pnpm nx run <DB_PROJECT>:add python-ulid`); `list_for_player(player_id) -> tuple[PlayerProfile | None, list[Planting]]` doing one `BaseModel.query("PLAYER#<sub>")`.

- [ ] **Step 1: Write failing tests** — one per `build` asserting `pk`, `sk`, `gsi2pk`, `gsi2sk` with spec §5.2 values, e.g.:

```python
def test_gift_taste_keys_villager_item():
    g = GiftTaste.build(owner_pk="VILLAGER#test-villager", tier="loves", target_kind="ITEM", target_id="test-item", except_ids=None)
    assert (g.pk, g.sk) == ("VILLAGER#test-villager", "GIFT#loves#ITEM#test-item")
    assert (g.gsi2pk, g.gsi2sk) == ("ITEM#test-item", "GIFT#loves#VILLAGER#test-villager")

def test_gift_taste_universal_category_with_except():
    g = GiftTaste.build(owner_pk="UNIVERSAL_GIFTS", tier="likes", target_kind="CATEGORY", target_id="cooking", except_ids=["bread"])
    assert g.gsi2pk == "CATEGORY#cooking" and g.gsi2sk == "GIFT#likes#UNIVERSAL"
    assert g.serialize()["except"] == {"L": [{"S": "bread"}]}

def test_shop_offer_index_is_two_digits():
    assert ShopOffer.build("test-shop", "test-item", 3, price=100).sk == "OFFER#ITEM#test-item#03"

def test_bundle_gold_requirement_has_no_gsi2():
    r = BundleRequirement.build("test-bundle", 0, None, gold=2500)
    assert r.sk == "REQUIRES#00#GOLD" and r.gsi2pk is None

def test_planting_keys_and_camel_case():
    p = Planting.new("test-sub", seed_id="test-seed", planted_on=GameDateAttribute(year=1, season="spring", day=1),
                     fertilizer="none", location="farm", quantity=3, label=None)
    assert p.pk == "PLAYER#test-sub" and p.sk.startswith("PLANTING#")
    assert {"seedId", "plantedOn", "createdAt"} <= set(p.serialize())

def test_profile_default_when_missing():  # uses DynamoDB Local fixture (see Step 2)
    prof = PlayerProfile.get_or_default("missing-sub")
    assert (prof.current_date.year, prof.current_date.season, prof.current_date.day, prof.agriculturist) == (1, "spring", 1, False)
```

- [ ] **Step 2: Add a DynamoDB Local pytest fixture** in `packages/stardew-valley/db/tests/conftest.py`: session fixture `local_table` that sets `LOCAL_DEV=true`, skips with `pytest.skip("DynamoDB Local not running")` if `config.json`'s `localDev` endpoint is unreachable, creates the table via `BaseModel.create_table(wait=True)` if missing, and deletes all items after each test. Mark tests needing it `@pytest.mark.integration`.
- [ ] **Step 3: Run** `pnpm nx run <DB_PROJECT>:test` — expected FAIL.
- [ ] **Step 4: Implement** `relations.py` and `player.py`.
- [ ] **Step 5: Run** unit tests, then start `pnpm nx dev <DB_PROJECT>` in another shell and rerun — expected PASS including integration tests.
- [ ] **Step 6: Commit** — `feat(stardew-valley-db): add relationship and player entities`.

---

### Task 4: Dataset conversion (pure)

**Files:**
- Create: `packages/stardew-valley/db/DB_MODULE/importer/__init__.py`, `importer/load.py`, `importer/convert.py`
- Test: `packages/stardew-valley/db/tests/test_convert.py`, fixtures in `tests/fixtures/data/<folder>/*.json` (fictitious, one or two files per shape: seed with crop, sapling, fruit, villager with gifts + movieTheater, shop with offers incl. `priceByYear` and `currency`, cooking dish with `cookingRecipe` and `category` ingredient, machine with `processing`, category, collection, bundle with a gold entry, festival, achievement, `presentes/universais.json`, `_meta/enums.json`, `_meta/locales.json`, `_meta/index.json`)

**Interfaces:**
- Consumes: all entity `build` methods (Tasks 2–3), `ITEM_FOLDERS`.
- Produces:
  - `class ImportValidationError(Exception)` with `path: Path` and `reason: str`.
  - `load_dataset(data_dir: Path) -> dict[str, list[dict]]` — reads every `<folder>/*.json`; skips `README.md`, `_meta/index.json`, `_meta/pending-translations.json`; raises `ImportValidationError` if a file is not valid JSON, lacks `id`, or (outside `_meta`) has `type != folder`. Validates **all** files before returning.
  - `@dataclass ConversionResult: models: list[BaseModel]; diffs: list[str]`.
  - `convert_dataset(dataset: dict[str, list[dict]]) -> ConversionResult` — rules of spec §5.5: i18n `pt-BR` → `ptBr`; item folders → `Item` (+ `Recipe`/`Ingredient` from `craftingRecipe`/`cookingRecipe`, `Produces` from `crop.produce`, `fruitTree.fruit`, `processing[].output`); villagers → `Villager` + `GiftTaste` (tiers `loves/likes/neutral/dislikesOrHates`; entries `{"item"}`, `{"category","except"}` or plain strings) + `MovieTaste`; `presentes/universais` → `UniversalGifts` + `GiftTaste`; shops → `Shop` + `ShopOffer` (index = position in `offers`); `categorias` and `colecoes` (`members`, `artifacts`, `minerals`) → `Member`; `pacotes` → `Bundle` + `BundleRequirement`; other folders → their entity; `_meta/enums|locales` → `GameMeta`.
  - Mirror comparison: item `giftTastes` vs villager gifts and item `soldAt` vs shop offers produce human-readable `diffs` entries (`"gift mismatch: <item> <tier> <villager>"`, `"soldAt without shop offer: <item> @ <shop>"`); a `soldAt` with no matching offer (same shop + item) also yields a `ShopOffer` with the next free index.

- [ ] **Step 1: Write failing tests**, e.g.:

```python
def test_load_rejects_type_mismatch(tmp_path):
    write(tmp_path / "frutas/x.json", {"id": "x", "type": "vegetais"})
    with pytest.raises(ImportValidationError) as e: load_dataset(tmp_path)
    assert "frutas/x.json" in str(e.value.path)

def test_load_skips_index_and_pending_translations(): ...  # fixture dir loads without those keys

def test_seed_becomes_item_with_crop_and_produces_relation():
    res = convert_dataset(load_dataset(FIXTURES))
    seed = find(res, Item, "test-seed")
    assert seed.crop.growth_days == 8 and seed.crop.regrow_days == 4
    assert find_rel(res, Produces, pk="ITEM#test-seed", sk="PRODUCES#ITEM#test-fruit").via == "crop"

def test_localized_name_uses_ptBr():
    assert find(res, Item, "test-fruit").name.pt_br == "Fruta Teste"

def test_villager_gifts_category_with_except_and_plain_string_tier(): ...
def test_shop_offers_keep_order_and_price_by_year(): ...
def test_cooking_recipe_creates_recipe_and_ingredients_skipping_category_ingredient_for_gsi2(): ...
def test_bundle_gold_entry_has_gold_requirement(): ...
def test_sold_at_without_shop_offer_creates_offer_and_diff(): ...
def test_every_model_key_is_unique():
    keys = [(m.pk, m.sk) for m in res.models]; assert len(keys) == len(set(keys))
```

- [ ] **Step 2: Run** `pnpm nx run <DB_PROJECT>:test` — expected FAIL.
- [ ] **Step 3: Implement** `load.py` and `convert.py` (one small converter function per folder group, dispatched from a dict keyed by folder).
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Smoke against the real data** (read-only): `uv run python -I -c "from pathlib import Path; from DB_MODULE.importer.load import load_dataset; from DB_MODULE.importer.convert import convert_dataset; r=convert_dataset(load_dataset(Path('../../stardew-valley/game-data/data'))); print(len(r.models), len(r.diffs))"` from the workspace root. Expected: no exception; models > 1073.
- [ ] **Step 6: Commit** — `feat(stardew-valley-db): convert game data to single-table entities`.

---

### Task 5: Import CLI and Nx target

**Files:**
- Create: `packages/stardew-valley/db/DB_MODULE/importer/cli.py`
- Modify: `packages/stardew-valley/db/project.json` (add `import` target)
- Test: `packages/stardew-valley/db/tests/test_import_cli.py`

**Interfaces:**
- Consumes: `load_dataset`, `convert_dataset`, `ImportValidationError`.
- Produces: `main(argv: list[str] | None = None) -> int` — args `--data-dir` (default `<workspace root>/../../stardew-valley/game-data/data`, resolved from the file location) and `--dry-run`; loads + converts everything first, then writes with `BaseModel.batch_write()` (25-item chunks handled by PynamoDB); logs counts per `entityType` and each diff via Powertools `Logger(service="stardew-valley-import")`; returns `0` on success, `1` on `ImportValidationError` (nothing written).
- `import` target: `nx:run-commands`, `cwd` = project root, command `uv run python -m DB_MODULE.importer.cli`, `forwardAllArgs: true`, no cache. Locally it uses DynamoDB Local when `LOCAL_DEV=true`; against AWS it needs `RUNTIME_CONFIG_APP_ID` (document in the project README how to get it from `terraform output`).

- [ ] **Step 1: Write failing integration tests** (`@pytest.mark.integration`, `local_table` fixture):

```python
def test_import_writes_fixtures_and_is_idempotent():
    assert main(["--data-dir", str(FIXTURES)]) == 0
    first = count_items(); assert main(["--data-dir", str(FIXTURES)]) == 0
    assert count_items() == first

def test_invalid_file_writes_nothing(tmp_path):
    copy_fixtures(tmp_path); write(tmp_path / "frutas/broken.json", "{not json")
    assert main(["--data-dir", str(tmp_path)]) == 1
    assert count_items() == 0

def test_dry_run_writes_nothing():
    assert main(["--data-dir", str(FIXTURES), "--dry-run"]) == 0 and count_items() == 0
```

- [ ] **Step 2: Run** with DynamoDB Local up — expected FAIL.
- [ ] **Step 3: Implement** `cli.py` and the `import` target.
- [ ] **Step 4: Run tests** — expected PASS. Then `LOCAL_DEV=true pnpm nx run <DB_PROJECT>:import` against DynamoDB Local with the real data — expected exit 0 and logged counts.
- [ ] **Step 5: Commit** — `feat(stardew-valley-db): add one-shot game data import`.

---

### Task 6: Schedule calculation (pure)

**Files:**
- Create: `packages/stardew-valley/api/stardew_valley_api/schedule.py`
- Test: `packages/stardew-valley/api/tests/test_schedule.py`

**Interfaces:**
- Produces:
  - `Season = Literal["spring","summer","fall","winter"]`; `Fertilizer = Literal["none","speed-gro","deluxe-speed-gro","hyper-speed-gro"]`; `Location = Literal["farm","greenhouse","ginger-island"]`; `Status = Literal["growing","ready","regrowing","finished","dead"]`.
  - `FERTILIZER_SPEED_PCT: dict[str,int] = {"none": 0, "speed-gro": 10, "deluxe-speed-gro": 25, "hyper-speed-gro": 33}`; `AGRICULTURIST_PCT = 10`; `GREENHOUSE_HARVEST_LIMIT = 10`.
  - `@dataclass(frozen=True) GameDate(year: int, season: Season, day: int)` with `to_abs() -> int` (`(year-1)*112 + idx*28 + day`) and `@classmethod from_abs(abs_day: int) -> GameDate`; raises `ValueError` for `day ∉ 1..28` or `year < 1`.
  - `@dataclass(frozen=True) CropSpec(seasons: list[Season], growth_days: int, phases: list[int] | None, regrow_days: int | None)`; `@dataclass(frozen=True) FruitTreeSpec(season: Season, days_to_mature: int, max_fruit_on_tree: int)`.
  - `@dataclass Schedule(first_harvest: GameDate | None, harvests: list[GameDate], total_harvests: int, infinite: bool, dies_on: GameDate | None, status: Status, days_until_next: int | None, approximate: bool, warnings: list[str])`.
  - `class OutOfSeasonError(ValueError)`.
  - `effective_growth_days(crop: CropSpec, speed_pct: int) -> tuple[int, bool]` (days, approximate).
  - `crop_schedule(crop, planted_on: GameDate, fertilizer: Fertilizer, agriculturist: bool, location: Location, today: GameDate) -> Schedule`.
  - `fruit_tree_schedule(tree, planted_on: GameDate, location: Location, today: GameDate) -> Schedule`.
  - `class NotRegrowingError(ValueError)`.
  - `regrow_schedule(crop: CropSpec, last_harvest_on: GameDate, location: Location, today: GameDate) -> Schedule` — spec §6 "From a known harvest": raises `NotRegrowingError` if `crop.regrow_days is None`, `OutOfSeasonError` on farm if `last_harvest_on.season ∉ crop.seasons`; `first_harvest = last_harvest_on`; `harvests` = `last_harvest_on` followed by every `regrow_days` until death (greenhouse/island: `GREENHOUSE_HARVEST_LIMIT` upcoming, `infinite=True`); `total_harvests` = number of harvests after `last_harvest_on`.

Growth algorithm (integer math, no floats):

```python
days_to_remove = -(-sum(phases) * speed_pct // 100)   # ceil
phases = list(phases); passes = 0
while days_to_remove > 0 and passes < 3:
    for i, p in enumerate(phases):
        if (i == 0 and p > 1) or (i > 0 and p > 0):
            phases[i] -= 1; days_to_remove -= 1
        if days_to_remove <= 0: break
    passes += 1
# without phases: growth_days - ceil(growth_days * speed_pct / 100), approximate = speed_pct > 0
```

Season rules: farm → planting season must be in `crop.seasons` else `OutOfSeasonError`; death = day 1 of the first following season (consecutive, wrapping to next year) not in `crop.seasons`; harvests on/after death are dropped; first harvest on/after death → `harvests=[]`, warning `"will_not_mature"`. Greenhouse / Ginger Island: no death, regrowing crops return `GREENHOUSE_HARVEST_LIMIT` harvests and `infinite=True`. Fruit trees: any planting season; mature = planted + `days_to_mature`; harvests = first 10 fruiting days on/after maturity (farm: only days in `tree.season`; greenhouse/island: every day), `infinite=True`. Status vs `today`: before first harvest → `growing` (`days_until_next` = first − today); on a harvest day → `ready` (0); between harvests → `regrowing` (next − today); after last harvest and before death (or no death) → `finished`; on/after `dies_on` → `dead`; `days_until_next=None` for finished/dead.

- [ ] **Step 1: Write failing tests** with these exact expectations:

```python
S = lambda season, day, year=1: GameDate(year, season, day)
STRAWBERRY = CropSpec(["spring"], 8, [1,1,2,2,2], 4)
CAULIFLOWER = CropSpec(["spring"], 12, [1,2,4,5], None)
COFFEE = CropSpec(["spring","summer"], 10, [1,2,2,3,2], 2)
ANCIENT = CropSpec(["spring","summer","fall"], 28, None, 7)
GREEN_BEAN = CropSpec(["spring"], 10, [1,1,1,3,4], 3)

def test_game_date_roundtrip_year_boundary():
    assert S("winter", 28).to_abs() == 112 and GameDate.from_abs(113) == S("spring", 1, 2)

def test_strawberry_regrows_until_season_end():
    s = crop_schedule(STRAWBERRY, S("spring",1), "none", False, "farm", S("spring",1))
    assert s.first_harvest == S("spring",9)
    assert s.harvests == [S("spring",d) for d in (9,13,17,21,25)] and s.total_harvests == 5
    assert s.dies_on == S("summer",1) and s.status == "growing" and s.days_until_next == 8

def test_cauliflower_speed_gro_and_agriculturist():
    assert effective_growth_days(CAULIFLOWER, 10) == (10, False)
    assert effective_growth_days(CAULIFLOWER, 20) == (9, False)

def test_hyper_speed_gro_with_agriculturist_on_strawberry():
    assert effective_growth_days(STRAWBERRY, 43) == (4, False)

def test_deluxe_on_green_bean_phase_removal():
    assert effective_growth_days(GREEN_BEAN, 25) == (7, False)

def test_coffee_crosses_spring_into_summer():
    s = crop_schedule(COFFEE, S("spring",1), "none", False, "farm", S("spring",1))
    assert s.harvests[0] == S("spring",11) and S("summer",1) in s.harvests
    assert s.harvests[-1] == S("summer",27) and s.dies_on == S("fall",1) and s.total_harvests == 23

def test_cauliflower_last_planting_day_and_one_day_late():
    assert crop_schedule(CAULIFLOWER, S("spring",16), "none", False, "farm", S("spring",16)).harvests == [S("spring",28)]
    late = crop_schedule(CAULIFLOWER, S("spring",17), "none", False, "farm", S("spring",17))
    assert late.harvests == [] and "will_not_mature" in late.warnings

def test_out_of_season_on_farm_raises():
    with pytest.raises(OutOfSeasonError): crop_schedule(STRAWBERRY, S("summer",1), "none", False, "farm", S("summer",1))

def test_ancient_fruit_greenhouse_infinite_and_crosses_year():
    s = crop_schedule(ANCIENT, S("winter",1), "none", False, "greenhouse", S("winter",1))
    assert s.first_harvest == S("spring",1,2) and s.infinite and len(s.harvests) == 10 and s.dies_on is None

def test_no_phases_with_speed_is_approximate():
    assert effective_growth_days(ANCIENT, 10) == (25, True)

def test_status_transitions():
    plant = S("spring",1)
    assert crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring",9)).status == "ready"
    r = crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring",10))
    assert (r.status, r.days_until_next) == ("regrowing", 3)
    assert crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring",26)).status == "finished"
    assert crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("summer",1)).status == "dead"

def test_regrow_from_known_harvest():
    s = regrow_schedule(STRAWBERRY, S("spring",13), "farm", S("spring",14))
    assert s.harvests == [S("spring",d) for d in (13,17,21,25)] and s.total_harvests == 3
    assert s.dies_on == S("summer",1) and (s.status, s.days_until_next) == ("regrowing", 3)

def test_regrow_from_harvest_rejects_non_regrowing_crop():
    with pytest.raises(NotRegrowingError): regrow_schedule(CAULIFLOWER, S("spring",20), "farm", S("spring",20))

def test_regrow_from_harvest_greenhouse_is_infinite():
    s = regrow_schedule(ANCIENT, S("winter",20), "greenhouse", S("winter",20))
    assert s.infinite and s.harvests[1] == S("winter",27) and s.harvests[2] == S("spring",6,2)

def test_fruit_tree_matures_and_fruits_in_season():
    tree = FruitTreeSpec("fall", 28, 3)
    s = fruit_tree_schedule(tree, S("summer",1), "farm", S("summer",1))
    assert s.first_harvest == S("fall",1) and s.harvests[:2] == [S("fall",1), S("fall",2)] and s.infinite

def test_fruit_tree_greenhouse_fruits_right_after_maturity():
    s = fruit_tree_schedule(FruitTreeSpec("fall", 28, 3), S("spring",1), "greenhouse", S("spring",1))
    assert s.first_harvest == S("summer",1)
```

- [ ] **Step 2: Run** `pnpm nx run <API_PROJECT>:test` — expected FAIL.
- [ ] **Step 3: Implement** `schedule.py`.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Add data cross-check test** `test_last_planting_day_matches_dataset` (integration, after a local import): for every `Item` with `crop.phases` and a single season, `28 - effective_growth_days(spec, 0)[0] == crop.last_planting_day`.
- [ ] **Step 6: Commit** — `feat(stardew-valley-api): add planting schedule calculation`.

---

### Task 7: API models, identity and game read endpoints

**Files:**
- Create: `api/stardew_valley_api/models.py`, `api/stardew_valley_api/identity.py`, `api/stardew_valley_api/routes/game.py`
- Modify: `api/stardew_valley_api/main.py` (remove the generated example route; include routers)
- Test: `api/tests/test_game_routes.py`, `api/tests/test_identity.py`

**Interfaces:**
- Consumes: DB entities (Tasks 2–3), `app`, `tracer` from `init.py`.
- Produces:
  - `models.py`: `CamelModel(BaseModel)` with `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)`; `LocalizedTextOut(en: str, pt_br: str | None)`; `GameEntityOut(type: str, id: str, name: LocalizedTextOut | None, name_verified: bool | None, attributes: dict[str, Any])`; `RelationOut(kind: str, pk: str, sk: str, attributes: dict[str, Any])`; `GameEntityDetailOut(GameEntityOut + relations: list[RelationOut])`; `PlantableOut(id, name, kind: Literal["crop","fruit_tree"], seasons: list[Season], growth_days: int | None, regrow_days: int | None, days_to_mature: int | None)`; `GameDateIn/Out(year: int >= 1, season: Season, day: 1..28)`.
  - `identity.py`: `get_player_id(request: Request) -> str` — parses `x-amzn-request-context` JSON, `identity.cognitoAuthenticationProvider`, takes the segment after the last `:`; raises `HTTPException(403, "Unable to determine calling user")` if absent; `PlayerId = Annotated[str, Depends(get_player_id)]`. Locally (`LOCAL_DEV=true` and no header) returns `"local-dev-player"`.
  - Routes (function names = client operation names):
    - `GET /game/{type}` → `list_game_entities(type: str) -> list[GameEntityOut]` (gsi1 query; 404 for unknown folder).
    - `GET /game/{type}/{id}` → `get_game_entity(type, id) -> GameEntityDetailOut` (pk query; 404 if missing or `itemType != type`).
    - `GET /game/items/{id}/references` → `get_item_references(id, prefix: str | None = None) -> list[RelationOut]` (gsi2 query, optional `begins_with` on gsi2sk).
    - `GET /plantables?season=&location=` → `list_plantables(season: Season | None, location: Location = "farm") -> list[PlantableOut]` — `sementes` with `crop` + `arvores-frutiferas`; on farm with `season`, only crops whose `seasons` contain it (trees always). Refines spec §7's season filter.

- [ ] **Step 1: Write failing tests** with FastAPI `TestClient` + `local_table` fixture seeded via the Task 5 importer on the test fixtures:

```python
def test_list_seeds_returns_camel_case():
    body = client.get("/game/sementes").json()
    assert body[0]["nameVerified"] in (True, False) and "growthDays" in body[0]["attributes"]["crop"]

def test_unknown_type_is_404(): assert client.get("/game/not-a-folder").status_code == 404
def test_item_detail_includes_relations():
    rel_kinds = {r["kind"] for r in client.get("/game/sementes/test-seed").json()["relations"]}
    assert "Produces" in rel_kinds
def test_item_detail_wrong_type_is_404(): assert client.get("/game/frutas/test-seed").status_code == 404
def test_references_filtered_by_prefix():
    refs = client.get("/game/items/test-item/references", params={"prefix": "GIFT#"}).json()
    assert refs and all(r["attributes"]["gsi2sk"].startswith("GIFT#") for r in refs)
def test_plantables_filters_by_season_on_farm_but_not_greenhouse(): ...
def test_identity_parses_sub_from_request_context():  # unit, no table
    ctx = {"identity": {"cognitoAuthenticationProvider": "cognito-idp.sa-east-1.amazonaws.com/pool,cognito-idp.sa-east-1.amazonaws.com/pool:CognitoSignIn:test-sub"}}
    assert get_player_id(fake_request(ctx)) == "test-sub"
def test_identity_missing_header_is_403(monkeypatch): ...  # LOCAL_DEV unset
```

- [ ] **Step 2: Run** `pnpm nx run <API_PROJECT>:test` — expected FAIL.
- [ ] **Step 3: Implement** models, identity and routes; every route declares `response_model` and uses `@tracer.capture_method`.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** — `feat(stardew-valley-api): add game catalog endpoints`.

---

### Task 8: Player endpoints and schedule preview

**Files:**
- Create: `api/stardew_valley_api/routes/player.py`, `api/stardew_valley_api/schedule_service.py`
- Test: `api/tests/test_player_routes.py`

**Interfaces:**
- Consumes: `PlayerId`, `crop_schedule`, `fruit_tree_schedule`, `OutOfSeasonError`, `PlayerProfile`, `Planting`, `Item`.
- Produces:
  - `models.py` additions: `ProfileIn/Out(current_date: GameDate, agriculturist: bool)`; `PlantingIn(seed_id: str, anchor: Literal["planted","harvested"] = "planted", planted_on: GameDateIn | None, last_harvest_on: GameDateIn | None, fertilizer: Fertilizer, location: Location, quantity: int 1..99, label: str | None max 60)`; `ScheduleOut` (all `Schedule` fields, camelCase); `PlantingOut(id: str, …PlantingIn fields, schedule: ScheduleOut)`; `MeOut(profile: ProfileOut, plantings: list[PlantingOut])`; `SchedulePreviewIn(PlantingIn + agriculturist: bool, today: GameDateIn)`.
  - `PlantingIn` model validator: `anchor=planted` requires `planted_on` and no `last_harvest_on`; `anchor=harvested` requires `last_harvest_on` and no `planted_on`, and forces `fertilizer="none"` (else 422).
  - `schedule_service.py`: `schedule_for(seed_id: str, anchor, planted_on, last_harvest_on, fertilizer, agriculturist, location, today) -> Schedule` (dispatches to `crop_schedule`, `regrow_schedule` or `fruit_tree_schedule`; `NotRegrowingError` and fruit trees with `anchor=harvested` → 422 `"Only regrowing crops can start from a harvest date"`) — loads `Item` `ITEM#<seed_id>`; 404 if missing; 422 `"Item is not plantable"` if neither `crop` nor `fruit_tree`; maps `OutOfSeasonError` to 422 `"Seed cannot be planted in this season"`.
  - Routes: `GET /me` → `get_me(player: PlayerId) -> MeOut` (uses `PlayerProfile.get_or_default`); `PUT /me/profile` → `update_profile(body: ProfileIn) -> ProfileOut`; `POST /me/plantings` → `create_planting(body: PlantingIn) -> PlantingOut` (201); `PUT /me/plantings/{planting_id}` → `update_planting(...) -> PlantingOut`; `DELETE /me/plantings/{planting_id}` → `delete_planting(...) -> None` (204); `POST /schedule` → `preview_schedule(body: SchedulePreviewIn) -> ScheduleOut`. All keys built from `player`, never from the body; a missing `PLAYER#<player>`/`PLANTING#<id>` item → 404.

- [ ] **Step 1: Write failing tests** (TestClient, `local_table`, identity overridden via `app.dependency_overrides[get_player_id]`):

```python
def test_me_for_new_player_returns_default_profile():
    body = client_as("p1").get("/me").json()
    assert body["profile"] == {"currentDate": {"year": 1, "season": "spring", "day": 1}, "agriculturist": False}
    assert body["plantings"] == []

def test_create_planting_returns_schedule():
    r = client_as("p1").post("/me/plantings", json={"seedId": "test-seed", "plantedOn": {"year":1,"season":"spring","day":1},
        "fertilizer": "none", "location": "farm", "quantity": 2})
    assert r.status_code == 201 and r.json()["schedule"]["firstHarvest"] == {"year":1,"season":"spring","day":9}

def test_create_planting_from_known_harvest():
    r = client_as("p1").post("/me/plantings", json={"seedId": "test-seed", "anchor": "harvested",
        "lastHarvestOn": {"year":1,"season":"spring","day":13}, "fertilizer": "none", "location": "farm", "quantity": 1})
    assert r.status_code == 201 and r.json()["schedule"]["harvests"][1] == {"year":1,"season":"spring","day":17}

def test_harvest_anchor_rejects_non_regrowing_and_both_dates(): ...  # 422 for each

def test_planting_out_of_season_is_422(): ...
def test_unknown_seed_is_404(): ...
def test_not_plantable_item_is_422(): ...  # fixture item without crop
def test_other_players_planting_is_404_and_untouched():
    pid = create_as("p1")
    assert client_as("p2").delete(f"/me/plantings/{pid}").status_code == 404
    assert client_as("p2").put(f"/me/plantings/{pid}", json=VALID).status_code == 404
    assert len(client_as("p1").get("/me").json()["plantings"]) == 1

def test_profile_update_changes_status():
    pid = create_as("p1")
    client_as("p1").put("/me/profile", json={"currentDate": {"year":1,"season":"spring","day":9}, "agriculturist": False})
    assert client_as("p1").get("/me").json()["plantings"][0]["schedule"]["status"] == "ready"

def test_preview_does_not_persist(): ...
def test_invalid_day_is_422(): ...  # day 29
```

- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** service, models and routes.
- [ ] **Step 4: Run tests** — expected PASS. Then `pnpm nx run <API_PROJECT>:build` — expected PASS (generates OpenAPI used by the website client).
- [ ] **Step 5: Commit** — `feat(stardew-valley-api): add player plantings and schedule endpoints`.

---

### Task 9: Infrastructure (prod)

**Files:**
- Modify (new project only): `packages/stardew-valley/infra/src/{main.tf,providers.tf,variables.tf,outputs.tf,locals.tf}`, `src/env/prod.tfvars` (delete generated `dev.tfvars`), `packages/stardew-valley/infra/project.json` (default configurations → `prod`, drop `dev` configurations), `packages/stardew-valley/infra/checkov.yml`, `scripts/init.ts` (state key prefix `stardew-valley-infra`)
- Modify (generated in Task 1, not pre-existing): `packages/common/terraform/src/core/user-identity/identity/identity.tf` (see Step 3)
- Test: `packages/stardew-valley/infra/src/tests/main.tftest.hcl`

**Interfaces:**
- Consumes: modules `core/asset-bucket`, `app/dynamodb/stardew-valley-db`, `core/user-identity`, `app/apis/stardew-valley-api`, `app/static-websites/stardew-valley-helper-website`, `metrics`.
- Produces outputs: `website_url`, `api_url`, `table_name`, `runtime_config_app_id`, `user_pool_id`.

- [ ] **Step 1: Write the failing Terraform test** (`command = plan` with `mock_provider "aws"` and `mock_provider "aws" { alias = "us_east_1" }`):

```hcl
run "prod_plan_shape" {
  command = plan
  variables { environment = "prod", domain_name = "danhenrique.com.br" }
  assert { condition = local.website_domain == "stardew.danhenrique.com.br"  error_message = "wrong domain" }
  assert { condition = module.website.web_acl_arn == null                   error_message = "website WAF must be off" }
  assert { condition = aws_route53_record.website_alias["A"].name == "stardew.danhenrique.com.br" error_message = "missing alias" }
}
```

Run `pnpm nx run <INFRA_PROJECT>:test` — expected FAIL.

- [ ] **Step 2: Write `main.tf`** in this order: `metrics`; `data "aws_route53_zone" "main" { name = var.domain_name }`; `local.website_domain = "stardew.${var.domain_name}"`; `aws_acm_certificate.website` (provider `aws.us_east_1`, DNS validation) + validation records in the data-source zone + `aws_acm_certificate_validation`; `module.asset_bucket`; `module.table` (`deletion_protection_enabled = true`, defaults for PITR/encryption); `module.user_identity` (`enable_waf = false`, `mfa = "OPTIONAL"`, `mfa_second_factor_sms = false`, `mfa_second_factor_otp = true`); `module.api` (`asset_bucket_name`, `enable_waf = false`, `env = { ALLOWED_ORIGINS = "https://${local.website_domain}", LOG_LEVEL = "INFO" }`); `aws_iam_role_policy.api_table_access` with `for_each = toset(module.api.operations)` granting the DynamoDB + KMS actions from the FastAPI→DynamoDB connection guide on `module.table.table_arn`, `/index/*` and `module.table.kms_key_arn`; `aws_iam_role_policy.authenticated_api_invoke` on `module.user_identity.authenticated_role_name` allowing `execute-api:Invoke` on `${module.api.api_execution_arn}/*`; `module.website` (`providers = { aws.us_east_1 = aws.us_east_1 }`, `enable_waf = false`, `custom_domain_names = [local.website_domain]`, `acm_certificate_arn = aws_acm_certificate_validation.website.certificate_arn`, `depends_on = [module.api, module.user_identity]`); `aws_route53_record.website_alias` `for_each = toset(["A","AAAA"])` aliasing the distribution. `providers.tf` mirrors the existing infra (aws `6.66.0`, S3 backend, default + `us_east_1`). `prod.tfvars`: `aws_region = "sa-east-1"`, `environment = "prod"`, `domain_name = "danhenrique.com.br"`.
- [ ] **Step 3: Adjust the generated identity module** (`identity.tf`, created by Task 1): remove the `http://localhost:*` callback/logout URLs (prod only) and set the user pool `user_pool_tier = "ESSENTIALS"` instead of Plus with audit threat protection (keeps the 10k MAU free tier; Plus has none). If the module exposes these as variables, set them from `main.tf` instead of editing.
- [ ] **Step 4: Checkov.** In the new `checkov.yml` add skips with comments: `CKV_AWS_68` (CloudFront WAF off), `CKV2_AWS_29` and `CKV2_AWS_77` if reported (API Gateway / Cognito WAF off), keeping the generated Lambda skips. Run `pnpm nx run <INFRA_PROJECT>:checkov` — expected PASS with only those skips.
- [ ] **Step 5: Run** `pnpm nx run <INFRA_PROJECT>:format`, `:validate`, `:test` — expected PASS.
- [ ] **Step 6: Commit** — `feat(stardew-valley-infra): deploy table, api, auth and website to prod`.

---

### Task 10: Website shell, routes and data hooks

**Files:**
- Modify: `packages/stardew-valley/website/src/routes/__root.tsx`, `src/components/AppLayout/*` (replace generated layout), `src/routes/index.tsx`, `src/config.ts`, `src/styles.css` (Tailwind import only)
- Create: `src/routes/sementes.tsx`, `src/lib/i18n.ts`, `src/lib/gameDate.ts`, `src/hooks/useGameData.ts`, `src/components/Notifications.tsx`, `src/components/Footer.tsx`
- Add deps via catalog: `@headlessui/react`, `@heroicons/react` (already in the pnpm catalog)
- Test: `src/lib/i18n.spec.ts`, `src/lib/gameDate.spec.ts`, `src/components/AppLayout/AppLayout.spec.tsx`

**Interfaces:**
- Consumes: `useStardewValleyApi` (generated), operations from Tasks 7 and 8.
- Produces:
  - `localizedName(name: { en: string; ptBr?: string | null } | null | undefined): string` — `ptBr ?? en ?? ''`.
  - `SEASONS`, `SEASON_LABELS: Record<Season,string>` = `{spring:'Primavera', summer:'Verão', fall:'Outono', winter:'Inverno'}`, `DAYS = [1..28]`, `formatGameDate(d: GameDate): string` → `"Primavera 9, Ano 1"`.
  - `useMe()`, `usePlantables(season, location)`, `useFertilizers()` (filters `/game/fertilizantes` to the three speed ids + a synthetic "Nenhum"), `useCreatePlanting()`, `useUpdatePlanting()`, `useDeletePlanting()`, `useUpdateProfile()`, `useSchedulePreview(input | null)` — thin wrappers over the generated TanStack Query options; mutations invalidate `getMe`.
  - `<Notifications>` context with `notifyError(message: string)`; API errors show `"Não foi possível salvar. Tente novamente."` or the 422 `detail`.
  - Layout from `application-shells/stacked/01-with-bottom-border.jsx`: brand "Stardew Helper", nav items "Plantios" (`/`) and "Sementes" (`/sementes`), user menu with "Sair" (calls the generated Cognito sign-out); footer with the spec §12 license notice in pt-BR: "Dados do jogo © ConcernedApe LLC e Stardew Valley Wiki (CC BY-NC-SA 3.0). Site de fã, sem fins comerciais."

- [ ] **Step 1: Write failing tests:** `localizedName({en:'Strawberry', ptBr:null}) === 'Strawberry'`; `formatGameDate({year:1, season:'spring', day:9}) === 'Primavera 9, Ano 1'`; layout renders links "Plantios" and "Sementes" and the footer text.
- [ ] **Step 2: Run** `pnpm nx run <WEB_PROJECT>:test` — expected FAIL.
- [ ] **Step 3: Implement** helpers, hooks, layout (adapted classes), notifications (from `overlays/notifications`, close button `XMarkIcon` with `aria-label="Fechar"` `title="Fechar"`), footer.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add layout, routes and api hooks`.

---

### Task 11: Home — game date panel and planting form with preview

**Files:**
- Create: `src/components/GameDatePanel.tsx`, `src/components/PlantingForm.tsx`, `src/components/form/ModeRadio.tsx`, `src/components/SchedulePreview.tsx`, `src/components/form/SelectMenu.tsx`, `src/components/form/Combobox.tsx`, `src/components/form/LocationRadio.tsx`, `src/components/form/Toggle.tsx`
- Modify: `src/routes/index.tsx`
- Test: `src/components/PlantingForm.spec.tsx`, `src/components/GameDatePanel.spec.tsx`

**Interfaces:**
- Consumes: hooks and helpers from Task 10.
- Produces:
  - `SelectMenu<T>({label, value, options: {value:T; label:string; secondary?:string}[], onChange})` from `forms/select-menus/02-simple-custom.jsx` (secondary text variant from `06-with-secondary-text.jsx`).
  - `Combobox({label, value, options, onChange})` from `forms/comboboxes/05-with-secondary-text.jsx`, filtering by typed query but only accepting a listed option.
  - `LocationRadio({value, onChange})` from `forms/radio-groups/11-small-cards.jsx`: Fazenda / Estufa / Ilha Gengibre.
  - `Toggle({label, description, checked, onChange})` from `forms/toggles/04-with-left-label-and-description.jsx`.
  - `GameDatePanel({profile, onSave})`: season/day/year selects (years 1–50) + Agriculturist toggle ("Profissão Agricultor", "+10% de velocidade de crescimento") + button "Salvar data".
  - `ModeRadio({value, onChange})` from `forms/radio-groups/02-simple-inline-list.jsx`: "Sei a data do plantio" (`planted`) / "Sei a data de uma colheita" (`harvested`).
  - `PlantingForm({initial?, today, agriculturist, onSubmit})`: mode radio first; in `harvested` mode the seed combobox lists only plantables with `regrowDays`, the date selects are labelled "Data da colheita", the fertilizer select is hidden and the payload carries `anchor: 'harvested'` + `lastHarvestOn`; otherwise: seed combobox (options from `usePlantables(plantedSeason, location)`, secondary `"Primavera · 8 dias · rebrota 4"`), planted season/day/year selects, fertilizer select (secondary `"−10%"`, `"−25%"`, `"−33%"`), location radio, quantity select 1–99, optional label input (max 60), button "Adicionar plantio" (or "Salvar plantio" when editing). Changing location/season clears an incompatible seed.
  - `SchedulePreview({input})`: debounced 300 ms `useSchedulePreview`; description list "Primeira colheita", "Colheitas", "Rebrota a cada", "Morre em"; warnings as alerts (`will_not_mature` → "Não amadurece antes do fim da estação."; approximate → "Cálculo aproximado para esta semente.").

- [ ] **Step 1: Write failing tests:**

```tsx
it('lists only seeds plantable in the chosen season on the farm', async () => { /* mock usePlantables; choose Verão; expect Morango absent */ });
it('has no free-text input except the optional label', () => {
  render(<PlantingForm .../>);
  expect(screen.getAllByRole('textbox').map((e) => e.getAttribute('name'))).toEqual(['label']); // combobox input has role combobox
});
it('submits camelCase payload', async () => { /* select fields; click "Adicionar plantio"; expect onSubmit called with {seedId, plantedOn:{year,season,day}, fertilizer, location, quantity} */ });
it('shows will_not_mature warning from preview', async () => { /* mock preview warnings */ });
it('harvest mode lists only regrowing crops, hides fertilizer and sends lastHarvestOn', async () => { ... });
it('GameDatePanel saves season/day/year and agriculturist', async () => { ... });
```

- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement** the components and compose them in `routes/index.tsx` (panel on top, form in a card, preview next to it on `lg:`).
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add game date panel and planting form`.

---

### Task 12: Home — plantings list, harvest calendar, empty state

**Files:**
- Create: `src/components/PlantingList.tsx`, `src/components/StatusBadge.tsx`, `src/components/HarvestCalendar.tsx`, `src/components/EmptyPlantings.tsx`
- Modify: `src/routes/index.tsx`
- Test: `src/components/PlantingList.spec.tsx`, `src/components/HarvestCalendar.spec.tsx`

**Interfaces:**
- Consumes: `useMe`, `useDeletePlanting`, `useUpdatePlanting`, `PlantingForm` (edit mode), helpers.
- Produces:
  - `StatusBadge({status})` from `elements/badges/11-flat-pill-with-dot.jsx`: growing "Crescendo" (yellow), ready "Pronta" (green), regrowing "Rebrotando" (blue), finished "Finalizada" (gray), dead "Morta" (red).
  - `PlantingList({plantings, onEdit, onDelete})` from `lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx`: seed name, quantity, planted date, next harvest / days left, badge; actions menu "Editar"; delete icon button `TrashIcon` with `aria-label="Excluir plantio"` `title="Excluir plantio"`.
  - `HarvestCalendar({plantings, today})` from `data-display/calendars/02-month-view.jsx` adapted to a 4×7 grid of the shown season (days 1–28), harvest markers per day, today highlighted; prev/next with `ChevronLeftIcon`/`ChevronRightIcon`, `aria-label`/`title` "Estação anterior"/"Próxima estação".
  - `EmptyPlantings()` from `feedback/empty-states/02-with-dashed-border.jsx`: "Nenhum plantio ainda" / "Adicione sua primeira semente acima.".

- [ ] **Step 1: Write failing tests:** badge label per status; delete button has accessible name "Excluir plantio" and calls `onDelete(id)`; calendar marks Spring 9, 13, 17, 21, 25 for the strawberry schedule and navigating "Próxima estação" shows "Verão"; empty state renders when `plantings=[]`.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add plantings list and harvest calendar`.

---

### Task 13: Seeds catalog page

**Files:**
- Modify: `src/routes/sementes.tsx`
- Create: `src/components/SeasonTabs.tsx`, `src/components/SeedCard.tsx`
- Test: `src/routes/sementes.spec.tsx`

**Interfaces:**
- Consumes: `usePlantables`, `localizedName`, `SEASON_LABELS`.
- Produces: `SeasonTabs({value, onChange})` from `navigation/tabs/03-tabs-in-pills.jsx` (4 seasons); `SeedCard({plantable})` from `lists/grid-lists/03-simple-cards.jsx` showing name, growth days or "Árvore: 28 dias", regrowth.

- [ ] **Step 1: Write failing test:** selecting "Outono" shows only fall crops plus fruit trees from the mocked plantables.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm nx run <WEB_PROJECT>:build` — expected PASS (lint, typecheck, test, bundle).
- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add seeds catalog`.

---

### Task 14: Full verification and deploy runbook

**Files:**
- Modify: `packages/stardew-valley/README.md` (deploy runbook)

- [ ] **Step 1: Run** `pnpm nx run-many -t build -p <DB_PROJECT>,<API_PROJECT>,<WEB_PROJECT>,<INFRA_PROJECT>` and `pnpm nx run-many -t build -p @aws-danhenrique/website,@aws-danhenrique/infra` (existing projects still pass). Expected: all succeed. Paste failures to the user verbatim.
- [ ] **Step 2: Local end-to-end:** `pnpm nx dev <WEB_PROJECT>` (starts DynamoDB Local + API), run the import with `LOCAL_DEV=true`, add a planting through the UI (mock auth), confirm the preview and list.
- [ ] **Step 3: Write the runbook** in the README: (1) `pnpm nx run <INFRA_PROJECT>:plan --configuration=prod`, (2) user reviews the plan, (3) `:apply --configuration=prod`, (4) `RUNTIME_CONFIG_APP_ID=$(terraform output -raw runtime_config_app_id) pnpm nx run <DB_PROJECT>:import`, (5) open `https://stardew.danhenrique.com.br`, sign up, add a planting.
- [ ] **Step 4: Commit** — `docs(stardew-valley): add deploy runbook`.
- [ ] **Step 5: Ask the user** before running plan/apply/import against AWS; run each only after explicit confirmation and report the outputs.
