# Stardew Helper: fish page, rain of the day and rain fish on /hoje (design)

Date: 2026-11-14 · Branch: `feat/stardew-fish` (from `main` at `81f99a4`)

First of three sub-projects agreed on 2026-11-14 (order: **fish** → seed efficiency with machines → UX
review). Reference: the community scheduler at `.tmp/stardew-valley-scheduler`
(`components/FishInfoDialog.tsx`, `data/fish.ts`).

## Goal

- A `/peixes` page to look up every fish by season, weather, type and name, with its location and the
  hours it can be caught.
- A "chovendo hoje" toggle next to the game day control in the header, saved in the player profile.
- When it rains, the `/` (Hoje) page offers a modal with the fish that can be caught today, rain-only
  fish first.
- Shops that close or open with rain follow the toggle.

## Decisions

- **Data source:** the existing pipeline (`game-data` → DynamoDB → API → website). The 70 files in
  `.tmp/data/peixes` are already imported as `Item` with `catch{tool, seasons, weather, timeWindows,
  location, locationVerified}`; no re-import is needed. The reference's `fish.ts` (wiki data) is not used.
- **Typed route** `GET /fish` with a `FishOut` model (chosen over parsing `GET /game/peixes` in the
  website), so the contract lives in the OpenAPI and the client is generated.
- **Rain lives in the profile** (`rainToday`), next to `currentDate`, so it is the same on every device.
  The server resets it when the date changes.
- **Rain only for today.** No "chove amanhã" forecast.
- **New dependency `lucide-react`** in the website, only for the `CloudRain` icon: Heroicons (the
  default, already installed) has no rain icon. Added through the pnpm catalog like `@heroicons/react`.
- **Cost:** no new AWS resource, no versioning. The route runs in the existing Lambda / API Gateway and
  the new attribute uses the existing table.
- **Out of scope:** fish sell prices (not in the data), rain forecast, "já peguei" / progress tracking,
  verifying locations, i18n beyond pt-BR.

## Data (facts from `.tmp/data/peixes`)

| Field | Values |
|---|---|
| `catch.tool` | `rod` (60), `crabPot` (10) |
| `subtype` | none (57), `legendary` (5), `legendary-ii` (5), `night-market` (3) |
| `catch.weather` | `any` (61), `rain` (6), `sun` (3) |
| `catch.timeWindows` | 1 window (68), 2 windows (2); `{"from": "HH:MM", "to": "HH:MM"}`, `"(+1d)"` suffix after midnight |
| `catch.location` | `{en, pt-BR}` free text; `locationVerified` is `false` for all 70 |
| `sellPrice` | absent for all 70 |

All 70 ids have an image in `website/src/lib/icon-manifest.json`.

## API

### `GET /fish`

Public game-data route (no player data), next to `GET /plantables`, same IAM auth. Response
`list[FishOut]`, sorted by pt-BR name:

```text
FishOut
  id: str
  name: LocalizedTextOut
  tool: "rod" | "crab-pot"
  category: "regular" | "night-market" | "legendary" | "legendary-ii"   # from subtype; none = regular
  seasons: list[Season]
  weather: "any" | "sun" | "rain"
  windows: list[FishWindowOut]
  location: LocalizedTextOut
  locationVerified: bool

FishWindowOut
  fromMinute: int   # minutes since 00:00 of the game day
  toMinute: int     # "(+1d)" adds 1440: 06:00–02:00 (+1d) = 360–1560
```

### Conversion (`api/stardew_valley_api/fish.py`, pure functions)

- `parse_time("HH:MM")` → minutes; `"HH:MM (+1d)"` → minutes + 1440. Anything else raises `ValueError`.
- `fish_out(item)` maps `crabPot` → `crab-pot`, `subtype` → `category` (unknown subtype → error) and
  each window to `FishWindowOut`; requires `from < to`.
- The route reads `list_folder("peixes")`; an item whose conversion fails is **skipped and logged as a
  warning** (Powertools logger), so one bad record does not break the list.

### Profile: `rainToday`

- `PlayerProfile.rain_today = BooleanAttribute(default=False, attr_name="rainToday")`; profiles saved
  before this change read as `false`.
- `ProfileIn` / `ProfileOut` gain `rain_today: bool = False`.
- `PUT /me/profile`: when `body.current_date` differs from the stored date, the server stores
  `rainToday = false` whatever the body says; otherwise it stores `body.rain_today`.

## Website

### `lib/fish.ts` (pure)

- `fishFilter({season, weather, kind, query})`:
  - season: fish whose `seasons` include it;
  - weather `all` | `sun` | `rain`: `sun` keeps `any` + `sun`, `rain` keeps `any` + `rain`;
  - kind `all` | `rod` | `crab-pot` | `special` (`special` = night-market + legendary + legendary-ii);
  - query: case- and accent-insensitive match on the pt-BR name.
