# Stardew Helper: home redesign, shop catalogs and birthday gifts (design)

Date: 2026-11-11 · Branch: `feat/stardew-home-redesign` (from `main` at `7408b23`)

## Goal

Make the home page answer "what matters today?" at a glance and turn the shop data already in DynamoDB
into something useful:

- the "Hoje" card shows only today's **events, plantings and machines**, with the add buttons next to it;
- reminders move to their own card, without the "Fechadas hoje" shop line;
- a new **"Lojas abertas hoje"** card lists only the shops open today; clicking one opens a modal with
  **today's catalog**, which links to a full catalog page with a date selector;
- "Próximos eventos" becomes **"Próximos dias"**: a one-row calendar of the next 7 days (today included)
  showing every item of each day;
- clicking a **birthday** opens a modal with the villager's gift tastes;
- item, category and building names show in **Portuguese** everywhere these features touch.

## Scope and decisions

- **In scope:** home layout, open-shops card, shop catalog (modal + page), 7-day strip, removal of the
  "+N" marker limit on `/calendario`, birthday gifts modal, localized names endpoint.
- **Out of scope:** Traveling Cart stock (random, no offers in the data), predicting the Saloon's
  rotating stock, tracking fishing level / buildings / monster goals in the profile, universal gift
  tastes, gift modal on `/calendario`.
- **Catalog filtering runs in the website** (pure functions in `lib/`), loading each shop's offers only
  when it is opened. Rejected: a `GET /shops/today` endpoint (duplicates the shop-hours rules in Python
  for the same result) and preloading every shop's offers on the home (19 requests for data the player
  may never open).
- **Localized names come from a new `GET /game/names` endpoint.** Rejected: enriching each relation of
  `GET /game/{type}/{id}` with its target's name (a relation does not say whether the target is an item
  or a building, and it does not cover category exceptions).
- **Gift tastes are the villager's own only** (no merge with the universal tastes).
- Modal and page share one catalog component and one filter; modal and gift page share one gift
  component. Nothing is rendered twice in different ways.
- UI labels stay in Portuguese (pt-BR); code, docs and commits are in English. Styling follows the
  workspace rules: Tailwind, Tailwind Plus components first, Heroicons, light and dark themes.

## 1. Home layout (`routes/index.tsx`)

Top to bottom:

