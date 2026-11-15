# Stardew Helper Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the home on today (events, plantings, machines, reminders, open shops, next 7 days) and add shop catalogs (modal + page), a birthday gifts modal and localized item names.

**Architecture:** One read-only API route (`GET /game/names`) feeds a cached `nameOf` lookup. Everything else is website-only: pure functions in `src/lib/` (catalog filter, gift parsing, calendar markers, date window) with unit tests, single-purpose components that render each kind of data once, and thin modals on a shared Tailwind Plus `Modal`.

**Tech Stack:** FastAPI + PynamoDB (API, pytest + moto), React 19 + TanStack Router/Query + Headless UI + Tailwind v4 + Heroicons (website, Vitest + Testing Library), Nx + pnpm + uv.

**Spec:** `docs/superpowers/specs/2026-11-11-stardew-home-redesign-design.md`

## Global Constraints

- UI copy in pt-BR; code, comments, docs and commits in English (Conventional Commits, scope `stardew-valley-website` or `stardew-valley-api`).
- Styling: Tailwind utility classes only; adapt Tailwind Plus components from `/home/danhenrique/projects/.tailwind/` first and cite the source file in a comment (`// Adapted from Tailwind Plus …`), as existing components do.
- Icons from `@heroicons/react`; every icon-only button has `aria-label` and `title` with the same pt-BR text.
- Every new surface has light and dark styles (`dark:` variants), reusing `CARD` / `BADGE` from `components/styles.ts`.
- Run tasks through Nx: website `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- <file>`, API `pnpm nx test aws_danhenrique.stardew_valley_api`, final `pnpm nx run-many -t test lint typecheck`.
- Website specs mock hooks with `vi.hoisted` + `vi.mock('../hooks/useGameData', …)` like `EventDetailPage.spec.tsx`; test data uses fictitious ids.
- No secrets or personal data in code, fixtures or commits.
- End every commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ntabp7pjC2JH9bk9aVe8EK
  ```

## Review Focus

1. **Season and year rollover in the 7-day strip** — on Winter 25 the strip must show Winter 25–28 then Spring 1–3 of the **next year**, with harvests/machines matched on the full date. Pinned in Task 9 (`nextDates` and `UpcomingDays` specs).
2. **Year-dependent offers** — in year 1 Pierre's `fromYear: 2` offers are hidden and Blacksmith shows `year1` prices; in year 2 the opposite. Pinned in Task 3 (`offersOn`, `offerCosts`).
3. **Offers with gold and a currency at once** — both costs render ("500g" and "10 gemas Qi"), neither replaces the other. Pinned in Task 3 and Task 4.
4. **Festival days** — shops closed by a festival (`festivalClosure: 'all'`) must not appear in "Lojas abertas hoje". Pinned in Task 10.
5. **Id shared by an item and a building in `/game/names`** — the item name wins, deterministically. Pinned in Task 1.

---

### Task 1: `GET /game/names` endpoint

**Files:**
- Modify: `packages/stardew-valley/api/stardew_valley_api/routes/game.py` (new route declared above `list_game_entities`)
- Test: `packages/stardew-valley/api/tests/test_game_routes.py`

**Interfaces:**
- Produces: `GET /game/names` → `dict[str, LocalizedTextOut]` (JSON `{ "<id>": { "en": str|null, "ptBr": str|null } }`), operation function `list_game_names` (generated client method `listGameNames`).

- [ ] **Step 1: Write the failing tests**

```python
def test_should_return_localized_names_of_items_categories_and_buildings(client):
    body = client.get("/game/names").json()
    assert body["test-category"] == {"en": "All tests", "ptBr": "Todos os testes"}
    assert "test-fruit" in body and "test-barn" in body


def test_should_not_treat_names_as_a_folder(client):
    assert client.get("/game/names").status_code == 200
```

Third test, `test_should_prefer_item_name_when_a_building_shares_the_id(client, monkeypatch)`: patches `stardew_valley_api.routes.game.list_folder` to return, for `construcoes`, a stub whose `entity_id` is `test-fruit` and name `{"en": "Shadow"}`; assert `body["test-fruit"]["en"] != "Shadow"`.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api`
Expected: the new tests FAIL (404 from `/game/{type}` with `names`).

- [ ] **Step 3: Implement `list_game_names() -> dict[str, LocalizedTextOut]`**

