# Stardew Fish and Rain of the Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/peixes` lookup page, a "chovendo hoje" toggle in the header saved in the profile, a rain-fish modal on `/` and shops that follow the rain.

**Architecture:** The API gains a typed `GET /fish` (pure conversion in `fish.py` over the already-imported `Item.catch`) and a `rainToday` profile flag that the server resets when the date changes. The website consumes the generated client through `useFish`, filters and groups in the pure `lib/fish.ts`, and renders shared `FishCard`s in the page and the modal.

**Tech Stack:** FastAPI + PynamoDB + pytest/moto (API), React 19 + TanStack Router/Query + Tailwind 4 + Vitest/Testing Library (website), Nx + pnpm + uv.

**Spec:** `docs/superpowers/specs/2026-11-14-stardew-fish-design.md`

## Global Constraints

- No new AWS resource, no versioning; existing Lambda, API Gateway and table only.
- Tailwind utility classes only; the single exception is `style={{ left, width }}` on the hour-bar segments.
- Icons from `@heroicons/react`; `CloudRain` from `lucide-react` (catalog `1.48.0`) only for rain.
- Every icon-only button has `aria-label` and the same text in `title`, in Portuguese.
- UI copy in pt-BR; code, docs and commits in English; attributes and query params in `camelCase`.
- Structured Powertools logger only; no PII in logs.
- `localStorage` access always in try/catch with defaults (pattern of `lib/seedValues.ts`).
- Run tasks through Nx: `pnpm nx test|lint <project>`. Projects: `aws_danhenrique.stardew_valley_api`, `aws_danhenrique.stardew_valley_db`, `@aws-danhenrique/stardew-valley-helper-website`.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ntabp7pjC2JH9bk9aVe8EK
  ```

## Review Focus

- **Stepping the day while it rains:** the optimistic profile in `useUpdateProfile` would keep `rainToday: true` until the refetch; the client must send `rainToday: false` whenever it changes the date (Task 5 test).
- **Windows crossing midnight:** `18:00–02:00 (+1d)` must draw from 75% to 100% of the bar and read "18:00–02:00", not a negative width (Task 3 test).
- **Accented search:** "picao" must find "Picão-verde" (Task 3 test).
- **Saved filter from an older/invalid value** in `localStorage` (e.g. `kind: "legendary"`) falls back to the default instead of an empty page (Task 3 test).
- **Rain toggle while a save is pending:** a second click must flip from the optimistic value, not the stale one (Task 5 test: two clicks send `true` then `false`).

---

### Task 1: API `GET /fish`

**Files:**
- Create: `packages/stardew-valley/api/stardew_valley_api/fish.py`
- Create: `packages/stardew-valley/api/stardew_valley_api/routes/fish.py`
- Modify: `packages/stardew-valley/api/stardew_valley_api/models.py` (add `FishWindowOut`, `FishOut`)
- Modify: `packages/stardew-valley/api/stardew_valley_api/main.py` (import `fish` with the other route modules)
- Create fixtures in `packages/stardew-valley/db/tests/fixtures/data/peixes/`: `test-rod-fish.json`, `test-crab.json`, `test-legend-rain.json`, `test-two-windows.json`, `test-bad-fish.json`; add their ids under `"peixes"` in `db/tests/fixtures/data/_meta/index.json`
- Test: `packages/stardew-valley/api/tests/test_fish.py`

Fixture content (same shape as `.tmp/data/peixes/*.json`, names `{en, pt-BR}`):

| id | subtype | tool | seasons | weather | timeWindows | pt-BR name |
|---|---|---|---|---|---|---|
| test-rod-fish | — | rod | spring, summer | any | 06:00–19:00 | Peixe Teste |
| test-crab | — | crabPot | all four | any | 06:00–02:00 (+1d) | Caranguejo Teste |
| test-legend-rain | legendary | rod | spring | rain | 06:00–02:00 (+1d) | Lenda Teste |
| test-two-windows | night-market | rod | winter | sun | 06:00–11:00, 18:00–02:00 (+1d) | Duas Janelas |
| test-bad-fish | — | rod | spring | any | 25:99–19:00 | Peixe Ruim |

All with `location {en, pt-BR}` and `locationVerified: false`.

**Interfaces:**
- Produces (Python): `parse_time(value: str) -> int`; `fish_out(item: Item) -> FishOut` (raises `ValueError` on bad data).
- Produces (HTTP): `GET /fish -> list[FishOut]`, operationId so the generated client exposes `api.listFish`; JSON fields `id, name, tool ("rod"|"crab-pot"), category ("regular"|"night-market"|"legendary"|"legendary-ii"), seasons, weather ("any"|"sun"|"rain"), windows [{fromMinute, toMinute}], location, locationVerified`.

- [ ] **Step 1: Write failing tests** in `test_fish.py`:
  - `test_should_parse_time_when_plain` → `parse_time("06:00") == 360`
  - `test_should_add_a_day_when_time_has_plus_1d` → `parse_time("02:00 (+1d)") == 1560`
  - `test_should_reject_time_when_malformed` (parametrize `"25:99"`, `"6h"`, `""`) → `ValueError`
  - `test_should_list_valid_fish_sorted_by_pt_br_name_when_getting_fish(client)` → ids `["test-crab", "test-two-windows", "test-legend-rain", "test-rod-fish"]` (no `test-bad-fish`)
  - `test_should_map_crab_pot_and_category_when_getting_fish(client)` → `test-crab.tool == "crab-pot"`, `category == "regular"`; `test-legend-rain.category == "legendary"`, `weather == "rain"`
  - `test_should_return_two_windows_in_minutes_when_fish_has_two(client)` → `[{"fromMinute": 360, "toMinute": 660}, {"fromMinute": 1080, "toMinute": 1560}]`
  - `test_should_reject_unknown_subtype_and_empty_window` → `fish_out` raises for `subtype="boss"` and for `from == to`
- [ ] **Step 2: Run** `cd packages/stardew-valley/api && uv run pytest tests/test_fish.py -v` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `fish.py` (pure; `parse_time` accepts exactly `HH:MM` with optional ` (+1d)`, hours 0–23, minutes 0–59) and the route in `routes/fish.py` with `@app.get("/fish")` + `@tracer.capture_method`, reading `list_folder("peixes")`; on `ValueError` call `logger.warning("Skipping invalid fish", extra={"fishId": item.entity_id})` and continue; sort by `name["ptBr"]` with the same localized-name helper used in `game.py`.
- [ ] **Step 4: Run** `pnpm nx test aws_danhenrique.stardew_valley_api` and `pnpm nx test aws_danhenrique.stardew_valley_db` — Expected: PASS (db tests still pass with the new fixtures).
- [ ] **Step 5: Commit** `feat(stardew-valley-api): list fish with catch windows`

### Task 2: API profile `rainToday`

**Files:**
- Modify: `packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/entities/player.py` (`rain_today = BooleanAttribute(default=False, attr_name="rainToday")`, also in `get_or_default`)
- Modify: `packages/stardew-valley/api/stardew_valley_api/models.py` (`ProfileIn.rain_today: bool = False`)
- Modify: `packages/stardew-valley/api/stardew_valley_api/routes/player.py` (`update_profile`, `_profile_out`)
- Test: `packages/stardew-valley/api/tests/test_player_routes.py` (update the two exact-dict profile assertions to include `"rainToday": False`)

**Interfaces:**
- Produces: `ProfileIn` / `ProfileOut` / generated TS `ProfileIn` with `rainToday: boolean` (optional on input, default `false`).

- [ ] **Step 1: Write failing tests:**
  - `test_should_keep_rain_when_profile_date_does_not_change` → PUT `{currentDate: SPRING_1, rainToday: true}` twice; `/me` profile `rainToday is True`
  - `test_should_reset_rain_when_profile_date_changes` → PUT with `SPRING_1, rainToday: true`, then PUT with day 2 and `rainToday: true`; response and `/me` have `rainToday is False`
  - `test_should_read_rain_as_false_when_profile_was_saved_without_it` → save a `PlayerProfile` directly without the attribute (or default), `/me` → `rainToday is False`
- [ ] **Step 2: Run** `cd packages/stardew-valley/api && uv run pytest tests/test_player_routes.py -v` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** in `update_profile`: compare `body.current_date` with the stored `profile.current_date` (year, season, day) **before** overwriting; `profile.rain_today = False if changed else body.rain_today`.
- [ ] **Step 4: Run** `pnpm nx test aws_danhenrique.stardew_valley_api` and `pnpm nx test aws_danhenrique.stardew_valley_db` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-api): save rain of the day in the profile`

### Task 3: Website fish logic and data hook

**Files:**
- Modify: `packages/stardew-valley/website/package.json` (`"lucide-react": "catalog:"`), then `pnpm install`
- Create: `packages/stardew-valley/website/src/lib/fish.ts`
- Modify: `packages/stardew-valley/website/src/hooks/useGameData.ts` (`useFish`)
- Modify: `packages/stardew-valley/website/src/components/testData.ts` (export `FISH: FishOut[]` mirroring the 4 valid fixtures, plus one regular rain fish `test-rain-only` in spring and one regular `any` fish in fall)
- Test: `packages/stardew-valley/website/src/lib/fish.spec.ts`

**Interfaces:**
- Consumes: generated `FishOut`, `FishWindowOut`, `Season`, `api.listFish` (Task 1).
- Produces:
  ```ts
  export type FishWeatherFilter = 'all' | 'sun' | 'rain';
  export type FishKindFilter = 'all' | 'rod' | 'crab-pot' | 'special';
  export type FishFilters = { season: Season; weather: FishWeatherFilter; kind: FishKindFilter; query: string };
  export type FishSection = { id: 'rod' | 'night-market' | 'legendary' | 'legendary-ii' | 'crab-pot' | 'rain-only'; title: string; fish: FishOut[] };
  export const filterFish: (fish: FishOut[], filters: FishFilters) => FishOut[];
  export const groupFish: (fish: FishOut[]) => FishSection[];          // Vara, Mercado Noturno, Lendários, Lendários II, Covo; empty dropped
  export const rainFishSections: (fish: FishOut[], season: Season) => FishSection[]; // "Só na chuva" first, then groupFish of the rest
  export const formatWindow: (w: FishWindowOut) => string;             // "06:00–19:00"
  export const windowBar: (w: FishWindowOut) => { left: number; width: number }; // % of 360→1560
  export type FishPrefs = Pick<FishFilters, 'season' | 'weather' | 'kind'>;
  export const loadFishPrefs: (fallback: FishPrefs) => FishPrefs;
  export const saveFishPrefs: (prefs: FishPrefs) => void;
  export const useFish: () => UseQueryResult<FishOut[]>;             // in useGameData.ts, staleTime: Infinity
  ```
  Section titles (exact): `Vara`, `Mercado Noturno`, `Lendários`, `Lendários II`, `Covo`, `Só na chuva`.

- [ ] **Step 1: Write failing tests** in `fish.spec.ts`:
  - `should keep any and sun fish when weather is sun` / `... any and rain ... rain`
  - `should keep night market and legendary fish when kind is special`
  - `should match the name without accents when searching` → query `"picao"` finds a fish named `"Picão-verde"`
  - `should group in Vara, Mercado Noturno, Lendários, Lendários II, Covo order and drop empty groups`
  - `should put rain-only fish first when building rain sections` → first section title `"Só na chuva"`, contains `test-legend-rain` and `test-rain-only`; no fish from other seasons
  - `should format a window crossing midnight` → `{1080, 1560}` → `"18:00–02:00"`
  - `should place a window crossing midnight at the end of the bar` → `{1080, 1560}` → `{ left: 60, width: 40 }`; `{360, 1560}` → `{ left: 0, width: 100 }`
  - `should fall back to defaults when saved prefs are invalid` → `localStorage` holds `{"kind":"legendary"}` → `loadFishPrefs(fallback).kind === fallback.kind`
  - `should fall back to defaults when localStorage throws`
- [ ] **Step 2: Run** `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- fish` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/fish.ts` (accent folding with `normalize('NFD')` + strip combining marks, lowercase) and `useFish`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add fish filters and data hook`

### Task 4: `/peixes` page

**Files:**
- Create: `packages/stardew-valley/website/src/components/FishCard.tsx`, `FishDrawer.tsx`, `FishCatalog.tsx`
- Create: `packages/stardew-valley/website/src/routes/peixes.tsx` (route tree regenerates on build/dev)
- Modify: `packages/stardew-valley/website/src/components/AppShell/index.tsx` (nav `{ name: 'Peixes', to: '/peixes' }` after Sementes)
- Test: `components/FishCard.spec.tsx`, `components/FishCatalog.spec.tsx`, `routes/peixes.spec.tsx`

**Interfaces:**
- Consumes: Task 3 exports; `SeasonTabs`, `SegmentedButtons`, `GameIcon`, `ItemDrawer`, `Skeleton*`.
- Produces: `FishCard({ fish, onSelect }: { fish: FishOut; onSelect?: (fish: FishOut) => void })` (a `<button>` when `onSelect` is given); `FishSectionList({ sections, onSelect })` exported from `FishCatalog.tsx` for reuse in the modal; `FishCatalog({ fish, initialPrefs }: { fish: FishOut[]; initialPrefs: FishPrefs })`.

Card details: grid base copied from `SeedCatalog` (Tailwind Plus `lists/grid-lists/03-simple-cards`); `GameIcon` size `md` with the fish id; pt-BR name; location `line-clamp-2`; season badges with `SEASON_LABELS`; `SunIcon` (Heroicons 20/solid) or `CloudRain` (lucide) with `aria-label`/`title` "Só com sol" / "Só com chuva" when weather ≠ any; hour bar = gray track `h-1.5 rounded-full` with indigo segments positioned by `windowBar`, followed by the `formatWindow` texts joined with " · ".
`FishDrawer` = `ItemDrawer` titled with the fish name, showing full location, every window, seasons, weather and tool, footer with a "Fechar" button. The spec said "existing ItemDrawer for that item"; `ItemDrawer` is a generic shell with no item content, so the drawer content is the fish details above (no gift tastes).

- [ ] **Step 1: Write failing tests:**
  - FishCard: `should show name, location, seasons and hour text`; `should label rain-only fish` (`getByTitle('Só com chuva')`); `should position the hour segment` (segment `style.left === '60%'` for 18:00–02:00)
  - FishCatalog: `should show the unverified locations notice`; `should filter by weather and kind and persist the choice`; `should show the empty message when no fish match` → text `Nenhum peixe com esses filtros.`; `should open the drawer with the full location when a card is clicked`
  - route: `should show a skeleton while fish load` (`Carregando peixes...`); `should show the error message` (`Não foi possível carregar os peixes. Recarregue a página.`); `should start on the profile season and on Chuva when it rains`
- [ ] **Step 2: Run** `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- Fish peixes` — Expected: FAIL.
- [ ] **Step 3: Implement** the components and route (`initialPrefs` fallback = `{ season: profile.currentDate.season, weather: profile.rainToday ? 'rain' : 'all', kind: 'all' }`, then `loadFishPrefs(fallback)`).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add the fish page`

### Task 5: Rain toggle in the header

**Files:**
- Modify: `packages/stardew-valley/website/src/components/GameDayNav.tsx`
- Test: `packages/stardew-valley/website/src/components/GameDayNav.spec.tsx`

**Interfaces:**
- Consumes: `ProfileIn.rainToday` (Task 2).
- Produces: no new export; `GameDayNav` renders the rain button.

Button: separate from the day group (`ml-2`), reusing `SEGMENT` plus `rounded-md px-2`; `CloudRain` `size-5`; `aria-pressed={rainToday}`; label/title "Chovendo hoje" when on, "Sem chuva hoje" when off; when on, `bg-indigo-600 text-white inset-ring-indigo-600 hover:bg-indigo-500` (dark same).

- [ ] **Step 1: Write failing tests:**
  - `should save rainToday true when the rain button is pressed` → `onSave` called with `{ ...profile, rainToday: true }`
  - `should show the pressed state when it rains` → `getByRole('button', { name: 'Chovendo hoje' })` has `aria-pressed="true"`
  - `should send rainToday false when stepping to the next day while it rains`
  - `should send rainToday false when the day editor changes the date while it rains`; and keeps `rainToday` when only flags change in the editor
  - `should flip from the latest profile when clicked twice` (rerender with the profile returned by the first `onSave`) → second call `rainToday: false`
- [ ] **Step 2: Run** `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- GameDayNav` — Expected: FAIL.
- [ ] **Step 3: Implement**: rain button; `step()` and `DayEditor` send `rainToday: false` when the date differs from `profile.currentDate`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): toggle rain of the day in the header`

### Task 6: Shops follow the rain

**Files:**
- Modify: `packages/stardew-valley/website/src/lib/shops.ts` (`ShopProgress` picks `rainToday` too; `closedReason`, `shopStatusToday`, `fixedClosedDays`)
- Modify: `packages/stardew-valley/website/src/routes/index.tsx:88` (pass `rainToday: profile.rainToday` in `progress`)
- Test: `packages/stardew-valley/website/src/lib/shops.spec.ts`

**Interfaces:**
- Produces: `ShopProgress = Pick<ProfileIn, 'communityCenterRestored' | 'keyToTown' | 'boatRepaired' | 'rainToday'>`; reason text `"Chuva"`.

- [ ] **Step 1: Write failing tests:**
  - `should close a closedIfRain shop when it rains` → status closed, reason `"Chuva"`, no "Fecha se chover" note
  - `should open an openIfRainOnly shop on that weekday when it rains`
  - `should keep the openIfRainOnly weekday closed and the notes when it does not rain` (current behavior)
  - `fixedClosedDays` keeps listing the `openIfRainOnly` days (the weekly table does not depend on today's rain)
- [ ] **Step 2: Run** `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- shops` — Expected: FAIL.
- [ ] **Step 3: Implement**: in `closedReason`, check `closedIfRain && rainToday` before the weekday rule and exclude `openIfRainOnly` days from today's closed days when `rainToday`; notes pushed only when `!rainToday`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): apply rain of the day to shop hours`

### Task 7: Rain alert and rain-fish modal on `/`

**Files:**
- Create: `packages/stardew-valley/website/src/components/RainFishModal.tsx`
- Modify: `packages/stardew-valley/website/src/routes/index.tsx` (alert at the top when `profile.rainToday`)
- Test: `components/RainFishModal.spec.tsx`, `routes/index.spec.tsx` (add `useFish` to the mocks)

**Interfaces:**
- Consumes: `useFish`, `rainFishSections`, `FishSectionList`, `Modal`, `Alert`.
- Produces: `RainFishModal({ open, onClose, season }: { open: boolean; onClose: () => void; season: Season })` (calls `useFish` itself; skeleton / error inside the modal body).

Copy (exact): alert header `Está chovendo hoje`; button `Ver peixes de chuva`; modal title `Peixes de chuva`; footer link `Ver todos os peixes` to `/peixes`.

- [ ] **Step 1: Write failing tests:**
  - index: `should show the rain alert when it rains` / `should not show the rain alert when it does not rain`
  - index: `should open the rain fish modal from the alert`
  - modal: `should list rain-only fish first for the season`; `should link to the fish page`; `should show the error message when fish fail to load`
- [ ] **Step 2: Run** `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- RainFish index` — Expected: FAIL.
- [ ] **Step 3: Implement** the modal and the alert.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show rain fish on the today page`

### Task 8: Whole-branch verification

- [ ] **Step 1: Run** `pnpm nx run-many -t lint test -p aws_danhenrique.stardew_valley_db aws_danhenrique.stardew_valley_api @aws-danhenrique/stardew-valley-helper-website` — Expected: all succeed.
- [ ] **Step 2: Run** `pnpm nx build @aws-danhenrique/stardew-valley-helper-website` — Expected: succeeds (route tree includes `/peixes`).
- [ ] **Step 3: Run the app** (`pnpm nx dev @aws-danhenrique/stardew-valley-helper-website`, mocked login) and check: `/peixes` filters, rain button on/off, day step resets rain, alert + modal on `/`, a rain-closing shop in "Lojas abertas"; light and dark themes; 375px width without horizontal scroll.
- [ ] **Step 4: Commit** any fixes; deploy follows the existing `infra` plan/apply (no data import).
