# Stardew Helper: preserves jar and keg comparison on Seeds, Artisan profession (design)

Date: 2026-11-16 · Branch: `feature/jarra-barril`

## Goal

On `/sementes`, show for each seed the sell price by quality, the preserves jar and keg product
values, and gold per day for each destination (sell raw, jar, keg), so the player can decide what to
plant and what to do with the harvest. Reference: `SeedEfficiencyDialog` / `cropProfit.ts` in
`.tmp/stardew-valley-scheduler`.

## Scope and decisions

- Calculation stays in the API (`crop_value.py`), the single source of the value rules.
- Gold per day is **per planting, per destination**: every harvested unit goes to that destination.
  **Assumes unlimited machines** (processing time does not cap throughput); the UI states this.
- Artisan goods are always normal quality, so jar/keg values do not depend on crop quality.
- New **Artisan** profession on the profile. Artisan and Agriculturist are mutually exclusive
  (both are the level-10 Tiller branch).
- Out of scope: cask aging, oil maker, mayonnaise/cheese, limiting by number of machines.

## 1. Profile

- `ProfileIn` (API `models.py`, regenerated website types): `artisan: bool = False`.
- Validation: `agriculturist` and `artisan` both true → 422 ("Escolha só uma profissão").
- Player entity in `packages/db` stores the new field like `agriculturist`.
- `GameDayNav` day editor: replace the "Profissão Agricultor" toggle with `SegmentedButtons`
  *Nenhuma / Agricultor / Artesão* ("Profissão (nível 10 de Lavrador)").

## 2. Value rules (`crop_value.py`, pure functions)

- Quality prices: normal = `sellPrice`, silver = ⌊×1.25⌋, gold = ⌊×1.5⌋, iridium = ×2.
- Product by crop folder (`frutas` → fruit, `vegetais` → vegetable):
  - Jar: fruit → Jelly, vegetable → Pickles; value = 2 × base + 50.
  - Keg: fruit → Wine (3 × base); vegetable → Juice (⌊2.25 × base⌋).
  - Keg special outputs from `maquinas/keg.json` `processing` with a fixed price item (`pale-ale`
    from hops, `beer` from wheat): value = that item's `sellPrice`.
  - Anything else (flowers, forage, etc.): no jar/keg product (`null`).
- Artisan: jar and keg values × 1.4 (rounded down).
- Per-destination gold over the window, `units = harvests × (1 + extra_yield)`:
  - raw: existing `gold_per_harvest` (quality chances) × harvests.
  - jar/keg: `units × product value`.
  - per day = total / days, in tenths, like today's `gold_per_day_tenths`.

## 3. API (`GET /plantables/value`)

- New query param `artisan: bool = False`.
- `SeedValueOut` gains:
  - `prices: { normal, silver, gold, iridium } | null`
  - `jar: { item: str, price: int } | null`, `keg: { item: str, price: int } | null`
  - `jarGoldPerDayTenths`, `kegGoldPerDayTenths` (nullable)
  - existing `goldTotal` / `goldPerDayTenths` remain the raw destination (backward compatible).
- Regenerate the website client (`generated/stardew-valley-api`).

## 4. Seeds page (`SeedCatalog`)

`SeedCatalog` is a card grid, so the comparison goes inside each card (not table columns):

- Compact price row: *Base · Prata · Ouro · Irídio* (with quality star icons from the icon manifest
  if present, else text labels).
- Destination block: three lines *Direto / Jarra / Barril*, each with product name, unit price and
  g/dia. The best g/dia is highlighted green. Missing product → "—".
- On mobile the price row is collapsed behind an icon-only expand button (`ChevronDownIcon`,
  `aria-label`/`title` = "Ver preços").
- `SORT_OPTIONS` gains `bestPerDay` ("Melhor g/dia") = max of the three per-day values.
- Note under the filters: "Jarra e barril supõem máquinas suficientes para toda a colheita."
- Query passes `artisan` from the profile.

## 5. Testing

- pytest (`packages/api`): quality prices; fruit/vegetable jar and keg; hops and wheat; Artisan
  multiplier; flower with no product; per-day math with extra yield; 422 when both professions.
- pytest (`packages/db`) for the new player field if covered.
- Vitest: `seedValues.spec.ts` (`bestPerDay` sort, formatting), `SeedCatalog.spec.tsx` (destination
  lines, highlight, "—"), `GameDayNav.spec.tsx` (profession selector).
- Run through Nx: `pnpm nx run-many -t lint test build`.
