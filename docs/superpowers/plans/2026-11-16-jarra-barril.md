# Preserves Jar and Keg Comparison on Seeds, Artisan Profession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each seed card on `/sementes` shows sell price by quality, jar and keg product values, and gold/day for raw, jar and keg; the profile gains the Artisan profession.

**Architecture:** Value rules are pure functions in `packages/api/stardew_valley_api/crop_value.py`; `GET /plantables/value` returns the new fields. The profile field lives in `PlayerProfile` (db) and `ProfileIn` (API); the website regenerates its client and renders the new fields in `SeedCatalog`.

**Tech Stack:** Python + FastAPI-style routes + PynamoDB + pytest; React + Tailwind + Heroicons + Vitest; Nx + pnpm + uv.

**Spec:** `docs/superpowers/specs/2026-11-16-jarra-barril-design.md`

## Global Constraints

- Branch `feature/jarra-barril` from `main`; at the end commit, push and open a PR to `main`.
- UI labels pt-BR; code and docs English; Tailwind only; light and dark theme; icons from Heroicons.
- Gold values are integers (floor where the spec says ⌊⌋); per-day values in tenths (`round(10 * total / days)`), like `gold_per_day_tenths`.
- Query params and JSON fields camelCase (`artisan`, `jarGoldPerDayTenths`).
- Artisan goods are normal quality; Artisan multiplier ×1.4 floor; jar = 2 × base + 50; wine = 3 × base; juice = ⌊2.25 × base⌋; silver ⌊×1.25⌋, gold ⌊×1.5⌋, iridium ×2.
- Agriculturist and Artisan both true → HTTP 422 with message "Escolha só uma profissão".
- Run through Nx: `pnpm nx test api`, `pnpm nx test db`, `pnpm nx test website`, `pnpm nx run-many -t lint test build`.

**Deviation from spec, decided here:** `artesanato/pale-ale.json` and `beer.json` have no `sellPrice`, so keg special outputs are a constant in `crop_value.py`: `KEG_SPECIAL = {"hops": ("pale-ale", 300), "wheat": ("beer", 200)}`. Before writing it, check the Wiki "Keg" page for other seed crops in `vegetais` with a non-standard keg or jar product (e.g. `tea-leaves`, `unmilled-rice`) and add them to `KEG_SPECIAL` / a `JAR_NONE` set as the Wiki states.

## Review Focus

- Crop with no `sellPrice` (value unknown): all new fields `null`, no 500.
- Crop that does not mature in the window (`willNotMature`): jar/keg per-day are `0`/`null` consistently with raw, and the card shows "—".
- Crop with `averageExtraYield > 0` (e.g. potato): jar/keg units count the extra yield.
- Old saved profiles without `artisan` load as `false`.
- Turning Artisan on in the day editor refetches seed values (the query key includes `artisan`).

---

### Task 1: Value rules in `crop_value.py`

**Files:**
- Modify: `packages/api/stardew_valley_api/crop_value.py`
- Test: `packages/api/tests/test_crop_value.py`

**Interfaces:**
- Produces:
  - `CropKind = Literal["fruit", "vegetable", "other"]`
  - `@dataclass(frozen=True) QualityPrices(normal: int, silver: int, gold: int, iridium: int)`; `quality_prices(sell_price: int) -> QualityPrices`
  - `@dataclass(frozen=True) ArtisanProduct(item: str, price: int)`
  - `jar_product(produce_id: str, kind: CropKind, sell_price: int, artisan: bool) -> ArtisanProduct | None` — fruit → `jelly`, vegetable → `pickles`.
  - `keg_product(produce_id: str, kind: CropKind, sell_price: int, artisan: bool) -> ArtisanProduct | None` — `KEG_SPECIAL` first, then fruit → `wine`, vegetable → `juice`.
  - `SeedValue` gains `prices: QualityPrices | None`, `jar: ArtisanProduct | None`, `keg: ArtisanProduct | None`, `jar_gold_per_day_tenths: int | None`, `keg_gold_per_day_tenths: int | None`.
  - `seed_value(..., agriculturist: bool, produce_id: str | None = None, kind: CropKind = "other", artisan: bool = False)` — jar/keg per day = `round(10 * len(harvests) * (1 + extra_yield) * product.price / days)`.