Iterate `"construcoes"`, `"categorias"`, then `sorted(ITEM_FOLDERS)` (items last so they overwrite), calling `list_folder` and `localized_name`; skip models without a name. Decorate with `@app.get("/game/names")` and `@tracer.capture_method`, placed before `/game/{type}`.

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm nx test aws_danhenrique.stardew_valley_api` then `pnpm nx run-many -t lint typecheck -p aws_danhenrique.stardew_valley_api`
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-api): add localized game names endpoint`

---

### Task 2: `useGameNames` and the shared `Modal`

**Files:**
- Create: `packages/stardew-valley/website/src/hooks/useGameNames.ts`, `.../src/components/Modal.tsx`
- Modify: `.../src/components/EventDetail.tsx` (foraging item name via `nameOf`)
- Test: `.../src/hooks/useGameNames.spec.tsx`, `.../src/components/Modal.spec.tsx`, `.../src/components/EventDetail.spec.tsx`

**Interfaces:**
- Consumes: `api.listGameNames.queryOptions()` (Task 1; run `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:generate:stardew-valley-api-client` first).
- Produces:
  - `pickName(names: Record<string, LocalizedTextOut> | undefined, id: string): string` — pt-BR, else en, else `humanizeId(id)`.
  - `useGameNames(): { nameOf: (id: string) => string }` (`staleTime: Infinity`).
  - `Modal({ open, onClose, title, subtitle?, footer?, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; footer?: ReactNode; children: ReactNode })`.

- [ ] **Step 1: Write the failing tests**
  - `pickName`: `{ a: { en: 'Apple', ptBr: 'Maçã' } }` → `'Maçã'`; `{ a: { en: 'Apple', ptBr: null } }` → `'Apple'`; `undefined`, id `blackberry-cobbler` → `humanizeId('blackberry-cobbler')`.
  - `Modal`: renders `title` as the dialog name (`getByRole('dialog', { name: 'Pierre' })`), shows `subtitle` and `footer`; button `{ name: 'Fechar' }` has `title="Fechar"` and calls `onClose`; nothing rendered when `open` is false.
  - `EventDetail` foraging row: with `useGameNames` mocked to `nameOf: (id) => id === 'test-berry' ? 'Amora de teste' : id`, the text "Amora de teste" shows.

- [ ] **Step 2: Run to verify they fail** — `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- useGameNames Modal EventDetail` → FAIL (modules missing).