1. `TodayBar` (unchanged).
2. **Hoje** (`TodayList`): groups *Eventos*, *Plantios*, *Máquinas*. The *Lembretes* group and the
   "Fechadas hoje" line are removed. The card heading gets the "Adicionar plantio" and "Adicionar
   máquina" buttons on the right (Tailwind Plus "card heading with actions"); on narrow screens they
   wrap below the title. The empty state ("Nada para coletar hoje", "Próximo: …", "Adicione sua
   primeira semente") stays. The buttons at the bottom of the page are removed.
3. **Lembretes** (`TodayReminders`, new card): the rows that `TodayList` renders today for
   `remindersToday(...)`, unchanged in content. The card is hidden when there is no reminder today and
   the data loaded; it shows the loading/error notice otherwise.
4. **Lojas abertas hoje** (`OpenShops`, new card), see §2.
5. **Próximos dias** (`UpcomingDays`, replaces `UpcomingEvents`), see §4.

`TodayList` loses its `reminders`, `remindersStatus`, `shops`, `shopsStatus` and `progress` props and
gains `onAddMachine`.

## 2. Open shops card (`components/OpenShops.tsx`)

- Input: shops, today, fixed events, progress, status. Shows the shops whose `shopStatusToday(...)`
  is `open`; closed shops (any reason, including out of season and permanently closed) are not shown.
- Row (Tailwind Plus stacked list): `GameIcon`, shop name, today's hours (`ShopStatus.hours`), the
  existing notes ("Fecha se chover", festival note).
- Clicking a row opens `ShopCatalogModal` for that shop.
- Shops without offers in the data (Sorveteria, Cinema, Museu, Carroça viajante) render as plain rows,
  not buttons. The Traveling Cart row shows "Estoque aleatório".
- Footer link "Ver todas as lojas" → `/lojas`.
- Loading: "Carregando lojas..."; error: "Não foi possível carregar as lojas." Other cards keep working.
- When no shop is open: "Nenhuma loja aberta hoje."

## 3. Shop catalog

### 3.1 Data (`lib/shopCatalog.ts`)

```ts
type ShopOffer = {
  itemId: string;
  price?: number;
  priceByYear?: { year1: number; year2plus: number };
  currency?: Partial<Record<'qiCoins' | 'qiGems' | 'goldenWalnuts', number>>; // non-gold cost
  materials?: { item: string; qty: number }[];
  season?: Season;
  section?: string;                  // 'shop' | 'upgrade' | 'geode' | 'building' | 'magic'
  availability?: Weekday | 'evenDays' | 'oddDays';
  fromYear?: number;
  fishingLevel?: number;
  packSize?: number;
  recipe?: boolean;
  rotating?: boolean;
  requiresBuilding?: string;
  requiresMonsterGoal?: string;
  special?: string;
};
```

- `buildOffers(relations: RelationOut[]): ShopOffer[]` keeps the `ShopOffer` relations of
  `GET /game/lojas/{id}`, in stored order (sort key index).
- `offersOn(offers, date): ShopOffer[]` keeps the offers valid on `date`:
  - `season` set → must equal `date.season`;
  - `availability` weekday → must equal `weekdayOf(date.day)`; `evenDays` / `oddDays` → day parity;
  - `fromYear` set → `date.year >= fromYear`.
- `offerCosts(offer, year)`: the list of costs to show, in this order: gold (`priceByYear.year1` in
  year 1, `priceByYear.year2plus` from year 2, else `price`), then each `currency` entry (an offer
  can have both gold and a currency). Labels: "g", "fichas Qi", "gemas Qi", "nozes douradas".
- `offerTags(offer)`: Portuguese labels for requirements the profile does not track, which never hide
  the offer: "Requer pesca nível N", "Requer {building}", "Requer meta de monstros", "Receita",
  "Pacote com N", "Rotativo"; `requiresBuilding` and `requiresMonsterGoal` names come from `nameOf`.
  `special` has two stored values, each with a fixed label: "Só um, com amizade máxima com Krobus e
  solteiro" and "Às quartas: peixe aleatório ou isca magnética".
- `buildOffers` drops fields whose stored shape does not match the type above instead of crashing.

### 3.2 Hook

`useShopOffers(shopId)` queries `getGameEntity({ type: 'lojas', id })` with `staleTime: Infinity`
(same pattern as `useVillagerGifts`) and returns `{ status, offers }`. It runs only while the modal or
page is open.

### 3.3 `components/ShopCatalog.tsx` (the only component that renders offers)

- Props: `{ offers: ShopOffer[]; date: GameDateIn }` (already filtered by the caller with `offersOn`).
- Tailwind Plus stacked list; each row: `GameIcon`, name (`nameOf`), costs from `offerCosts`
  ("250g", "10 gemas Qi"), materials (icon + `qty`), tags as badges.
- Grouped by `section` when the shop uses sections (Ferreiro: Loja / Melhorias / Geodos; Carpinteiro
  and Mago: Construções / Magia / Loja), one heading per group.
- Saloon (any offer with `rotating`): notice "Parte do estoque é sorteada pelo jogo".
- Empty: "Nada à venda neste dia."

### 3.4 `components/ShopCatalogModal.tsx`

- Built on the shared `Modal` (§6). Title: shop name; subtitle: today's hours.
- Body: `ShopCatalog` with `offersOn(offers, today)`; loading "Carregando catálogo...", error
  "Não foi possível carregar o catálogo."
- Footer: link "Ver catálogo completo" → `/lojas/$id`.

### 3.5 Page `/lojas/$id` (`routes/lojas.$id.tsx`)

- Header: shop icon and name, status on the selected date (open with hours, or closed with the reason
  from `shopStatusToday`).
- Date selector: season (existing `SeasonTabs`), day (select 1–28), year (number input, min 1);
  defaults to the player's current date. Untouched, the page shows the same offers as the modal.
- Body: the same `ShopCatalog` with `offersOn(offers, selectedDate)`.
- Unknown id: "Loja não encontrada" with a link to `/lojas`. The header renders even if offers fail.
- `/lojas` table: each shop name links to its page.

## 4. Next 7 days strip (`components/UpcomingDays.tsx`)

- Extract from `EventCalendar`:
  - `calendarMarkers(date, { events, plantings, names, machineMarkers })` in `lib/calendarMarkers.ts`:
    the markers of one day (today's `markersFor`), as a pure function;
  - `CalendarDayCell`: the day cell (number, today highlight, marker list).
- `EventCalendar` uses both and drops `MAX_MARKERS`: every day shows **all** markers; cells grow with
  their content.
- `UpcomingDays` shows the 7 dates from today to today+6, crossing season (and year) boundaries
  (`nextDates(today, 7)` in `lib/gameDate.ts`). The first cell is highlighted as today. Each cell shows
  a short date label ("Seg 12", and the season name on day 1).
- Layout: `grid-cols-7` from `sm`; a vertical list of days below `sm`.
- Markers are interactive: a birthday opens `BirthdayGiftsModal`; any other fixed event links to
  `/eventos/$id`; harvests link to `/plantios`; machine markers link to `/maquinas`.
- If the machine catalog fails, `MachineCatalogNotice` shows above the strip; events and harvests stay.
- `UpcomingEvents` and its spec are removed.

## 5. Birthday gifts

### 5.1 Data (`lib/gifts.ts`)

```ts
type GiftTier = 'loves' | 'likes' | 'neutral' | 'dislikesOrHates';
type GiftEntry = { kind: 'item' | 'category'; id: string; except: string[] };
type GiftTastes = Record<GiftTier, GiftEntry[]>;
```

- `giftTastes(relations)` parses the `GIFT#<tier>#<ITEM|CATEGORY>#<id>` relations (with the `except`
  attribute) of `GET /game/personagens/{id}`.
- Tier labels: Ama, Gosta, Neutro, Não gosta ou odeia; order as above.
- `lovedGiftIds` is replaced; `useVillagerGifts` returns `{ status, tastes }`.

### 5.2 `components/GiftTastes.tsx` (the only component that renders gifts)

- Props: `{ tastes: GiftTastes; tiers?: GiftTier[] }` (default: all four).
- One section per tier with entries; empty tiers are omitted.
- Item: `GameIcon` + `nameOf(id)`. Category: `nameOf(id)` with "exceto A, B" below in smaller text.
- `EventDetail` uses it with `tiers={['loves']}` (the detail page keeps showing only loved gifts).

### 5.3 `components/BirthdayGiftsModal.tsx`

- Built on `Modal`. Title: "Aniversário de {villager}"; subtitle: the date ("Outono 13").
- Body: `GiftTastes` with all tiers; states "Carregando presentes...", "Não foi possível carregar os
  presentes.", "Nenhum presente cadastrado.".
- Footer: link "Ver evento" → `/eventos/$id`.
- Opened from birthday rows in the "Hoje" *Eventos* group and birthday markers in "Próximos dias";
  other event kinds keep linking to their page.

## 6. Shared modal (`components/Modal.tsx`)

Adapted from Tailwind Plus `application-ui-v4/react/overlays/modal-dialogs` with Headless UI `Dialog`
(already a dependency). Props: `open`, `onClose`, `title`, `subtitle?`, `footer?`, `children`.
Icon-only close button (`XMarkIcon`, `aria-label` and `title` "Fechar"). Scrollable body for long
catalogs. Light and dark styles.

## 7. Localized names

### 7.1 API: `GET /game/names`

- Returns `{ [id: string]: LocalizedTextOut }` for every item folder (`ITEM_FOLDERS`), `categorias`
  and `construcoes`, built from `list_folder` per folder.
- Read-only, same auth as the other `/game` routes. Added to `api/stardew_valley_api/routes/game.py`,
  declared **before** `/game/{type}` so it is not captured as a folder name.
- Test in `api/tests/test_game_routes.py`. The website client in `generated/` is regenerated.

### 7.2 Website: `useGameNames()`

- Queries `GET /game/names` once with `staleTime: Infinity`; returns `nameOf(id)`, which is the pt-BR
  name, else the English name, else `humanizeId(id)` (so loading or failing never breaks a view).
- Used by `ShopCatalog`, `GiftTastes` and `EventDetail` (foraging item and gifts).

## 8. Error handling summary

| Situation | Behavior |
|---|---|
| Shops loading / failed | Open-shops card shows its notice; other cards unaffected |
| Offers loading / failed | Modal and page body show the notice; page header still renders |
| Unknown shop id | "Loja não encontrada" + link to `/lojas` |
| Names loading / failed | `nameOf` falls back to `humanizeId` |
| Gifts loading / failed / empty | Modal shows the matching message |
| Machine catalog failed | `MachineCatalogNotice` above the strip; events and harvests shown |

## 9. Testing

Vitest + Testing Library, run through Nx (`pnpm nx run-many -t test lint`).

- **Unit:** `offersOn` (season, weekday, even/odd days, `fromYear`), `offerCosts`, `offerTags`,
  `buildOffers`, `giftTastes`, `calendarMarkers`, `nextDates` across season and year boundaries.
- **Components:** `ShopCatalog` (sections, Saloon notice, empty), `GiftTastes` (tiers, categories with
  exceptions, `tiers` filter), `Modal` (close button name, footer), `ShopCatalogModal` and
  `BirthdayGiftsModal` (open, states, footer link), `OpenShops` (only open shops, plain rows without
  offers, Traveling Cart label), `UpcomingDays` (7 cells from today, all markers, birthday opens modal),
  `TodayReminders`.
- **Updated:** `TodayList.spec` (no reminders/closed shops, buttons in the heading), `index.spec`
  (card order), `EventCalendar.spec` (no "+N"), `EventDetail.spec` (localized names via `GiftTastes`),
  `lojas.spec` (names link to the shop page), new `lojas.$id` route spec.
- **API:** `GET /game/names` returns localized names of items, categories and buildings and is not
  shadowed by `/game/{type}`.

## 10. Delivery

Small commits in English, in this order: API names endpoint → `useGameNames` → `Modal` → shop catalog
(lib, component, modal, page) → gifts (lib, component, modal) → calendar extraction and "+N" removal →
home layout (Hoje heading buttons, Lembretes card, open shops, 7-day strip).
