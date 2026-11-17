# Shops Grid, Fixed-Catalog Shops and Purchase Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every shop with a catalog on `/lojas` as a card grid (including Krobus, Casino, Qi Walnut Room and the two dwarves) and add a per-shop purchase calculator to `/lojas/$id`.

**Architecture:** Data lives in `packages/db/data/lojas/*.json`, imported into DynamoDB by the existing importer; the website reads shops via `GET /game/lojas` (`useShops`) and offers via `useShopOffers`. Website changes are pure functions in `lib/shops.ts` / `lib/shopCatalog.ts` plus React components; no API change (the API exposes every stored attribute generically).

**Tech Stack:** Python 3 + PynamoDB + pytest (`packages/db`), React + TanStack Router + Tailwind + Heroicons + Vitest (`packages/website`), Nx + pnpm.

**Spec:** `docs/superpowers/specs/2026-11-16-lojas-catalogos-design.md`

## Global Constraints

- Branch `feature/lojas-catalogos` from `main`; at the end commit, push and open a PR to `main`.
- UI labels in pt-BR; code, docs, commits in English.
- Tailwind utility classes only; cards adapted from Tailwind Plus `lists/grid-lists/04-horizontal-link-cards.jsx` (as `OpenShops`); icons from `@heroicons/react`.
- Icon-only buttons have `aria-label` and the same `title` in pt-BR.
- Light and dark theme for every new element (`dark:` variants, as existing components).
- Gold amounts are integers.
- Run tasks through Nx: `pnpm nx test db`, `pnpm nx test website`, `pnpm nx run-many -t lint test build`.
- Writing to the production table happens only after merge and after the user confirms explicitly.

## Review Focus

- Offer priced by year (`priceByYear`) when the game year is 1 vs 2+: the cart total must match the price shown on the row.
- Offer that costs gold **and** a currency at once: both totals increase; a barter offer with `price: 0` plus materials adds no gold.
- Changing the date in `GameDatePicker` changes the visible offers: the cart resets, so no hidden offer is counted.
- Free/special offers (no cost, no materials) get no stepper and never enter the totals.
- Shop without schedule on "Hoje": never listed as open nor as "closed today".

---

### Task 1: Shop `access` attribute in the db importer

**Files:**
- Modify: `packages/db/stardew_valley_db/entities/game.py` (class `Shop`)
- Modify: `packages/db/stardew_valley_db/importer/convert.py` (`_shop`)
- Modify: the test-shop fixture under `packages/db/tests/fixtures/data/lojas/`
- Test: `packages/db/tests/test_convert.py`

**Interfaces:**
- Produces: `Shop.access = MapAttribute(null=True)` stored as `access` with `{ "en": str, "ptBr": str }` (via `localize`, like `scheduleText`). The API then returns it in `attributes.access`.

- [ ] **Step 1: Write the failing test** — add `"access": {"en": "Requires the Rusty Key", "pt-BR": "Requer Chave Enferrujada"}` to the test-shop fixture and:

```python
def test_should_store_access_text_when_converting_shop(result):
    shop = by_key(result, "SHOP#test-shop", "SHOP")
    assert shop.access.as_dict() == {"en": "Requires the Rusty Key", "ptBr": "Requer Chave Enferrujada"}
```

(Use the key `localize` produces for pt-BR; check an existing `scheduleText` assertion and match it.)