- [ ] **Step 3: Implement**
  - `useGameNames.ts`: `pickName` + hook with `useQuery`.
  - `Modal.tsx`: adapt `application-ui-v4/react/overlays/modal-dialogs/04-simple-with-dismiss-button.jsx` (Headless UI `Dialog`, `DialogBackdrop`, `DialogPanel`, `DialogTitle`); close button `XMarkIcon`; body `max-h-[70vh] overflow-y-auto`; footer area from `05-simple-with-gray-footer.jsx`.
  - `EventDetail.tsx`: replace `humanizeId(event.item)` with `nameOf(event.item)` (gift list changes in Task 6).

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add localized names and the shared modal`

---

### Task 3: Shop catalog data (`lib/shopCatalog.ts`, `useShopOffers`)

**Files:**
- Create: `packages/stardew-valley/website/src/lib/shopCatalog.ts`
- Modify: `.../src/hooks/useGameData.ts` (add `useShopOffers`)
- Test: `.../src/lib/shopCatalog.spec.ts`

**Interfaces:**
- Produces (exact types in spec §3.1):
  - `type ShopOffer` (spec §3.1), `type Currency = 'qiCoins' | 'qiGems' | 'goldenWalnuts'`.
  - `buildOffers(relations: readonly RelationOut[]): ShopOffer[]` — `kind === 'ShopOffer'`, sorted by `sk`; drops fields with mismatched shape.
  - `offersOn(offers: readonly ShopOffer[], date: GameDateIn): ShopOffer[]`.
  - `type OfferCost = { amount: number; unit: 'gold' | Currency }`; `offerCosts(offer: ShopOffer, year: number): OfferCost[]`.
  - `COST_LABELS: Record<OfferCost['unit'], string>` = `{ gold: 'g', qiCoins: 'fichas Qi', qiGems: 'gemas Qi', goldenWalnuts: 'nozes douradas' }`; `formatCost(cost: OfferCost): string` (`'250g'`, `'10 gemas Qi'`).
  - `offerTags(offer: ShopOffer, nameOf: (id: string) => string): string[]`.
  - `hasRotatingStock(offers: readonly ShopOffer[]): boolean`.
  - `useShopOffers(shopId: string, enabled: boolean): { status: 'pending' | 'error' | 'success'; offers: ShopOffer[] }`.

- [ ] **Step 1: Write the failing tests** (`shopCatalog.spec.ts`)
  - `offersOn` — `{ season: 'fall' }` kept on fall 3, dropped on spring 3; `{ availability: 'tue' }` kept on day 2, dropped on day 3 (day 1 is Monday); `evenDays` kept on 4, dropped on 5; `oddDays` the reverse; `{ fromYear: 2 }` dropped in year 1, kept in years 2 and 3; an offer with no rules is always kept.
  - `offerCosts` — `{ priceByYear: { year1: 75, year2plus: 150 } }` → `[{ amount: 75, unit: 'gold' }]` in year 1, `150` in years 2 and 5; `{ price: 500, currency: { qiGems: 10 } }` → `[{500,'gold'},{10,'qiGems'}]`; `{ currency: { qiCoins: 5000 } }` → one cost.
  - `formatCost` — `'250g'`, `'10 gemas Qi'`, `'5000 fichas Qi'`.
  - `offerTags` — `fishingLevel: 2` → `'Requer pesca nível 2'` (`fishingLevel: 0` → no tag); `requiresBuilding: 'coop'` → `'Requer Galinheiro'` with `nameOf` mocked; `requiresMonsterGoal: 'slimes'` → `'Requer meta de monstros: Gosmas'`; `recipe` → `'Receita'`; `packSize: 3` → `'Pacote com 3'`; `rotating` → `'Rotativo'`; `special: 'onlyOneAtMaxKrobusFriendshipWhileSingle'` → `'Só um, com amizade máxima com Krobus e solteiro'`; `special: 'wednesdayRandomFishOrMagnetBait'` → `'Às quartas: peixe aleatório ou isca magnética'`.
  - `buildOffers` — ignores non-`ShopOffer` relations, keeps `sk` order, maps `attributes.itemId` to `itemId`, drops `materials` that is not an array of `{ item, qty }`.

- [ ] **Step 2: Run to verify they fail** — `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- shopCatalog` → FAIL.

- [ ] **Step 3: Implement** the functions above (weekday via `weekdayOf` from `lib/gameDate.ts`) and `useShopOffers` (`getGameEntity.queryOptions({ type: 'lojas', id })`, `enabled`, `staleTime: Infinity`, `buildOffers(data.relations)`).

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): filter shop offers by game date`

---

### Task 4: `ShopCatalog` and `ShopCatalogModal`

**Files:**
- Create: `.../src/components/ShopCatalog.tsx`, `.../src/components/ShopCatalogModal.tsx`
- Test: `.../src/components/ShopCatalog.spec.tsx`, `.../src/components/ShopCatalogModal.spec.tsx`

**Interfaces:**
- Consumes: Task 2 `Modal`, `useGameNames`; Task 3 `offersOn`, `offerCosts`, `formatCost`, `offerTags`, `hasRotatingStock`, `useShopOffers`; `Shop`, `ShopStatus` from `lib/shops.ts`.
- Produces:
  - `ShopCatalog({ offers, date }: { offers: readonly ShopOffer[]; date: GameDateIn })` — offers already filtered.
  - `SECTION_LABELS: Record<string, string>` = `{ shop: 'Loja', upgrade: 'Melhorias', geode: 'Geodos', building: 'Construções', magic: 'Magia' }`.
  - `ShopCatalogModal({ shop, status, today, open, onClose }: { shop: Shop; status: ShopStatus; today: GameDateIn; open: boolean; onClose: () => void })`.

- [ ] **Step 1: Write the failing tests**
  - `ShopCatalog`: rows show the localized name, `'250g'`, materials (`'5'` next to the copper-bar icon) and tag badges; offers with `section` render under headings "Melhorias" and "Geodos" in first-appearance order, without headings when no offer has a section; a `rotating` offer shows "Parte do estoque é sorteada pelo jogo"; an offer with price and `qiGems` shows both costs; `[]` → "Nada à venda neste dia."
  - `ShopCatalogModal`: title is the shop name, subtitle is `status.hours.join(', ')`; with `useShopOffers` mocked `pending` → "Carregando catálogo...", `error` → "Não foi possível carregar o catálogo.", `success` → only offers valid today (a `{ availability: 'tue' }` offer absent on a Monday); link "Ver catálogo completo" has `href="/lojas/<id>"`.