- [ ] **Step 1: Write failing tests**:
  - `quality_prices(750) == QualityPrices(750, 937, 1125, 1500)`.
  - `jar_product("starfruit", "fruit", 750, False) == ArtisanProduct("jelly", 1550)`; with `artisan=True` → `2170`.
  - `keg_product("starfruit", "fruit", 750, False) == ArtisanProduct("wine", 2250)`.
  - `keg_product("cauliflower", "vegetable", 175, False) == ArtisanProduct("juice", 393)`; `jar_product(... vegetable ...)` → `("pickles", 400)`.
  - `keg_product("hops", "vegetable", 25, False) == ArtisanProduct("pale-ale", 300)`; artisan → `420`. `keg_product("wheat", …)` → `("beer", 200)`.
  - `jar_product("tulip", "other", 30, False) is None` and same for keg.
  - `seed_value` with 2 harvests, extra yield 0.2, jelly 1550, 28 days → `jar_gold_per_day_tenths == round(10 * 2 * 1.2 * 1550 / 28)`.
  - `seed_value` with `sell_price=None` → `prices`, `jar`, `keg`, both per-day fields are `None`.
- [ ] **Step 2: Run** `pnpm nx test api -- -k crop_value` (check `--help` for passing pytest args through Nx) — Expected: FAIL.
- [ ] **Step 3: Implement** the functions and constants above.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add jar and keg value rules`

---

### Task 2: Artisan profession in profile (db + API)

**Files:**
- Modify: `packages/db/stardew_valley_db/entities/player.py` (`PlayerProfile.artisan = BooleanAttribute(default=False)`, default in the builder)
- Modify: `packages/api/stardew_valley_api/models.py` (`ProfileIn.artisan: bool = False`, model validator)
- Modify: `packages/api/stardew_valley_api/routes/player.py` (read/write `artisan` next to `agriculturist`, lines ~48 and ~184)
- Test: `packages/db/tests/test_player.py`, `packages/api/tests/test_player_routes.py`

**Interfaces:**
- Produces: profile JSON field `artisan: boolean` (GET and PUT); 422 when both professions are true.

- [ ] **Step 1: Write failing tests**:
  - db: new profile has `artisan is False`; a stored profile without the attribute loads as `False`.
  - API: PUT profile with `artisan: true` then GET returns `artisan: true`.
  - API: PUT with `agriculturist: true, artisan: true` → 422 and the body contains "Escolha só uma profissão".
- [ ] **Step 2: Run** `pnpm nx test db` and `pnpm nx test api` — Expected: FAIL.
- [ ] **Step 3: Implement** — Pydantic `model_validator(mode="after")` raising `ValueError("Escolha só uma profissão")`.
- [ ] **Step 4: Run** both — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add Artisan profession to the profile`

---

### Task 3: `GET /plantables/value` returns the comparison

**Files:**
- Modify: `packages/api/stardew_valley_api/models.py` (`SeedValueOut`, new `QualityPricesOut`, `ArtisanProductOut`)
- Modify: `packages/api/stardew_valley_api/routes/game.py` (`list_seed_values`, `_sell_prices`)
- Test: `packages/api/tests/test_game_routes.py`

**Interfaces:**
- Consumes: Task 1 functions.
- Produces:
  - Query param `artisan: bool = False`.
  - `SeedValueOut` adds `prices: QualityPricesOut | None`, `jar: ArtisanProductOut | None`, `keg: ArtisanProductOut | None`, `jar_gold_per_day_tenths: int | None`, `keg_gold_per_day_tenths: int | None` (camelCase via `CamelModel`).
  - `_sell_prices` returns `dict[str, tuple[int, CropKind]]`: kind from `item.item_type` (`"frutas"` → fruit, `"vegetais"` → vegetable, else other).

- [ ] **Step 1: Write failing tests** with the existing route fixtures: a fruit seed returns `jar.item == "jelly"`, `keg.item == "wine"`, `prices.iridium == 2 * sellPrice`; `artisan=true` raises `jar.price` by ×1.4 floor; a flower seed returns `jar` and `keg` `null`; existing fields unchanged.
- [ ] **Step 2: Run** `pnpm nx test api` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm nx test api` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): return jar and keg comparison in seed values`

