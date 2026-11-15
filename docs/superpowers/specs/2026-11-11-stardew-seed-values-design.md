# Stardew Helper: seed values and sorting on /sementes (design)

Date: 2026-11-11 · Branch: `feat/stardew-seed-values` (from `feat/stardew-open-shops-grid` at `562a71e`)

## Goal

Let the player compare seeds on the `/sementes` tab by **how much gold they produce**, taking the
fertilizer and the farming level into account:

- each seed card shows its **gold per day** and its **gold in the window** (with the harvest count);
- the list can be **sorted** by gold per day (default), gold in the window or name;
- the player picks a **fertilizer** (speed or quality), a **farming level** (0–10) and a **period**
  ("Estação inteira" or "A partir de hoje").

## Scope and decisions

- **Gold, not profit.** Values are the sale value of the harvests; the seed cost is **not** subtracted.
- **Community convention (Stardew Profits):** gold per day = total gold ÷ days in the window. Days left
  idle at the end of the season, when the last cycle does not fit, count against the seed. Rejected:
  dividing by the days until the last harvest (rewards idle beds) and price ÷ one cycle (the quick wiki
  sum, unfair to regrowing crops).
- **Window** = from `fromDay` to day 28 of the chosen season, for every seed. Crops that live in several
  seasons (corn, coffee…) are cut at day 28 too, so every seed is measured over the same days. Accepted
  trade-off: multi-season crops with a long first growth are slightly undervalued.
- **Single-harvest crops are replanted** on their harvest day until a new cycle no longer fits.
- **The calculation runs in the API**, reusing the growth rules of `schedule.py` (`effective_growth_days`,
  `speed_pct`), so `/sementes` and the plantings calendar always agree on the harvest days. Rejected:
  exposing prices and phases in `PlantableOut` and computing in the website (duplicates the Speed-Gro
  phase algorithm in TypeScript) and a hybrid split (more complex, no gain).
- **Farming level lives in the browser** (`localStorage`), not in the profile. Saving it in the profile
  (with Tiller) is a possible follow-up.
- **Out of scope:** seed cost, fruit trees (their fruits have no `sellPrice` in the data), wild seeds
  (random forage), greenhouse and Ginger Island, keg/jar products, Tiller (+10%), food buffs,
  cross-season windows.

## API

### `GET /plantables/value`

Public game-data route (no player data), next to `GET /plantables`.

| query | type | rule |
|---|---|---|
| `season` | `Season` | required |
| `fromDay` | int | 1–28, default 1 |
| `fertilizer` | `ValueFertilizer` | `none`, `basic`, `quality`, `deluxe`, `speed-gro`, `deluxe-speed-gro`, `hyper-speed-gro`; default `none` |
| `farmingLevel` | int | 0–10, default 0 |
| `agriculturist` | bool | default `false`; the website sends the profile value |

Out-of-range values return 422 (FastAPI/Pydantic validation, as in the other routes).

Response: `list[SeedValueOut]`, one item per **crop** seed that grows on the farm in `season`:

```text
SeedValueOut
  id: str               # seed id, same as PlantableOut.id
  harvests: int         # harvests inside the window
  days: int             # window length = 28 - fromDay + 1
  goldTotal: int | None # rounded; None when the produce has no sellPrice or is random (wild seeds)
  goldPerDayTenths: int | None  # tenths of gold, rounded: 157 = 15.7 g/dia (rules/coding.md: no floats for money)
  willNotMature: bool   # no harvest fits in the window
  approximate: bool     # same meaning as in ScheduleOut (seed without phases + speed fertilizer)
```

Fruit trees are not returned; the website shows them without a value.

### Calculation (`api/stardew_valley_api/crop_value.py`, pure functions)

1. **Fertilizer split.** `basic`/`quality`/`deluxe` → quality ratio 1/2/3 and speed `none`;
   speed fertilizers → ratio 0 and the same speed as `schedule.Fertilizer`. One tile holds one
   fertilizer, as in the game.
2. **Harvest days.** `growth, approximate = effective_growth_days(crop, speed_pct(speed, agriculturist))`.
   Planting on `fromDay`, the first harvest is on `fromDay + growth`.
   - Regrowing: next harvests every `regrowDays`.
   - Single harvest: replanted on the harvest day, next harvest `growth` days later.
   - A harvest counts only if its day is ≤ 28. Zero harvests → `willNotMature = true`, gold 0.
3. **Quality chances** (Stardew Profits `predictions.js`, as ported in the reference scheduler
   `cropProfit.ts`, MIT), with `L = farmingLevel` and `r` = quality ratio:
   - `gold = 0.2·(L/10) + 0.2·r·((L+2)/12) + 0.01`
   - `silver = min(0.75, 2·gold)`
   - `iridium = gold/2` when `r ≥ 3`, else 0
   - `r < 3`: P(gold) = `gold`, P(silver) = `(1−gold)·silver`, P(normal) = `(1−gold)·(1−silver)`
   - `r ≥ 3`: P(iridium) = `iridium`, P(gold) = `gold·(1−iridium)`, P(silver) = `(1−gold)·(1−iridium)`,
     P(normal) = 0
4. **Gold per harvest** = Σ P(q)·price(q) + `averageExtraYield`·`sellPrice`, with
   price(normal) = `p`, price(silver) = `⌊1.25p⌋`, price(gold) = `⌊1.5p⌋`, price(iridium) = `2p`.
   Extra crops are always normal quality, as in the game.