- [ ] **Step 2: Run to verify they fail** — `… -- ShopCatalog` → FAIL.

- [ ] **Step 3: Implement**, adapting `application-ui-v4/react/lists/stacked-lists` for rows and using `GameIcon` + `BADGE`. The modal calls `useShopOffers(shop.id, open)`.

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add the shop catalog and its modal`

---

### Task 5: Shop catalog page `/lojas/$id`

**Files:**
- Rename: `.../src/routes/lojas.tsx` → `lojas.index.tsx`, `lojas.spec.tsx` → `lojas.index.spec.tsx` (route id becomes `/lojas/`, matching `eventos.index.tsx`)
- Create: `.../src/routes/lojas.$id.tsx`, `.../src/components/ShopCatalogPage.tsx`, `.../src/components/GameDatePicker.tsx`
- Modify: `.../src/components/ShopTable.tsx` (shop name → `Link to="/lojas/$id"`)
- Test: `.../src/components/ShopCatalogPage.spec.tsx`, `.../src/routes/lojas.index.spec.tsx`

**Interfaces:**
- Consumes: Task 3 `useShopOffers`, `offersOn`; Task 4 `ShopCatalog`; `useShops`, `useMe`, `useFixedEvents`, `shopStatusToday`, `SeasonTabs`.
- Produces:
  - `GameDatePicker({ value, onChange }: { value: GameDateIn; onChange: (next: GameDateIn) => void })` — `SeasonTabs` + day `<select>` 1–28 (label "Dia") + year `<input type="number" min={1}>` (label "Ano").
  - `ShopCatalogPage({ shopId }: { shopId: string })`.

- [ ] **Step 1: Write the failing tests**
  - Default date is the profile's `currentDate`; header shows "Aberta · 9:00–17:00" or "Fechada · <reason>" from `shopStatusToday` for the selected date.
  - Changing the day to 2 (Tuesday) shows a `{ availability: 'tue' }` offer that was absent on day 1.
  - Changing the year to 2 shows a `{ fromYear: 2 }` offer.
  - Unknown id (not in `useShops` data) → "Loja não encontrada" and link to `/lojas`.
  - Offers `error` → catalog notice shown, header still rendered.
  - `lojas.index.spec`: each shop name is a link to `/lojas/<id>`.

- [ ] **Step 2: Run to verify they fail** — `… -- ShopCatalogPage lojas` → FAIL.

- [ ] **Step 3: Implement**; `lojas.$id.tsx` is `createFileRoute('/lojas/$id')` rendering `ShopCatalogPage` with `Route.useParams().id`. Run the website dev/build once so `routeTree.gen.ts` regenerates, and commit it.

- [ ] **Step 4: Run to verify they pass** — same command, then `pnpm nx typecheck @aws-danhenrique/stardew-valley-helper-website` → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add the shop catalog page`

---

### Task 6: Gift tastes (`lib/gifts.ts`, `GiftTastes`)

**Files:**
- Create: `.../src/lib/gifts.ts`, `.../src/components/GiftTastes.tsx`
- Modify: `.../src/lib/events.ts` (remove `lovedGiftIds`), `.../src/hooks/useGameData.ts` (`useVillagerGifts`), `.../src/components/EventDetail.tsx`, `.../src/components/EventDetailPage.tsx`
- Test: `.../src/lib/gifts.spec.ts`, `.../src/components/GiftTastes.spec.tsx`, update `EventDetail.spec.tsx`, `EventDetailPage.spec.tsx`, `events.spec.ts`

**Interfaces:**
- Produces:
  - `type GiftTier`, `GiftEntry`, `GiftTastes` (spec §5.1); `GIFT_TIERS: readonly GiftTier[]` = `['loves', 'likes', 'neutral', 'dislikesOrHates']`; `GIFT_TIER_LABELS` = `{ loves: 'Ama', likes: 'Gosta', neutral: 'Neutro', dislikesOrHates: 'Não gosta ou odeia' }`.
  - `giftTastes(relations: readonly RelationOut[]): GiftTastes`.
  - `useVillagerGifts(villagerId: string, enabled = true): { status: 'pending' | 'error' | 'success'; tastes: GiftTastes }`.
  - `GiftTastes({ tastes, tiers = GIFT_TIERS }: { tastes: GiftTastes; tiers?: readonly GiftTier[] })`; `isEmptyTastes(tastes: GiftTastes, tiers?: readonly GiftTier[]): boolean`.
  - `EventDetail` `details.gifts` becomes `{ status; tastes: GiftTastes }`.

