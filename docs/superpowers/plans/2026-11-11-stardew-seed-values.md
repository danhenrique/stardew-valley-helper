# Seed values and sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each seed's gold per day / gold in the window on `/sementes`, with fertilizer, farming level, period and sort controls, and fix the strawberry and carrot seed names and sprites.

**Architecture:** A pure Python module (`crop_value.py`) computes harvests and expected gold, reusing the growth rules of `schedule.py`; a new public route `GET /plantables/value` exposes it. The website regenerates its client, joins the values with `/plantables` in a pure `lib/seedValues.ts`, and `SeedCatalog` renders the controls and values.

**Tech Stack:** Python 3 + FastAPI + PynamoDB (moto in tests, pytest); React + TanStack Query/Router + Tailwind + Headless UI (Vitest + Testing Library); Nx with pnpm.

**Spec:** `docs/superpowers/specs/2026-11-11-stardew-seed-values-design.md`

## Global Constraints

- Run tasks through Nx: `pnpm nx test aws_danhenrique.stardew_valley_api`, `pnpm nx test @aws-danhenrique/stardew-valley-helper-website`, `pnpm nx lint <project>`.
- Code, identifiers and commits in English; UI copy in Portuguese.
- No floats for money leaving the API: `goldTotal: int | None`, `goldPerDayTenths: int | None` (157 = 15,7 g/dia).
- Query params and JSON attributes in camelCase (`fromDay`, `farmingLevel`, `goldPerDayTenths`).
- Gold per day = total gold ÷ days in the window; window = `fromDay`..28 of the chosen season; single-harvest crops are replanted on harvest day; a harvest counts only if its day ≤ 28.
- Seed cost is never subtracted. Fruit trees, greenhouse, Ginger Island, keg/jar, Tiller are out of scope.
- Styling only with Tailwind utility classes; new components adapted from `/home/danhenrique/projects/.tailwind/`; icons from `@heroicons/react`; every component works in light and dark mode.
- `localStorage` access always wrapped in try/catch, falling back to defaults.
- Commits end with the session's `Co-Authored-By` / `Claude-Session` lines.

## Review Focus

- `fromDay` = 28 (window of 1 day): no crop matures, every seed is in the "não amadurece" group, no division error — pinned in Task 1 (`test_one_day_window`).
- Seed whose produce item is missing from the table (bad `produce` id): value `None`, not a 500 — pinned in Task 2 (`test_missing_produce_has_no_value`).
- `localStorage` holding garbage (invalid JSON, unknown fertilizer, level 99): defaults are used — pinned in Task 4 (`loadSeedPrefs` tests).
- Switching to another season while "A partir de hoje" is selected: the request goes out with `fromDay: 1`, and returning to the current season restores today — pinned in Task 5.
- Values request failing: cards still render, sorted by name, with the notice — pinned in Task 5.

---

### Task 1: Pure seed value calculation

**Files:**
- Create: `packages/stardew-valley/api/stardew_valley_api/crop_value.py`
- Test: `packages/stardew-valley/api/tests/test_crop_value.py`

**Interfaces:**
- Consumes (from `schedule.py`): `CropSpec(seasons, growth_days, phases, regrow_days)`, `Fertilizer`, `effective_growth_days(crop, speed_pct) -> tuple[int, bool]`, `speed_pct(fertilizer, agriculturist) -> int`, `DAYS_PER_SEASON`.
- Produces:
  - `ValueFertilizer = Literal["none", "basic", "quality", "deluxe", "speed-gro", "deluxe-speed-gro", "hyper-speed-gro"]`
  - `@dataclass(frozen=True) class QualityChances: normal: float; silver: float; gold: float; iridium: float`
  - `quality_chances(farming_level: int, ratio: int) -> QualityChances`
  - `gold_per_harvest(sell_price: int, extra_yield: float, chances: QualityChances) -> float`
  - `harvest_days(crop: CropSpec, from_day: int, speed: Fertilizer, agriculturist: bool) -> tuple[list[int], bool]` (days of the season with a harvest, `approximate`)
  - `@dataclass(frozen=True) class SeedValue: harvests: int; days: int; gold_total: int | None; gold_per_day_tenths: int | None; will_not_mature: bool; approximate: bool`
  - `seed_value(crop: CropSpec, sell_price: int | None, extra_yield: float, from_day: int, fertilizer: ValueFertilizer, farming_level: int, agriculturist: bool) -> SeedValue`