5. **Totals.** `goldTotal = round(harvests × goldPerHarvest)`,
   `goldPerDayTenths = round(10 × harvests × goldPerHarvest / days)`. Intermediate chances are computed
   in floating point inside the pure function; only integers leave the API.

The produce price comes from the seed's `crop.produce` item (`sell_price`). Wild seeds and seeds whose
produce has no `sell_price` return `goldTotal = goldPerDayTenths = None`; harvest counts are still filled.

## Website

### Controls (`SeedCatalog.tsx`, between `SeasonTabs` and the grid; stacked on phones)

| control | component | notes |
|---|---|---|
| Período | new segmented buttons adapted from Tailwind Plus `elements/button-groups/01-basic.jsx` | "Estação inteira" / "A partir de hoje"; the second is enabled only on the profile's current season (elsewhere it is forced to "Estação inteira"); default "A partir de hoje" on the current season |
| Fertilizante | existing `form/SelectMenu` with each fertilizer's `GameIcon` | the seven `ValueFertilizer` values, Portuguese labels |
| Nível de Agricultura | existing `form/NumberStepper` | 0–10 |
| Ordenar por | existing `form/SelectMenu` | Ouro/dia (default), Ouro no período, Nome |

Fertilizer, farming level and sort are kept in `localStorage` (every access in try/catch; defaults when
it fails). The period is not stored. "A partir de hoje" sends `fromDay` = the profile's current day;
"Estação inteira" sends 1.

### Card

Same structure as today (Tailwind Plus `lists/grid-lists/03-simple-cards.jsx`); on the right of the text:

- with value: **`123 g/dia`** (emphasised) and `1.234 g · 6 colheitas` below;
- `willNotMature`: "Não amadurece a tempo" (gray);
- no value (fruit tree, wild seed, produce without price): "—".

Numbers use `pt-BR` formatting; gold per day is shown with one decimal from `goldPerDayTenths / 10`
(display only).

### Order

1. seeds with a value, by the chosen sort (descending for gold, ascending for name);
2. seeds that do not mature in the window;
3. seeds without a value.

Ties and groups 2–3 are ordered by localized name.

### Data flow

- `hooks/useGameData.ts` gets `useSeedValues(params)`: React Query keyed by every parameter, so going
  back to a combination already seen is instant.
- The list still comes from `usePlantables()`; values are joined by `id`.
- `lib/seedValues.ts` (pure): join plantables with values, group and sort.
- **Loading:** cards render immediately, with a skeleton only in the value slot.
- **Error:** cards render without values, a notice "Não foi possível calcular os valores." appears
  above the grid, and the order falls back to name.
- The generated client (`generated/stardew-valley-api`) is regenerated from the new OpenAPI.

## Data fixes: strawberry and carrot seeds

Both show an English name and no sprite on `/sementes`.

- **Name.** `game-data/data/sementes/{strawberry,carrot}-seeds.json` have `"pt-BR": null`, so
  `localizedName` falls back to `en`. Set `"Sementes de Morango"` and `"Sementes de Cenoura"` (same pattern
  as the other seeds), keeping `nameVerified: false`, then re-run the one-shot DB import
  (`aws_danhenrique.stardew_valley_db:import`) so the API serves them. The import writes to the real
  table, so it runs only after the player confirms.
- **Strawberry sprite.** The scheduler's `seeds/strawberry.png` is the seed packet, but `sync_icons.py`
  matches files by name, so it became a variant of `strawberry` (the fruit). Add
  `"strawberry-seeds": "seeds/strawberry.png"` to `scripts/icon-overrides.json` and re-run the sync.
- **Carrot sprite.** The scheduler has no carrot seed packet (`seeds/carrot.png` is the carrot itself).
  Add `"carrot-seeds": "seeds/carrot.png"` so the card shows the carrot until a packet sprite exists.
- Out of scope: the other seeds that still lack a pt-BR name or a sprite (broccoli, pineapple,
  powdermelon, summer squash, taro, rare seed, pine cone).
- **Test:** `scripts/tests` covers the two overrides landing in `icon-manifest.json`.

## Testing

- **pytest `crop_value.py`:** quality chances for `r` = 0, 2 and 3 at levels 0 and 10; replanting
  (parsnip day 1 → 6 harvests); regrowth (green bean day 1 → 6 harvests); window from a later day;
  `willNotMature`; speed fertilizer and agriculturist changing the harvest count; extra yield at normal
  price; produce without price → `None`. Reference values are worked out by hand in the tests.
- **pytest route:** query validation (422), only farm crops of the season, fruit trees excluded.
- **Vitest `lib/seedValues.ts`:** join, the three groups, each sort, name tie-break.
- **Component tests `SeedCatalog`:** controls change the request parameters, "A partir de hoje" disabled
  outside the current season, `localStorage` persistence (and failure), value skeleton, error notice.

## Reference values (spring, normal quality only, no fertilizer, day 1)

| seed | harvests | goldTotal | goldPerDayTenths |
|---|---|---|---|
| Parsnip (35 g, 4 d) | 6 | 210 | 75 |
| Cauliflower (175 g, 12 d) | 2 | 350 | 125 |
| Kale (110 g, 6 d) | 4 | 440 | 157 |
| Green bean (40 g, 10 d, regrow 3) | 6 | 240 | 86 |
| Potato (80 g, 6 d, +0.2 extra) | 4 | 384 | 137 |

These ignore the quality chance (which is never zero, even at level 0), so the real endpoint values are
slightly higher; the tests isolate the harvest count from the price to check them.