- `groupFish(list)` → sections in this order, each with a count: Vara (regular rod), Mercado Noturno,
  Lendários, Lendários II, Covo; empty sections are dropped.
- `rainFishToday(list, season)` → `{ rainOnly, others }` for the modal.
- `formatWindow({fromMinute, toMinute})` → `"06:00–19:00"`, minutes ≥ 1440 shown modulo 1440.
- `windowBar(window)` → `{ left, width }` percentages of the 06:00 → 02:00 (360 → 1560) axis.
- Preferences (`season`, `weather`, `kind`) in `localStorage`, every access in try/catch, defaults
  when missing or invalid (same pattern as `lib/seedValues.ts`).

### Hook

`useFish()` in `hooks/useGameData.ts`, React Query over the generated client, long `staleTime` like the
other game-data hooks.

### `/peixes` page (`routes/peixes.tsx`, `components/FishCatalog.tsx`, `components/FishCard.tsx`)

- Nav item "Peixes" after "Sementes" (`AppShell`).
- Filters: `SeasonTabs` (default: profile season), `SegmentedButtons` for weather (Todos / Sol / Chuva;
  first visit defaults to Chuva when `rainToday`, else Todos), `SegmentedButtons` for type
  (Todos / Vara / Covo / Especiais), a search input.
- One line at the top: "Locais ainda não verificados com o jogo." (all locations are unverified).
- Grid adapted from Tailwind Plus `lists/grid-lists` (same base as `SeedCatalog`), grouped by
  `groupFish`. `FishCard`: `GameIcon`, pt-BR name, location, season badges, weather icon when not `any`
  (`SunIcon` from Heroicons; `CloudRain` from `lucide-react`, Heroicons has no rain icon) and the hour
  bar.
- Hour bar: Tailwind track with filled segments; segment position uses `style={{ left, width }}`
  (percentages from `windowBar`), the only non-utility style, since the values are per fish. The
  text `formatWindow` is shown next to it and is the accessible label.
- Clicking a card opens the existing `ItemDrawer` for that item.
- States: skeleton while loading, "Não foi possível carregar os peixes. Recarregue a página.", and
  "Nenhum peixe com esses filtros."

### Rain toggle in the header (`GameDayNav`)

- **Icon-only button** (no visible text) next to the "Dia anterior" / "Próximo dia" buttons, same size
  and style as them: `CloudRain` icon, `aria-pressed`, `aria-label` and `title` "Chovendo hoje" when on /
  "Sem chuva hoje" when off. Off: gray icon like the other day buttons; on: indigo background and white
  icon.
- Click saves the profile with `rainToday` flipped through the existing `onSave`
  (`useUpdateProfile`). Changing the day returns the reset value from the server.
- Stays in the same group as the day controls on mobile (no new header row).

### Rain on `/` (Hoje)

- When `profile.rainToday`, an `alert` at the top: "Está chovendo hoje" + button "Ver peixes de chuva".
- The button opens `Modal` with `rainFishToday(fish, currentSeason)`: section "Só na chuva" first, then
  the others grouped by `groupFish`, using `FishCard`, and a link "Ver todos os peixes" to `/peixes`.
- Nothing about fish is shown when it does not rain.

### Shops follow the rain (`lib/shops.ts`, `OpenShops`)

`ShopProgress` gains `rainToday`. In `shopStatusToday` / `closedReason`:

- `closedIfRain` and raining → closed, reason "Chuva";
- `openIfRainOnly` includes today's weekday and raining → that weekday is not a closed day (open);
  not raining → stays closed as today;
- the notes "Fecha se chover" / "Abre se chover" stay only while it is not raining.

## Testing (through Nx)

- API (pytest): `parse_time` (plain, `(+1d)`, invalid), `fish_out` (rod, crab pot, legendary rain fish,
  two windows, unknown subtype, `from ≥ to`), `GET /fish` with the new fixtures (bad record skipped),
  `PUT /me/profile` (rain kept on the same day, reset on a new day, old profile without the attribute).
- Fixtures: `db/tests/fixtures/data/peixes/` — a regular rod fish, a crab-pot fish, a legendary rain
  fish, a fish with two windows, and one malformed record.
- Website (Vitest + Testing Library): `lib/fish.ts` (filters, groups, rain split, window format and bar),
  `/peixes` (loading, error, empty, filters), `GameDayNav` rain button (`aria-pressed`, saved profile),
  rain alert and modal on `/`, `shopStatusToday` with and without rain.

## Delivery

1. API: `fish.py`, `FishOut`, `GET /fish`, `rainToday` in profile; regenerate the OpenAPI client.
2. Website: `lib/fish.ts`, `useFish`, `/peixes`, rain toggle, rain alert/modal, shops with rain.
3. Deploy with the existing `infra` plan/apply; no data import.