- [ ] **Step 1: Write the failing tests**

Use `pytest.approx` for floats. Crops: `PARSNIP = CropSpec(["spring"], 4, [1, 1, 1, 1], None)`, `CAULIFLOWER = CropSpec(["spring"], 12, [1, 2, 4, 4, 1], None)`, `GREEN_BEAN = CropSpec(["spring"], 10, [1, 1, 1, 3, 4], 3)`, `NO_PHASES = CropSpec(["spring"], 4, None, None)`.

```python
def test_quality_chances_level_0_no_fertilizer():
    c = quality_chances(0, 0)
    assert (c.normal, c.silver, c.gold, c.iridium) == approx((0.9702, 0.0198, 0.01, 0))

def test_quality_chances_level_10_quality_fertilizer():
    c = quality_chances(10, 2)
    assert (c.normal, c.silver, c.gold, c.iridium) == approx((0.0975, 0.2925, 0.61, 0))

def test_quality_chances_level_10_deluxe_fertilizer():
    c = quality_chances(10, 3)
    assert (c.normal, c.silver, c.gold, c.iridium) == approx((0, 0.11305, 0.48195, 0.405))

def test_gold_per_harvest_floors_quality_prices_and_adds_extra_at_normal_price():
    # 80·0.9702 + ⌊100⌋·0.0198 + ⌊120⌋·0.01 + 0.2·80
    assert gold_per_harvest(80, 0.2, quality_chances(0, 0)) == approx(96.796)
    # p = 35: silver ⌊43.75⌋ = 43, gold ⌊52.5⌋ = 52, iridium 70
    assert gold_per_harvest(35, 0, QualityChances(0, 0.5, 0.25, 0.25)) == approx(52.0)

def test_single_harvest_crop_is_replanted():
    assert harvest_days(PARSNIP, 1, "none", False) == ([5, 9, 13, 17, 21, 25], False)

def test_regrowing_crop_harvests_every_regrow_days():
    assert harvest_days(GREEN_BEAN, 1, "none", False)[0] == [11, 14, 17, 20, 23, 26]

def test_window_starts_on_from_day_and_day_28_counts():
    assert harvest_days(PARSNIP, 20, "none", False)[0] == [24, 28]

def test_speed_fertilizer_shortens_growth():
    assert harvest_days(PARSNIP, 1, "speed-gro", True)[0] == [4, 7, 10, 13, 16, 19, 22, 25, 28]

def test_crop_without_phases_with_speed_is_approximate():
    assert harvest_days(NO_PHASES, 1, "speed-gro", False)[1] is True

def test_seed_value_totals_in_integers():
    v = seed_value(CAULIFLOWER, 175, 0, 1, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature) == (2, 28, False)
    expected = 2 * gold_per_harvest(175, 0, quality_chances(0, 0))
    assert v.gold_total == round(expected)
    assert v.gold_per_day_tenths == round(10 * expected / 28)

def test_quality_fertilizer_does_not_change_speed():
    assert seed_value(PARSNIP, 35, 0, 1, "deluxe", 0, False).harvests == 6

def test_will_not_mature():
    v = seed_value(CAULIFLOWER, 175, 0, 20, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature, v.gold_total, v.gold_per_day_tenths) == (0, 9, True, 0, 0)

def test_one_day_window():
    v = seed_value(PARSNIP, 35, 0, 28, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature) == (0, 1, True)

def test_no_sell_price_keeps_harvests_without_gold():
    v = seed_value(PARSNIP, None, 0, 1, "none", 0, False)
    assert (v.harvests, v.gold_total, v.gold_per_day_tenths) == (6, None, None)
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api -- tests/test_crop_value.py`
Expected: FAIL (`ModuleNotFoundError: stardew_valley_api.crop_value`)

- [ ] **Step 3: Implement `crop_value.py`**

