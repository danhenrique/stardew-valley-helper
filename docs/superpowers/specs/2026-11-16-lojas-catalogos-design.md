# Stardew Helper: shops grid, fixed-catalog shops and purchase calculator (design)

Date: 2026-11-16 · Branch: `feature/lojas-catalogos`

## Goal

Make every shop the player can buy from reachable on `/lojas`, show the page as a grid of cards like
the "Hoje" page, and let the player add up the cost of a purchase inside a shop catalog.

## Findings

- Production DynamoDB (`aws-danhenrique-stardew-valley-db-x2slc7ub`, `TYPE#lojas`) matches the repo:
  19 shops. `SHOP#sewers` (Krobus) has 10 offers, `SHOP#casino` 10, `SHOP#qi-walnut-room` 22.
- Those three shops have no `schedule`. `toShop` in `website/src/lib/shops.ts` drops every entity
  without `schedule`, so they never appear on the site. The bug is in the website only.
- Neither the Mines Dwarf nor the Volcano Dwarf exists in the repo data or in the table.

## Scope and decisions

- UI labels in Portuguese (pt-BR); code, docs and commits in English.
- Tailwind only; cards adapted from the Tailwind Plus grid list already used by `OpenShops`
  (`lists/grid-lists/04-horizontal-link-cards.jsx`). Icons from Heroicons.
- Calculator state is **per shop and in memory only**: it resets when the player leaves the page.
  No persistence, no cross-shop shopping list.
- Dwarf data is taken from the Stardew Valley Wiki and marked `nameVerified: false`; the user checks
  prices in the PR. Importing into production happens only after merge and after explicit user
  confirmation.

## 1. Data (`packages/db/data/lojas`)

- New `dwarf.json` (Mines Dwarf) and `volcano-dwarf.json` (Volcano Dwarf, Ginger Island). Same shape
  as `sewers.json`: `id`, `type: "lojas"`, `name` (en, pt-BR), `nameVerified: false`, `offers`, and a
  new optional `access` text (en, pt-BR), e.g. "Requires the Rusty Key"-style requirements.
  Volcano Dwarf prices in cinder shards need a new currency `cinderShards` in `Currency`
  (`lib/shopCatalog.ts`) and in `COST_LABELS` ("fragmentos de cinza").
- `access` is added to `sewers.json` ("Requer Chave Enferrujada"), `casino.json` ("Requer Cartão do
  Clube") and `qi-walnut-room.json` ("Requer 100 nozes douradas") as well.
- Rename `sewers` pt-BR name to "Krobus (Esgoto)".
- Icons for the two dwarves added to the icon manifest if available; otherwise `GameIcon` fallback.
- Importer and tests in `packages/db` updated if they validate shop fields or currencies.

## 2. Shop model (`lib/shops.ts`)

- `Shop.schedule` becomes optional; `toShop` keeps entities without `schedule`. `Shop` gains
  `access?: string` (pt-BR text).
- `ShopStatus.status` gains `'always'`: a shop without schedule returns
  `{ status: 'always', hours: [], notes: [] }`.
- `closedToday` and `OpenShops` ("Hoje") keep their behavior: `'always'` shops are not "open today"
  tiles and are never "closed today".
- `SHOPS_WITHOUT_CATALOG` stays (ice-cream stand, movie theater, museum, traveling cart).

## 3. `/lojas` grid (replaces `ShopTable`)

- New `ShopGrid` component; `ShopTable` is deleted.
- Card: icon, name, badge (**Aberta** green, **Fechada** gray, **Sem horário fixo** sky), today's
  hours or closed reason, fixed closed days ("Fecha: qua"), notes, and `access` when present.
- Order: open, then closed (rendered with reduced opacity), then `'always'`; alphabetical inside each
  group (pt-BR collation).
- Card is a `Link` to `/lojas/$id`; shops in `SHOPS_WITHOUT_CATALOG` render as non-link cards.
- Grid: 1 column on mobile, 2 on `sm`, 3 on `lg`.

## 4. Purchase calculator (`/lojas/$id`)

- Each priced offer in `ShopCatalog` gets a `NumberStepper` (existing `components/form`), min 0,
  max 999. Offers without any cost (free / special) get no stepper.
- Pure function `cartTotals(offers, quantities, year)` in `lib/shopCatalog.ts` returns
  `{ gold: number; currencies: Partial<Record<Currency, number>>; materials: { item, qty }[] }`.
  `priceByYear` uses `year1` when `profile.currentDate.year === 1`, else `year2plus`. `packSize` does
  not change the math (price is per purchase).
- Sticky footer in `ShopCatalogPage` shows the gold total and, separately, each other currency and
  the material list. Hidden while every quantity is 0.
- Icon-only "Limpar" button (`TrashIcon`, `aria-label` and `title` = "Limpar compra") resets all
  quantities.
- `ShopCatalogModal` (opened from "Hoje") stays read-only, without steppers.

## 5. Testing

- Vitest: `shops.spec.ts` (shop without schedule is kept, status `'always'`, not in `closedToday`),
  `shopCatalog.spec.ts` (`cartTotals`: gold, year pricing, currencies, materials, zero quantities).
- Component specs: `ShopGrid` (order, badges, link vs non-link), `ShopCatalogPage` (stepper updates
  total, clear button), `/lojas` route spec updated; `ShopTable` references removed.
- `packages/db` tests updated for the new files/fields.
- Run through Nx: `pnpm nx run-many -t lint test build`.

## Out of scope

- Saving carts, cross-shop lists, traveling cart random stock, museum.