- [ ] **Step 1: Write the failing tests**
  - `giftTastes`: sk `GIFT#loves#ITEM#amethyst` → `loves: [{ kind: 'item', id: 'amethyst', except: [] }]`; sk `GIFT#likes#CATEGORY#flowers` with `attributes.except: ['poppy']` → `likes: [{ kind: 'category', id: 'flowers', except: ['poppy'] }]`; `MovieTaste` relations ignored; every tier present (empty arrays).
  - `GiftTastes`: headings "Ama" and "Gosta" shown, empty "Neutro" omitted; category row "Flores" with "exceto Papoula" (names via mocked `nameOf`); `tiers={['loves']}` shows only "Ama".
  - `EventDetail`: birthday shows loved gifts with localized names; empty → "Nenhum presente amado cadastrado."

- [ ] **Step 2: Run to verify they fail** — `… -- gifts GiftTastes EventDetail` → FAIL.

- [ ] **Step 3: Implement**; `EventDetail` renders `<GiftTastes tastes={…} tiers={['loves']} />` inside the existing "Presentes amados" row.

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): parse every gift taste tier`

---

### Task 7: `BirthdayGiftsModal`

**Files:**
- Create: `.../src/components/BirthdayGiftsModal.tsx`
- Test: `.../src/components/BirthdayGiftsModal.spec.tsx`

**Interfaces:**
- Consumes: Task 2 `Modal`; Task 6 `useVillagerGifts`, `GiftTastes`, `isEmptyTastes`; `formatEventDays`, `localizedName` from `lib/i18n.ts`.
- Produces: `BirthdayGiftsModal({ event, open, onClose }: { event: FixedEvent | null; open: boolean; onClose: () => void })` — `event.kind === 'birthday'`, villager id `event.refId`.

- [ ] **Step 1: Write the failing tests** — title "Aniversário de Abigail", subtitle the event date; states "Carregando presentes...", "Não foi possível carregar os presentes.", "Nenhum presente cadastrado." (all tiers empty); all four tiers render when present; link "Ver evento" → `/eventos/<event.id>`; `useVillagerGifts` called with `enabled` false while closed.

- [ ] **Step 2: Run to verify they fail** — `… -- BirthdayGiftsModal` → FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): add the birthday gifts modal`

---

### Task 8: Calendar markers extraction, no "+N"

**Files:**
- Create: `.../src/lib/calendarMarkers.ts`, `.../src/components/CalendarDayCell.tsx`
- Modify: `.../src/components/EventCalendar.tsx` (use both; delete `MAX_MARKERS`, `markersFor`)
- Test: `.../src/lib/calendarMarkers.spec.ts`, update `.../src/components/EventCalendar.spec.tsx`

**Interfaces:**
- Produces:
  - `type CalendarMarker = { key: string; label: string; kindLabel: string; color: string; Icon?: ComponentType<SVGProps<SVGSVGElement>>; iconId?: string; target: MarkerTarget }`;
    `type MarkerTarget = { kind: 'event'; event: FixedEvent } | { kind: 'harvest' } | { kind: 'machine' }`.
  - `calendarMarkers(date: GameDateIn, input: { events: readonly FixedEvent[]; plantings: readonly PlantingOut[]; names: Record<string, string>; machineMarkers: readonly MachineMarker[] }): CalendarMarker[]` — events (via `eventsOn(events, date.season, date.day)`), then harvests on the full date, then machine markers on the full date; same labels/colors/icons as today's `markersFor` (move `KIND_COLORS`, `HARVEST_*`, `MACHINE_MARKER_COLORS` into this module, keep `KIND_ICONS`/`MACHINE_MARKER_ICONS` exported from `EventCalendar` or move them alongside and re-export).
  - `CalendarDayCell({ label, isToday, markers, onSelect?, selected?, renderMarker? }: { label: ReactNode; isToday: boolean; markers: readonly CalendarMarker[]; onSelect?: () => void; selected?: boolean; renderMarker?: (marker: CalendarMarker, content: ReactNode) => ReactNode })` — renders every marker; `renderMarker` wraps a marker's content (used by Task 9 for links/buttons).