- Module docstring: the formula source (Stardew Profits `predictions.js`, via the MIT reference scheduler `cropProfit.ts`).
- `QUALITY_RATIO = {"basic": 1, "quality": 2, "deluxe": 3}`; quality fertilizers map to speed `"none"`; speed fertilizers have ratio 0 and pass through as `schedule.Fertilizer`.
- `quality_chances`: exactly the spec's formulas (§ Calculation, item 3).
- `gold_per_harvest`: `n·p + s·floor(1.25p) + g·floor(1.5p) + i·2p + extra_yield·p`.
- `harvest_days`: `growth, approximate = effective_growth_days(crop, speed_pct(speed, agriculturist))`; `day = from_day + growth`; while `day <= DAYS_PER_SEASON`: append, then `day += crop.regrow_days or growth`.
- `seed_value`: `days = DAYS_PER_SEASON - from_day + 1`; with `sell_price is None` both gold fields are `None`; otherwise `total = harvests × gold_per_harvest`, `gold_total = round(total)`, `gold_per_day_tenths = round(10 × total / days)`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api -- tests/test_crop_value.py`
Expected: PASS (14 tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm nx lint aws_danhenrique.stardew_valley_api
git add packages/stardew-valley/api/stardew_valley_api/crop_value.py packages/stardew-valley/api/tests/test_crop_value.py
git commit -m "feat(stardew-valley-api): compute expected gold per seed"
```

---

### Task 2: `GET /plantables/value` route

**Files:**
- Modify: `packages/stardew-valley/api/stardew_valley_api/models.py` (add `SeedValueOut` next to `PlantableOut`)
- Modify: `packages/stardew-valley/api/stardew_valley_api/routes/game.py` (new route after `list_plantables`)
- Test: `packages/stardew-valley/api/tests/test_game_routes.py`
- Test fixture: `packages/stardew-valley/db/tests/fixtures/data/sementes/test-ghost-seed.json` (new)

**Interfaces:**
- Consumes: Task 1 `seed_value`, `ValueFertilizer`, `SeedValue`; `list_folder("sementes")`; `Item.batch_get`.
- Produces:
  - `class SeedValueOut(CamelModel): id: str; harvests: int; days: int; gold_total: int | None = None; gold_per_day_tenths: int | None = None; will_not_mature: bool; approximate: bool` → JSON `goldTotal`, `goldPerDayTenths`, `willNotMature`.
  - `GET /plantables/value?season&fromDay=1&fertilizer=none&farmingLevel=0&agriculturist=false` → `list[SeedValueOut]`, operation function `list_seed_values` (client method `listSeedValues`).

Fixtures already in place: `test-flat-seed` (spring, growth 12, phases `[1,2,4,5]`, produce `test-veg` with `sellPrice` 80), `test-seed` (spring, growth 8, regrow 4, produce `test-fruit` without price), `test-summer-seed` (summer), `test-acorn` (no crop). Add `test-ghost-seed`: spring, growth 4, phases `[1,1,1,1]`, regrow null, produce `"missing-item"` (no such item), `name` en/pt-BR fictitious. Update any existing test that counts seeds or plantables if the new fixture changes its count.

- [ ] **Step 1: Write the failing tests**