- [ ] **Step 2: Run** `pnpm nx test db` — Expected: FAIL (`access` missing).
- [ ] **Step 3: Implement** `access` on `Shop` and pass `access=localize(doc.get("access"))` in `_shop`.
- [ ] **Step 4: Run** `pnpm nx test db` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): store shop access requirement`

---

### Task 2: Dwarf shops, access texts and Krobus name (data)

**Files:**
- Create: `packages/db/data/lojas/dwarf.json`, `packages/db/data/lojas/volcano-dwarf.json`
- Modify: `packages/db/data/lojas/sewers.json`, `casino.json`, `qi-walnut-room.json`
- Modify: `packages/db/data/_meta/index.json` (if it lists ids per folder — follow how `sewers` is listed)

**Interfaces:**
- Produces: shop ids `dwarf` and `volcano-dwarf`; currency key `cinderShards` in Volcano Dwarf offers (`"currency": {"cinderShards": N}`, `"price": 0`).

- [ ] **Step 1: Collect offers** from the Stardew Valley Wiki pages "Dwarf" (shop section) and "Volcano Dungeon" (Dwarf shop section). Each offer uses `item` = an id that exists in `packages/db/data` (search the folders); an item with no id is left out and listed in the PR description. Use the same offer fields as `sewers.json` (`price`, `currency`, `availability`, `special`).
- [ ] **Step 2: Write the two files** with `id`, `type: "lojas"`, `name` (`en`: "Dwarf" / "Volcano Dwarf"; `pt-BR`: "Anão" / "Anão do Vulcão"), `nameVerified: false`, `access` (Dwarf: the unlock requirement as the Wiki states it, written as "Requer …" in pt-BR; Volcano Dwarf: en "Volcano Dungeon, Ginger Island" / pt-BR "Masmorra do Vulcão, Ilha Gengibre"), `offers`. No `schedule`. If `website/src/lib/icon-manifest.json` has no `dwarf` / `volcano-dwarf` entry, leave it: `GameIcon` falls back to its default icon.
- [ ] **Step 3: Add `access`** — `sewers.json`: en "Requires the Rusty Key" / pt-BR "Requer Chave Enferrujada"; `casino.json`: en "Requires the Club Card" / pt-BR "Requer Cartão do Clube"; `qi-walnut-room.json`: en "Requires 100 Golden Walnuts" / pt-BR "Requer 100 nozes douradas". Change `sewers.json` `name.pt-BR` to "Krobus (Esgoto)".
- [ ] **Step 4: Verify the import converts cleanly** — run the importer against the repo data without writing (check `pnpm nx run db:import --help` for the dry-run/local flag; do not guess it). Expected: no new diffs mentioning `dwarf`, `volcano-dwarf` or unknown items. Then `pnpm nx test db` — PASS.
- [ ] **Step 5: Commit** `feat(db): add dwarf shops and shop access requirements`

---

### Task 3: Shops without schedule in `lib/shops.ts`

**Files:**
- Modify: `packages/website/src/lib/shops.ts`
- Modify: `packages/website/src/components/ShopCatalogPage.tsx` (status text only)
- Test: `packages/website/src/lib/shops.spec.ts`, `packages/website/src/components/OpenShops.spec.tsx`

**Interfaces:**
- Produces:
  - `Shop = { id; name; schedule?: ShopSchedule; access?: string; notes }` (`access` = pt-BR text, `ptBrText(attrs.access)`).
  - `ShopStatus.status: 'open' | 'closed' | 'always'`.
  - `shopStatusToday(shop, …)` returns `{ status: 'always', hours: [], notes: [] }` when `shop.schedule` is undefined.
  - `fixedClosedDays(schedule: ShopSchedule | undefined, progress)` returns `[]` for undefined.

- [ ] **Step 1: Write failing tests** in `shops.spec.ts`:
  - `buildShops` keeps an entity without `schedule` and reads `access` (`'Requer Chave Enferrujada'`).
  - `shopStatusToday` of that shop → `{ status: 'always', hours: [], notes: [] }`.
  - `closedToday` never includes it.
  - In `OpenShops.spec.tsx`: a shop without schedule is not rendered as an open tile.
- [ ] **Step 2: Run** `pnpm nx test website -- shops OpenShops` — Expected: FAIL.
- [ ] **Step 3: Implement** in `shops.ts`; in `ShopCatalogPage` the header text for `'always'` is `Sem horário fixo` followed by ` · ${shop.access}` when present.
- [ ] **Step 4: Run** the same tests, then `pnpm nx test website` — Expected: PASS (fix TypeScript errors in other consumers of `schedule`).
- [ ] **Step 5: Commit** `feat(website): keep shops without a fixed schedule`

---

### Task 4: Cart totals and cinder shards in `lib/shopCatalog.ts`

**Files:**
- Modify: `packages/website/src/lib/shopCatalog.ts`
- Test: `packages/website/src/lib/shopCatalog.spec.ts`

**Interfaces:**
- Consumes: `ShopOffer`, `offerCosts(offer, year)`.
- Produces:
  - `Currency` adds `'cinderShards'`; `COST_LABELS.cinderShards = 'fragmentos de cinza'`; `CURRENCIES` includes it.
  - `isPurchasable(offer: ShopOffer, year: number): boolean` — `offerCosts(offer, year).length > 0 || offer.materials !== undefined`.
  - `type CartTotals = { gold: number; currencies: Partial<Record<Currency, number>>; materials: { item: string; qty: number }[] }`
  - `cartTotals(offers: readonly ShopOffer[], quantities: readonly number[], year: number): CartTotals` — `quantities[i]` belongs to `offers[i]`; sums `offerCosts` amounts × qty per unit; materials merged by `item` (qty × quantity), in first-appearance order; zero quantities ignored.

- [ ] **Step 1: Write failing tests**:
  - gold: `[{itemId:'a', price:50}, {itemId:'b', price:30}]`, `[2, 1]`, year 1 → `{ gold: 130, currencies: {}, materials: [] }`.
  - priceByYear: `{priceByYear:{year1:50, year2plus:75}}`, `[2]` → gold `100` in year 1, `150` in year 2.
  - gold + currency: `{price:500, currency:{qiGems:2}}`, `[3]` → gold `1500`, `currencies.qiGems` `6`.
  - barter: `{price:0, materials:[{item:'wood', qty:10}]}` and `{price:0, materials:[{item:'wood', qty:5}]}`, `[1, 2]` → gold `0`, materials `[{item:'wood', qty:20}]`.
  - cinder: `{price:0, currency:{cinderShards:25}}`, `[2]` → `currencies.cinderShards` `50`.
  - `isPurchasable({itemId:'x', special:'s'}, 1)` → `false`.
  - `parseCurrency` keeps `cinderShards` (via `buildOffers` on a relation with `currency: {cinderShards: 25}`).
- [ ] **Step 2: Run** `pnpm nx test website -- shopCatalog` — Expected: FAIL.
- [ ] **Step 3: Implement** the functions above.
- [ ] **Step 4: Run** the same tests — Expected: PASS.
- [ ] **Step 5: Commit** `feat(website): add purchase cart totals and cinder shards`

---

### Task 5: `/lojas` card grid (replaces `ShopTable`)

**Files:**
- Create: `packages/website/src/components/ShopGrid.tsx`, `packages/website/src/components/ShopGrid.spec.tsx`
- Modify: `packages/website/src/routes/lojas.index.tsx`, `packages/website/src/routes/lojas.index.spec.tsx`
- Delete: `packages/website/src/components/ShopTable.tsx`

**Interfaces:**
- Consumes: `Shop`, `shopStatusToday`, `fixedClosedDays` (Task 3); `SHOPS_WITHOUT_CATALOG` from `OpenShops.tsx`; `WEEKDAY_LABELS`, `localizedName`; `GameIcon`.
- Produces: `ShopGrid({ shops, today, events, progress }: { shops: Shop[]; today: GameDateIn; events: FixedEvent[]; progress: ShopProgress })` (same props as the old `ShopTable`); pure helper `sortShopEntries(entries: { shop: Shop; status: ShopStatus }[])` exported from `ShopGrid.tsx`.

- [ ] **Step 1: Write failing tests** in `ShopGrid.spec.tsx`:
  - order: open shops, then closed, then `'always'`, alphabetical (pt-BR) inside each group.
  - badges: "Aberta", "Fechada", "Sem horário fixo"; closed cards have `opacity-60`.
  - card text: today's hours (e.g. "9:00–17:00"), closed reason, "Fecha: Qua" style fixed days, notes, `access`.
  - a shop in `SHOPS_WITHOUT_CATALOG` is not a link; others link to `/lojas/<id>`.
  - Update `lojas.index.spec.tsx` to look for cards instead of table rows.
- [ ] **Step 2: Run** `pnpm nx test website -- ShopGrid lojas.index` — Expected: FAIL.
- [ ] **Step 3: Implement** `ShopGrid`: `<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">`, card styles derived from the `TILE` style of `OpenShops`; badge colors — open: green (as `ShopTable` `OPEN_BADGE`), closed: gray, always: `bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-400`. Route renders `<ShopGrid …>` without the wrapping `CARD` section. Delete `ShopTable.tsx`.
- [ ] **Step 4: Run** `pnpm nx test website` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(website): show shops as a card grid`

---

### Task 6: Purchase calculator on `/lojas/$id`

**Files:**
- Modify: `packages/website/src/components/ShopCatalog.tsx`, `packages/website/src/components/ShopCatalogPage.tsx`
- Create: `packages/website/src/components/CartFooter.tsx`
- Test: `packages/website/src/components/ShopCatalog.spec.tsx`, `packages/website/src/components/ShopCatalogPage.spec.tsx`, `packages/website/src/components/ShopCatalogModal.spec.tsx`

**Interfaces:**
- Consumes: `cartTotals`, `isPurchasable`, `CartTotals`, `formatCost`, `COST_LABELS` (Task 4); `NumberStepper` (`label`, `value`, `min`, `max`, `onChange`).
- Produces:
  - `ShopCatalog` gains optional `quantities?: readonly number[]` and `onQuantityChange?: (index: number, qty: number) => void`; steppers render only when both are given (so `ShopCatalogModal` stays read-only). `index` is the position in the `offers` prop.
  - `CartFooter({ totals, onClear }: { totals: CartTotals; onClear: () => void })`.

- [ ] **Step 1: Write failing tests**:
  - `ShopCatalog` with `quantities`: each purchasable offer shows a stepper labeled `Quantidade de <item name>` (min 0, max 999); a special/free offer shows none.
  - `ShopCatalogPage`: incrementing two offers shows the footer "Total: 130g"; a qi-gem offer adds "6 gemas Qi"; materials show "20× Madeira"; footer hidden when all quantities are 0.
  - Button `aria-label="Limpar compra"` and `title="Limpar compra"` resets the footer (hidden).
  - Changing the date in the date picker resets the quantities.
  - `ShopCatalogModal` renders no stepper.
- [ ] **Step 2: Run** `pnpm nx test website -- ShopCatalog` — Expected: FAIL.
- [ ] **Step 3: Implement**:
  - In `Catalog` (`ShopCatalogPage.tsx`): `const visible = offersOn(offers, date)`; `useState<number[]>` of zeros sized to `visible`; reset by rendering `Catalog` with `key={`${date.year}-${date.season}-${date.day}`}`.
  - `OfferRow` places the stepper below the costs on mobile and to their left on `sm`.
  - `CartFooter`: `sticky bottom-0` bar inside the page (`border-t bg-white/95 dark:bg-gray-900/95 backdrop-blur`), shows "Total: {gold}g" (when > 0), each currency with `formatCost`, materials as `{qty}× {name}` (via `useGameNames().nameOf`), and an icon-only `TrashIcon` button (`@heroicons/react/20/solid`).
- [ ] **Step 4: Run** `pnpm nx test website` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(website): add purchase calculator to shop catalogs`

---

### Task 7: Verify, PR and production import

- [ ] **Step 1: Run** `pnpm nx run-many -t lint test build` — Expected: all green.
- [ ] **Step 2: Manual check** with the `run` skill: `/lojas` shows Krobus (Esgoto), Cassino, Sala de Nozes de Qi, Anão and Anão do Vulcão; calculator totals on Pierre (year 1) match the row prices; light and dark themes.
- [ ] **Step 3: Push and open PR** to `main`; the description lists dwarf items left out for lack of an id and asks the user to verify dwarf prices.
- [ ] **Step 4: After merge, ask the user** before running the import into the production table with profile `danhenrique-prod`; then confirm with a `TYPE#lojas` query that 21 shops exist and `SHOP#dwarf` / `SHOP#volcano-dwarf` have offers.