- [ ] **Step 1: Write the failing tests**
  - `calendarMarkers`: order events → harvests → machines; a harvest in year 2 is not returned for the same season/day in year 1; event marker carries `target.event`.
  - `EventCalendar.spec`: a day with 5 markers shows all 5 labels and no `"+ 2"` text (replace the existing "+N" assertion).

- [ ] **Step 2: Run to verify they fail** — `… -- calendarMarkers EventCalendar` → FAIL.

- [ ] **Step 3: Implement** the extraction; `EventCalendar` keeps its filter checkboxes, season navigation and selected-day panel unchanged.

- [ ] **Step 4: Run to verify they pass** — `… -- calendarMarkers EventCalendar calendario` → PASS.

- [ ] **Step 5: Commit** — `refactor(stardew-valley-website): share calendar markers and show every marker`

---

### Task 9: "Próximos dias" strip

**Files:**
- Modify: `.../src/lib/gameDate.ts` (add `nextDates`)
- Create: `.../src/components/UpcomingDays.tsx`
- Test: `.../src/lib/gameDate.spec.ts`, `.../src/components/UpcomingDays.spec.tsx`

**Interfaces:**
- Consumes: Task 8 `calendarMarkers`, `CalendarDayCell`; Task 7 `BirthdayGiftsModal`; `machineMarkers`, `MachineCatalogNotice`, `WEEKDAY_NAMES`/`SEASON_LABELS` from `lib/i18n.ts`.
- Produces:
  - `nextDates(start: GameDateIn, count: number): GameDateIn[]` — 28 days per season, seasons `spring → summer → fall → winter`, year +1 after winter 28.
  - `UpcomingDays({ events, today, plantings, names, machines, machineCatalog, machineCatalogStatus }: { events: FixedEvent[]; today: GameDateIn; plantings: readonly PlantingOut[]; names: Record<string, string>; machines?: readonly MachineBatchOut[]; machineCatalog?: readonly MachineOut[]; machineCatalogStatus?: MachineCatalogStatus })`.

- [ ] **Step 1: Write the failing tests**
  - `nextDates`: spring 1, 7 → spring 1…7; summer 26, 7 → summer 26–28 + fall 1–4; winter 25 year 1, 7 → winter 25–28 year 1 + spring 1–3 **year 2**.
  - `UpcomingDays`: heading "Próximos dias"; 7 day cells, the first marked today (`data-is-today`); cell labels like "Seg 1" and the season name on day 1 of a new season; a day with 4 markers shows all 4; clicking a birthday marker opens the dialog "Aniversário de …"; a festival marker is a link to `/eventos/<id>`; a harvest marker links to `/plantios`, a machine marker to `/maquinas`; machine catalog `error` → `MachineCatalogNotice` shown and event markers still visible.

- [ ] **Step 2: Run to verify they fail** — `… -- gameDate UpcomingDays` → FAIL.

- [ ] **Step 3: Implement.** Grid `sm:grid-cols-7` of `CalendarDayCell`; below `sm` a `divide-y` list of the same cells. One `BirthdayGiftsModal` instance with the selected event in state.

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): show the next seven days as a calendar row`

---

### Task 10: "Lojas abertas hoje" card

**Files:**
- Create: `.../src/components/OpenShops.tsx`
- Test: `.../src/components/OpenShops.spec.tsx`

**Interfaces:**
- Consumes: Task 4 `ShopCatalogModal`; `shopStatusToday`, `Shop`, `ShopProgress` from `lib/shops.ts`; `MachineCatalogStatus`.
- Produces: `OpenShops({ shops, today, events, progress, status }: { shops: Shop[]; today: GameDateIn; events: FixedEvent[]; progress: ShopProgress; status: MachineCatalogStatus })`; `SHOPS_WITHOUT_CATALOG: ReadonlySet<string>` = `{'ice-cream-stand', 'movie-theater', 'museum', 'traveling-cart'}`.

- [ ] **Step 1: Write the failing tests**
  - Only shops with status `open` are listed (a shop closed on Wednesdays is absent on day 3; an out-of-season shop is absent).
  - **Festival day:** a shop with `festivalClosure: 'all'` is absent when a festival with `shopsClosed` is today.
  - Row shows hours "9:00–17:00" and note "Fecha se chover".
  - Clicking a shop row (button) opens the dialog with the shop name.
  - `museum` row is not a button; `traveling-cart` row shows "Estoque aleatório".
  - Link "Ver todas as lojas" → `/lojas`; `pending` → "Carregando lojas..."; `error` → "Não foi possível carregar as lojas."; none open → "Nenhuma loja aberta hoje."

- [ ] **Step 2: Run to verify they fail** — `… -- OpenShops` → FAIL.

- [ ] **Step 3: Implement** in a `CARD` section with heading "Lojas abertas hoje".

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): list the shops open today`