```python
def test_seed_values_list_only_farm_crops_of_the_season(client):
    ids = {v["id"] for v in client.get("/plantables/value", params={"season": "spring"}).json()}
    assert ids == {"test-flat-seed", "test-seed", "test-ghost-seed"}

def test_seed_value_of_flat_seed_from_day_1(client):
    body = client.get("/plantables/value", params={"season": "spring"}).json()
    flat = next(v for v in body if v["id"] == "test-flat-seed")
    # harvests on days 13 and 25; 2 × 80.796 = 161.592
    assert flat == {"id": "test-flat-seed", "harvests": 2, "days": 28, "goldTotal": 162,
                    "goldPerDayTenths": 58, "willNotMature": False, "approximate": False}

def test_seed_value_without_produce_price_keeps_harvests(client):
    body = client.get("/plantables/value", params={"season": "spring"}).json()
    seed = next(v for v in body if v["id"] == "test-seed")
    assert (seed["harvests"], seed["goldTotal"], seed["goldPerDayTenths"]) == (5, None, None)

def test_missing_produce_has_no_value(client):
    body = client.get("/plantables/value", params={"season": "spring"}).json()
    ghost = next(v for v in body if v["id"] == "test-ghost-seed")
    assert ghost["goldTotal"] is None

def test_seed_values_use_from_day_and_fertilizer(client):
    params = {"season": "spring", "fromDay": 20, "fertilizer": "deluxe", "farmingLevel": 10}
    flat = next(v for v in client.get("/plantables/value", params=params).json() if v["id"] == "test-flat-seed")
    assert (flat["days"], flat["willNotMature"]) == (9, True)

@pytest.mark.parametrize("params", [
    {"season": "spring", "fromDay": 0}, {"season": "spring", "fromDay": 29},
    {"season": "spring", "farmingLevel": 11}, {"season": "spring", "fertilizer": "tree"}, {},
])
def test_seed_values_reject_invalid_query(client, params):
    assert client.get("/plantables/value", params=params).status_code == 422
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api -- tests/test_game_routes.py -k seed_value`
Expected: FAIL (404 on `/plantables/value`)

- [ ] **Step 3: Implement the model and the route**

- `list_seed_values(season: Season, from_day: Annotated[int, Query(alias="fromDay", ge=1, le=28)] = 1, fertilizer: ValueFertilizer = "none", farming_level: Annotated[int, Query(alias="farmingLevel", ge=0, le=10)] = 0, agriculturist: bool = False) -> list[SeedValueOut]`, decorated like `list_plantables` (`@app.get`, `@tracer.capture_method`).
- Seeds: items of `list_folder("sementes")` with `crop` whose `seasons` include `season`. Build `CropSpec` the same way `schedule_service._schedule_for_item` does (extract that construction into a shared helper `crop_spec(item: Item) -> CropSpec` in `schedule_service.py` and use it in both places).
- Produce prices: one `Item.batch_get([(f"ITEM#{produce}", "ITEM"), ...])` for the distinct `crop.produce` ids; missing items or `sell_price is None` → `sell_price=None`. `extra_yield = float(crop.average_extra_yield or 0)`.