---

### Task 4: Website client and profession selector

**Files:**
- Regenerate: `packages/website/src/generated/stardew-valley-api/*` via `pnpm nx run website:generate:stardew-valley-api-client`
- Modify: `packages/website/src/components/GameDayNav.tsx` (`DayEditor`)
- Modify: `packages/website/src/hooks/useGameData.ts` (`SeedValueParams.artisan: boolean`)
- Modify: `packages/website/src/routes/sementes.tsx` (pass `artisan`), `packages/website/src/components/SeedCatalog.tsx` (forward `artisan` into `useSeedValues`)
- Test: `packages/website/src/components/GameDayNav.spec.tsx`

**Interfaces:**
- Produces: `type Profession = 'none' | 'agriculturist' | 'artisan'`; `professionOf(profile): Profession` and `professionFlags(p: Profession): { agriculturist: boolean; artisan: boolean }` in `lib/gameDate.ts` or a new `lib/profession.ts`. `SeedCatalog` prop `artisan: boolean`.

- [ ] **Step 1: Write failing tests**: the day editor shows `SegmentedButtons` labeled "Profissão (nível 10 de Lavrador)" with options "Nenhuma", "Agricultor", "Artesão"; choosing "Artesão" and saving sends `{ agriculturist: false, artisan: true }`; the old "Profissão Agricultor" toggle is gone.
- [ ] **Step 2: Run** `pnpm nx test website -- GameDayNav` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm nx test website` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(website): choose the level-10 farming profession`

---

### Task 5: Comparison on the seed cards

**Files:**
- Modify: `packages/website/src/lib/seedValues.ts`
- Create: `packages/website/src/components/SeedDestinations.tsx`
- Modify: `packages/website/src/components/SeedCatalog.tsx`
- Test: `packages/website/src/lib/seedValues.spec.ts`, `packages/website/src/components/SeedCatalog.spec.tsx`

**Interfaces:**
- Consumes: regenerated `SeedValueOut` (Task 4).
- Produces:
  - `SeedSort` adds `'bestPerDay'`; `SORT_OPTIONS` adds `{ value: 'bestPerDay', label: 'Melhor g/dia' }`.
  - `type Destination = 'raw' | 'jar' | 'keg'`; `bestDestination(value: SeedValueOut): Destination | null` (highest per-day; ties keep order raw, jar, keg; null when all missing).
  - `SeedDestinations({ value }: { value: SeedValueOut })`.

- [ ] **Step 1: Write failing tests**:
  - `buildSeedRows(..., 'bestPerDay')` orders by `max(goldPerDayTenths, jarGoldPerDayTenths, kegGoldPerDayTenths)` descending.
  - `bestDestination` for raw 100 / jar 300 / keg 300 → `'jar'`.
  - Card shows "Base", "Prata", "Ouro", "Irídio" prices; lines "Direto", "Jarra · Geleia", "Barril · Vinho" with `g/dia` via `formatGoldPerDay`; best line has class `text-green-700`; seed without product shows "—" on Jarra and Barril.
  - On mobile the price row is behind a button `aria-label="Ver preços"` / `title="Ver preços"` (`ChevronDownIcon`); clicking it reveals the prices.
  - Note text "Jarra e barril supõem máquinas suficientes para toda a colheita." is rendered under the filters.
- [ ] **Step 2: Run** `pnpm nx test website -- seedValues SeedCatalog` — Expected: FAIL.
- [ ] **Step 3: Implement** — product names via `useGameNames().nameOf(item)`; price row `hidden sm:flex` plus the toggle button `sm:hidden`.
- [ ] **Step 4: Run** `pnpm nx run-many -t lint test build` — Expected: all green.
- [ ] **Step 5: Commit** `feat(website): compare raw, jar and keg on seed cards`

---

### Task 6: Verify and PR

- [ ] **Step 1: Manual check** with the `run` skill: `/sementes` in spring with Morango/Couve-flor, toggle Artesão in the day editor and see jar/keg values rise; light and dark themes; mobile width.
- [ ] **Step 2: Push and open PR** to `main` (API + db + website). After merge the API deploy picks up the new fields; no data import needed.