---

### Task 11: "Hoje" card and "Lembretes" card

**Files:**
- Create: `.../src/components/TodayReminders.tsx`
- Modify: `.../src/components/TodayList.tsx`
- Test: `.../src/components/TodayReminders.spec.tsx`, update `.../src/components/TodayList.spec.tsx`

**Interfaces:**
- Consumes: Task 7 `BirthdayGiftsModal`; `remindersToday`, `REMINDER_ICONS`.
- Produces:
  - `TodayReminders({ reminders, events, today, status }: { reminders: Reminder[]; events: FixedEvent[]; today: GameDateIn; status: MachineCatalogStatus })` — returns `null` when `status === 'success'` and no reminder applies.
  - `TodayList` props: remove `reminders`, `remindersStatus`, `shops`, `shopsStatus`, `progress`; add `onAddMachine: () => void`.

- [ ] **Step 1: Write the failing tests**
  - `TodayReminders`: heading "Lembretes"; with a weekly `fri` reminder in the spec's test data, its name and detail show on day 5; on a day with none and `success` renders nothing; `pending`/`error` show "Carregando lembretes..." / "Não foi possível carregar os lembretes."
  - `TodayList`: no "Lembretes" heading and no "Fechadas hoje" text; buttons "Adicionar plantio" and "Adicionar máquina" are inside the "Hoje" section and call `onAddPlanting` / `onAddMachine`; a birthday row is a button that opens "Aniversário de …"; a festival row is still a link to `/eventos/<id>`.

- [ ] **Step 2: Run to verify they fail** — `… -- TodayReminders TodayList` → FAIL.

- [ ] **Step 3: Implement.** Move the reminders rows (and `RemindersNotice`) from `TodayList` into `TodayReminders`; delete `ShopsNotice` and the closed-shops row. Heading with actions adapted from `application-ui-v4/react/headings/card-headings/02-with-action.jsx`; buttons keep the existing primary/secondary classes from `routes/index.tsx`.

- [ ] **Step 4: Run to verify they pass** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(stardew-valley-website): focus the Hoje card and split out reminders`

---

### Task 12: Home layout

**Files:**
- Modify: `.../src/routes/index.tsx`
- Delete: `.../src/components/UpcomingEvents.tsx`, `.../src/components/UpcomingEvents.spec.tsx`
- Test: update `.../src/routes/index.spec.tsx`

**Interfaces:**
- Consumes: Tasks 9, 10, 11 components.

- [ ] **Step 1: Write the failing test** — section headings appear in order: "Hoje", "Lembretes" (on a day with reminders), "Lojas abertas hoje", "Próximos dias" (`getAllByRole('heading', { level: 2 })` names); no standalone "Adicionar plantio" button outside the "Hoje" section; clicking "Adicionar máquina" opens the machine drawer.

- [ ] **Step 2: Run to verify it fails** — `… -- routes/index` → FAIL.

- [ ] **Step 3: Implement** the order from spec §1; pass `onAddMachine={() => setMachineDrawerOpen(true)}`; render `TodayReminders` with `machineCatalogStatus(reminders)`, `OpenShops` with `machineCatalogStatus(shops)` and `profile` as progress, `UpcomingDays` with `me.data.plantings`, `names`, machines; remove the bottom button row and the `UpcomingEvents` loading block.

- [ ] **Step 4: Run the whole suite**

Run: `pnpm nx run-many -t test lint typecheck`
Expected: all projects PASS, no Biome or ty findings.

- [ ] **Step 5: Manual check** — start the website (`run` skill or `pnpm nx serve @aws-danhenrique/stardew-valley-helper-website`), check the home in light and dark themes at phone and desktop widths: buttons in the Hoje heading, open shop modal scrolls, birthday modal opens from Hoje and Próximos dias, `/lojas/pierre` date picker changes offers.

- [ ] **Step 6: Commit** — `feat(stardew-valley-website): reorganize the home around today`