- [ ] **Step 4: Run the whole API suite**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api`
Expected: PASS (all, including the existing plantable and planting tests)

- [ ] **Step 5: Lint and commit**

```bash
pnpm nx lint aws_danhenrique.stardew_valley_api
git add packages/stardew-valley/api packages/stardew-valley/db/tests/fixtures/data/sementes/test-ghost-seed.json
git commit -m "feat(stardew-valley-api): list seed values for a season window"
```

---

### Task 3: Website client and pure seed rows

**Files:**
- Regenerate: `packages/stardew-valley/website/src/generated/stardew-valley-api/**`
- Create: `packages/stardew-valley/website/src/lib/seedValues.ts`
- Test: `packages/stardew-valley/website/src/lib/seedValues.spec.ts`
- Modify: `packages/stardew-valley/website/src/components/testData.ts` (add `SEED_VALUES`)

**Interfaces:**
- Consumes: generated `PlantableOut`, `SeedValueOut`, `ValueFertilizer`; `localizedName` from `lib/i18n`.
- Produces (in `lib/seedValues.ts`):
  - `type SeedSort = 'goldPerDay' | 'goldTotal' | 'name'`
  - `type SeedRow = { plantable: PlantableOut; name: string; value?: SeedValueOut }`
  - `buildSeedRows(plantables: PlantableOut[], values: SeedValueOut[] | undefined, sort: SeedSort): SeedRow[]`
  - `formatGoldPerDay(tenths: number): string` → `'15,7 g/dia'`
  - `formatGoldTotal(gold: number, harvests: number): string` → `'1.234 g · 6 colheitas'` / `'80 g · 1 colheita'`
  - `type SeedPrefs = { fertilizer: ValueFertilizer; farmingLevel: number; sort: SeedSort }`, `DEFAULT_SEED_PREFS = { fertilizer: 'none', farmingLevel: 0, sort: 'goldPerDay' }`
  - `loadSeedPrefs(): SeedPrefs`, `saveSeedPrefs(prefs: SeedPrefs): void` (key `'stardew.seedPrefs'`)
  - `FERTILIZER_OPTIONS: { value: ValueFertilizer; label: string; iconId?: string }[]` in this order with these labels (pt-BR names from the game data): `none` "Nenhum"; `basic` "Fertilizante Básico" (`basic-fertilizer`); `quality` "Fertilizante de Qualidade" (`quality-fertilizer`); `deluxe` "Fertilizante Premium" (`deluxe-fertilizer`); `speed-gro` "Solo Foliar" (`speed-gro`); `deluxe-speed-gro` "Solo Foliar Premium" (`deluxe-speed-gro`); `hyper-speed-gro` "Hiper Solo Foliar" (`hyper-speed-gro`)

- [ ] **Step 1: Regenerate the client**

Run: `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:generate:stardew-valley-api-client`
Expected: `types.gen.ts` contains `SeedValueOut` with `goldPerDayTenths`, and the client exposes `listSeedValues`.

- [ ] **Step 2: Write the failing tests**

`SEED_VALUES` in `testData.ts` covers the spring `PLANTABLES`: one valued seed, one with a higher `goldTotal` but lower `goldPerDayTenths`, one `willNotMature`, and none for the sapling.

```ts
it('should put valued seeds first by gold per day, then not mature, then without value')
  // order of ids for sort 'goldPerDay'; the sapling (no value entry) is last
it('should sort valued seeds by gold total when asked')
it('should sort every row by name when sort is name')
it('should break ties and order groups 2 and 3 by localized name')
it('should sort by name only when values are undefined')
it('should format gold per day and totals in pt-BR', () => {
  expect(formatGoldPerDay(157)).toBe('15,7 g/dia');
  expect(formatGoldTotal(1234, 6)).toBe('1.234 g · 6 colheitas');
  expect(formatGoldTotal(80, 1)).toBe('80 g · 1 colheita');
});
it('should return defaults when storage is empty, invalid JSON or out of range')
  // '{"fertilizer":"tree","farmingLevel":99,"sort":"x"}' → DEFAULT_SEED_PREFS field by field
it('should round-trip saved prefs')
it('should fall back to defaults when localStorage throws')
  // vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error() })
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- src/lib/seedValues.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement `lib/seedValues.ts`**

Groups: 1 = `value && !value.willNotMature && value.goldTotal != null`; 2 = `value?.willNotMature`; 3 = the rest. Gold sorts are descending; name comparison uses `localeCompare(b, 'pt-BR')`. `loadSeedPrefs` validates each field independently (fertilizer in `FERTILIZER_OPTIONS`, integer level 0–10, known sort).

- [ ] **Step 5: Run to verify they pass, lint, commit**

```bash
pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- src/lib/seedValues.spec.ts
pnpm nx lint @aws-danhenrique/stardew-valley-helper-website
git add packages/stardew-valley/website/src
git commit -m "feat(stardew-valley-website): join and sort seed values"
```

---

### Task 4: Segmented buttons component

**Files:**
- Create: `packages/stardew-valley/website/src/components/form/SegmentedButtons.tsx`
- Test: `packages/stardew-valley/website/src/components/form/SegmentedButtons.spec.tsx`

**Interfaces:**
- Produces: `SegmentedButtons<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (value: T) => void })`. Renders a `role="group"` with `aria-label={label}`, a visible label above it, and one `<button type="button" aria-pressed>` per option.

- [ ] **Step 1: Write the failing tests**

```tsx
it('should mark the selected option as pressed')
it('should call onChange with the clicked value')
it('should not call onChange for a disabled option') // button has disabled attribute
```

- [ ] **Step 2: Run to verify they fail** — `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- SegmentedButtons` → FAIL (module not found)

- [ ] **Step 3: Implement** adapting `/home/danhenrique/projects/.tailwind/application-ui-v4/react/elements/button-groups/01-basic.jsx` (keep its utility classes: `isolate inline-flex rounded-md shadow-xs`, first/last rounded, `-ml-px`). Selected state uses the site's green (`bg-green-600 text-white`, `dark:bg-green-500`), focus `outline-green-600`; disabled `cursor-not-allowed opacity-50`. Header comment names the source file, as the other adapted components do.

- [ ] **Step 4: Run to verify they pass** — same command → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/stardew-valley/website/src/components/form/SegmentedButtons*
git commit -m "feat(stardew-valley-website): add segmented buttons"
```

---

### Task 5: Seed catalog controls and values

**Files:**
- Modify: `packages/stardew-valley/website/src/hooks/useGameData.ts` (add `useSeedValues`)
- Modify: `packages/stardew-valley/website/src/components/SeedCatalog.tsx`
- Modify: `packages/stardew-valley/website/src/routes/sementes.tsx`
- Test: `packages/stardew-valley/website/src/components/SeedCatalog.spec.tsx`, `packages/stardew-valley/website/src/routes/sementes.spec.tsx`

**Interfaces:**
- Consumes: Task 3 (`buildSeedRows`, formatters, prefs, `FERTILIZER_OPTIONS`), Task 4 (`SegmentedButtons`), existing `form/SelectMenu`, `form/NumberStepper`, `Skeleton`'s `SkeletonBar`, `GameIcon`.
- Produces:
  - `useSeedValues(params: { season: Season; fromDay: number; fertilizer: ValueFertilizer; farmingLevel: number; agriculturist: boolean })` → `useQuery({ ...api.listSeedValues.queryOptions(params), staleTime: Infinity })`.
  - `SeedCatalog` props: `{ plantables: PlantableOut[]; initialSeason: Season; currentSeason: Season; currentDay: number; agriculturist: boolean }`. The route passes them from `useMe()` (`profile.currentDate.season/day`, `profile.agriculturist`), defaulting to `spring`, `1`, `false`.

Behaviour:
- Period state defaults to `'today'`; the effective period is `'season'` whenever `season !== currentSeason`, and the "A partir de hoje" option is disabled there. `fromDay = effective === 'today' ? currentDay : 1`.
- Labels: "Período" ("Estação inteira" / "A partir de hoje"), "Fertilizante", "Nível de Agricultura", "Ordenar por" ("Ouro/dia" / "Ouro no período" / "Nome").
- Prefs load once with `loadSeedPrefs()` and save with `saveSeedPrefs` on every change.
- Card right slot: loading → `SkeletonBar`; valued → `formatGoldPerDay` (`font-semibold text-gray-900 dark:text-white`) over `formatGoldTotal` (`text-gray-500 dark:text-gray-400`); `willNotMature` → "Não amadurece a tempo"; else "—".
- Error → `<p role="alert">Não foi possível calcular os valores.</p>` above the grid and rows built with `values = undefined` (name order).
- Controls stack on phones (`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`).

- [ ] **Step 1: Write the failing tests**

In `SeedCatalog.spec.tsx`, mock the hook as `sementes.spec.tsx` does (`vi.mock('../hooks/useGameData', () => mocks)`), render with `currentSeason="spring" currentDay={10} agriculturist={false}`, and `localStorage.clear()` in `beforeEach`. Keep the existing tests, passing the new props.

```tsx
it('should request values from today on the current season')
  // useSeedValues called with { season: 'spring', fromDay: 10, fertilizer: 'none', farmingLevel: 0, agriculturist: false }
it('should request the whole season and disable "A partir de hoje" on another season')
  // click 'Verão' → last call has fromDay: 1; the button 'A partir de hoje' is disabled
it('should restore today when returning to the current season')
it('should request the chosen fertilizer and farming level and remember them')
  // pick 'Fertilizante de Qualidade', press the stepper's increase → last call fertilizer 'quality', farmingLevel 1;
  // unmount, render again → the first call already uses them
it('should show gold per day and gold total on valued cards') // '15,7 g/dia', '440 g · 4 colheitas'
it('should order cards by gold per day by default and by name when chosen')
it('should show "Não amadurece a tempo" and "—" for the other groups')
it('should show a skeleton in the value slot while values load')
it('should show the notice and order by name when values fail')
```

In `sementes.spec.tsx`, extend `mocks` with `useSeedValues` and add: `it('should pass the profile date and agriculturist to the catalog')` (profile summer 5, agriculturist true → `useSeedValues` called with `season: 'summer', fromDay: 5, agriculturist: true`).

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- SeedCatalog sementes`
Expected: FAIL (missing props / `useSeedValues` not called)

- [ ] **Step 3: Implement the hook, the catalog and the route wiring** as described above.

- [ ] **Step 4: Run the whole website suite and lint**

Run: `pnpm nx test @aws-danhenrique/stardew-valley-helper-website && pnpm nx lint @aws-danhenrique/stardew-valley-helper-website && pnpm nx run @aws-danhenrique/stardew-valley-helper-website:compile`
Expected: PASS, no lint or type errors

- [ ] **Step 5: Check it in the app** with the `run` skill: `/sementes` in light and dark mode, phone width (controls stacked, no horizontal scroll), switching season/period/fertilizer.

- [ ] **Step 6: Commit**

```bash
git add packages/stardew-valley/website/src
git commit -m "feat(stardew-valley-website): sort seeds by gold with fertilizer and farming level"
```

---

### Task 6: Strawberry and carrot seed names and sprites

**Files:**
- Modify (outside the repo, not versioned here): `/home/danhenrique/projects/stardew-valley/game-data/data/sementes/strawberry-seeds.json`, `.../carrot-seeds.json`
- Modify: `packages/stardew-valley/website/scripts/icon-overrides.json`
- Regenerate: `packages/stardew-valley/website/public/icons/**`, `packages/stardew-valley/website/src/lib/icon-manifest.json`
- Test: `packages/stardew-valley/website/scripts/tests/test_sync_icons.py`

- [ ] **Step 1: Write the failing test**

```python
def test_overrides_give_strawberry_and_carrot_seeds_a_sprite():
    overrides = json.loads((Path(sync_icons.SCRIPT_DIR) / "icon-overrides.json").read_text())
    assert overrides["strawberry-seeds"] == "seeds/strawberry.png"
    assert overrides["carrot-seeds"] == "seeds/carrot.png"
```

- [ ] **Step 2: Run to verify it fails** — `python3 -m pytest packages/stardew-valley/website/scripts/tests/test_sync_icons.py -k strawberry` → FAIL (`KeyError`)

- [ ] **Step 3: Add both overrides** (keep the file's alphabetical order) **and re-run the sync**

```bash
python3 -I packages/stardew-valley/website/scripts/sync_icons.py \
  /home/danhenrique/projects/stardew-valley/game-data/.tmp/stardew-valley-scheduler/public/icons \
  /home/danhenrique/projects/stardew-valley/game-data/data/_meta/index.json
```
Expected: `icon-manifest.json` now lists `carrot-seeds` and `strawberry-seeds`; `git diff --stat public/icons` shows only those two new PNGs and the removed `variants/seeds/strawberry.png`. The report's "replaced by an override" names `seeds/strawberry.png`.

- [ ] **Step 4: Fix the names in the game data**

Set `"pt-BR": "Sementes de Morango"` and `"pt-BR": "Sementes de Cenoura"`, leaving `nameVerified: false`.

- [ ] **Step 5: Run the test and the website suite, then commit**

```bash
python3 -m pytest packages/stardew-valley/website/scripts/tests/test_sync_icons.py
pnpm nx test @aws-danhenrique/stardew-valley-helper-website
git add packages/stardew-valley/website/scripts packages/stardew-valley/website/public/icons packages/stardew-valley/website/src/lib/icon-manifest.json
git commit -m "fix(stardew-valley-website): give strawberry and carrot seeds a sprite"
```

- [ ] **Step 6: Re-import the game data — only after the player confirms**

Ask the player first: the import writes to the real `stardew-valley-db` table. On a yes:
`AWS_REGION=sa-east-1 pnpm nx run aws_danhenrique.stardew_valley_db:import`
Expected: import finishes without errors; `GET /plantables` returns `ptBr` "Sementes de Morango" / "Sementes de Cenoura".
