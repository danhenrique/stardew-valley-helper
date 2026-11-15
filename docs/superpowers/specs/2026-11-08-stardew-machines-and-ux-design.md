# Stardew Helper — Machines and simpler add flow — Design

- **Date:** 2026-11-08
- **Projects:** `packages/stardew-valley/{db,api,website}` (no infra file changes)
- **Builds on:** `2026-11-07-stardew-valley-helper-design.md`, `2026-11-07-stardew-events-calendar-design.md`
- **Status:** approved in conversation; awaiting review of the written spec

## 1. Goal

Two linked pieces, delivered in order from one spec and one plan:

- **Phase A — simpler flow.** Adding or editing a planting is too complex today: the form asks mode, location and date before the seed (and changing them clears the chosen seed), shows 8 fields at once, sits permanently on a crowded home page, and offers no quick actions. Replace it with a "Hoje" (today) home page, a drawer for add/edit with sensible defaults, and one-click actions.
- **Phase B — machines.** Let the player track multi-day processing machines (Keg, Preserves Jar, Oil Maker, Tappers, Crystalarium, Bee House, Cask) the same way as plantings: register what went in and when, see when it is ready, and act on it from the home page.

**Success means:**

- The common case "I planted X today" takes: open drawer → pick seed → Save (date defaults to today, location to Farm, quantity to 1).
- Changing any field in the drawer never clears another field.
- Advancing the in-game day is one click on the home page.
- Everything ready today (plantings and machines) is listed on the home page with its quick actions.
- Machine collections appear on `/maquinas`, `/calendario` and in "Próximos 7 dias".
- `pnpm nx run-many -t build -p <stardew projects>` passes (lint, typecheck, tests).

## 2. Decisions made in conversation

| Decision | Choice |
|---|---|
| Machines in scope | Multi-day only: Keg, Preserves Jar, Oil Maker, Tapper, Heavy Tapper, Crystalarium, Bee House, Cask ("Barril de Madeira") |
| Continuous machines | Shown as repeating cycles, like crop regrowth; the record stays until deleted |
| Cask | Shows the silver, gold and iridium milestones above the starting quality |
| Placement | New `/maquinas` page; collections also in `/calendario` and in the home's upcoming list |
| UX approach | "Hoje" home + add/edit drawer + quick actions (approach A) |
| Data fix | Applied by the importer from a versioned correction table; the dataset folder (not under git) is not edited |
| Visual companion | Declined; text-only design |

## 3. Data — importer corrections

The dataset (`stardew-valley/game-data/data/maquinas`) has two errors:

- `bee-house.json` `processing` lists, besides Honey (4 days), Cask aging times: Wine 56, Pale Ale 34, Beer 28, Mead 28, Cheese 14, Goat Cheese 14.
- `cask.json` has no `processing`.

The importer applies a correction table in `importer/corrections.py` (versioned, unit-tested) after reading and before converting:

- Bee House keeps only `honey` (4 days).
- Cask receives the six entries above with `kind: "aging"` (days = days from normal to iridium quality).
- Every applied correction is logged (Powertools logger) with machine id and output id.

Corrections are matched by machine id and output id; if the source already matches the corrected shape (e.g. the dataset is fixed upstream), the correction is a no-op and logs nothing. The `Produces` relationship for Cask is generated from the corrected entries; Bee House no longer produces wine, ale, beer, mead or cheese.

## 4. Machine rules (`api/stardew_valley_api/machine_schedule.py`, pure, no I/O)

Calendar and absolute days as in `schedule.py` (`abs = (year-1)*112 + seasonIdx*28 + day`).

Machine kinds are code constants (the data does not carry them):

| Kind | Machines (`machineId`) |
|---|---|
| `batch` | `keg`, `preserves-jar`, `oil-maker` |
| `continuous` | `tapper`, `heavy-tapper`, `crystalarium`, `bee-house` |
| `aging` | `cask` |

Days per output come from the machine's (corrected) `processing` entry for the chosen `outputId`.

- **Batch:** `readyOn = startedOn + days`. Status `processing` (`daysUntilNext` = days left) before, `ready` on or after `readyOn`.
- **Continuous:** collections on `startedOn + k × days` (k ≥ 1). Output: next 10 collections from today, `infinite: true`. Status `processing` (next in N), `ready` when today is a collection day.
- **Bee House on the farm:** does not produce in winter. A collection that would fall in winter moves to spring day 1, and the cycle restarts from that day. On Ginger Island it produces all year. Greenhouse is not offered for Bee House.
- **Cask:** milestones at fractions of the total `days` (normal → iridium): silver at ¼, gold at ½, iridium at 1. Days to each milestone above `startQuality` = `ceil(total × (fraction(target) − fraction(startQuality)))`, with `fraction(normal) = 0`. Example, Wine (56): normal → silver 14, gold 28, iridium 56; silver → gold 14, iridium 42. Status `aging` (next milestone and days left) or `iridium` (done). These fractions follow the game's aging behavior as known during design and are pinned by tests; the user validates them before Phase B implementation starts.
- **Approximate times:** the dataset stores whole days; some outputs are minutes-based in the game (e.g. Beer). Outputs listed in a code constant `APPROXIMATE_OUTPUTS` (Keg: `beer`, `pale-ale`; Oil Maker: `oil`) return `approximate: true`, and the UI shows "tempo aproximado".
- **Output:** `readyOn` (batch), `collections[]` (continuous), `milestones[]{quality, on}` (aging), `infinite`, `status`, `daysUntilNext`, `approximate`, `warnings[]`.

Validation (`422`): unknown output for the machine; `startQuality` given for a machine other than Cask, or `iridium`; `location` other than `farm`/`ginger-island` for Bee House; `startQuality` missing for Cask (defaults to `normal` in the form, required by the API).

## 5. Player data — `MachineBatch`

| pk | sk | Attributes |
|---|---|---|
| `PLAYER#<sub>` | `MACHINE#<ulid>` | `machineId`, `outputId`, `startedOn{year,season,day}`, `quantity` (1–999, number of machines), `startQuality` (`normal\|silver\|gold`, Cask only), `location` (`farm\|greenhouse\|ginger-island`, default `farm`; used by Bee House only), `label` (optional, ≤ 60), `createdAt` |

Access pattern 5 (`Query PLAYER#<sub>`) now returns profile + plantings + machines. No personal data is stored.

## 6. API changes

| Method | Path | Purpose |
|---|---|---|
| GET | `/machines` | Machines in scope with kind, outputs (`id`, `name`, `days`, `approximate`) |
| POST | `/machine-schedule` | Preview without saving |
| GET | `/me` | Adds `machines[]` with computed schedule/status |
| POST | `/me/machines` | Create |
| PUT | `/me/machines/{id}` | Update (also used by "Recolocar": `startedOn = today`) |
| DELETE | `/me/machines/{id}` | Delete |

Same rules as the existing routes: caller `sub` from the request context only, response models on every route, Powertools logger with no PII, `404` for an unknown record.

**Infra:** no `.tf` changes. The API Terraform module creates one Lambda per entry of the generated `operations.json`, so the 5 new operations become new Lambdas on the next `apply` (run only after explicit user confirmation, as today).

## 7. Website — Phase A (new flow, plantings)

### 7.1 Routes and navigation

Menu: **Hoje** (`/`) · **Plantios** (`/plantios`) · **Máquinas** (`/maquinas`, Phase B) · **Sementes** · **Calendário** · **Eventos**.

### 7.2 Home "Hoje" (`/`)

Top to bottom:

1. **Date bar:** "Primavera 12 · Ano 2", primary text button **"Avançar dia"**, icon-only `ChevronLeftIcon` ("Dia anterior"), both via the existing `shiftDay` and `PUT /me/profile`. A "Alterar" link opens a `Disclosure` with the current day/season/year fields and the **Agricultor** toggle (the current `GameDatePanel` content).
2. **"Para fazer hoje":** every planting (and, in Phase B, machine) whose status is `ready` today, grouped "Plantios" / "Máquinas". Each row: name, quantity, location, quick actions (§7.4). Empty state: "Nada para coletar hoje" plus the next expected item ("Próximo: Morango em 2 dias").
3. **"Próximos 7 dias":** the existing `UpcomingEvents`, extended in Phase B with machine collections (own icon and screen-reader kind).
4. **Shortcuts:** "Adicionar plantio" (and "Adicionar máquina" in Phase B) open the drawer on the home page.

### 7.3 Add/edit drawer (`ItemDrawer`)

Base: Tailwind Plus `overlays/drawers/05-with-sticky-footer.jsx` (utility classes kept). Full width on small screens. Closes with icon-only `XMarkIcon` ("Fechar"), Esc, or clicking outside. Edit opens the same drawer pre-filled.

Planting form (`PlantingForm`, rewritten), in order:

1. **Semente ou muda** — combobox with **all** plantables; secondary text = seasons/days; plantables not growable in the chosen date's season on the Farm show a "Fora da estação" badge. No field change ever clears the selection; an invalid combination shows an inline message ("Fora da estação na Fazenda — use Estufa ou Ilha") and disables Save.
2. **Data** — default "Hoje (<date>)"; an "Outra data" link reveals `GameDateFields`.
3. **Local** — existing `LocationRadio`, default Fazenda.
4. **Quantidade** — existing `NumberStepper`, default 1.
5. **"Mais opções"** (`Disclosure`, collapsed): Fertilizante; toggle "Sei só a data de uma colheita" (replaces `ModeRadio`; enabled only for regrowing crops; when on, the date label becomes "Data da colheita" and Fertilizante is hidden); Apelido.

Sticky footer: one-line preview ("Pronto em Primavera 20 · 4 colheitas"), "Ver detalhes" expanding the existing `SchedulePreview`, Cancelar, Salvar. Preview still uses `POST /schedule` debounced 300 ms.

### 7.4 Quick actions

Run immediately, no confirmation; a notification with **"Desfazer"** stays for 5 s. Undo is client-side: the previous record is kept and the inverse `PUT`/`POST` is sent. On failure the UI rolls back and shows an error notification.

| Situation | Actions |
|---|---|
| Non-regrowing planting `ready` | **Replantar** (new `plantedOn = today`, same seed, fertilizer, location, quantity; disabled with a reason when out of season) · **Remover** |
| Regrowing planting `ready` | none (informational) |
| Planting `dead` / `finished` | **Remover**; **Replantar** when the season allows |
| Batch machine `ready` (Phase B) | **Recolocar** (`startedOn = today`, same output) · **Trocar produto** (opens drawer pre-filled) · **Esvaziar** (delete) |
| Continuous machine `ready` (Phase B) | none (informational) |
| Cask at iridium (Phase B) | **Retirar** (delete) |

"Replantar", "Recolocar", "Trocar produto" keep text labels. "Remover", "Esvaziar", "Retirar" are icon-only `TrashIcon` buttons with `aria-label` = `title` = the action name.

### 7.5 `/plantios`

Heading + "Adicionar plantio"; existing location tabs; `PlantingList` rows with an actions menu (Editar · Replantar · Remover); `HarvestCalendar`. Empty state (`EmptyPlantings`) gets a button that opens the drawer.

## 8. Website — Phase B (machines)

### 8.1 Machine drawer (`MachineForm` inside `ItemDrawer`)

1. **Máquina** — select with the 8 machines.
2. **Produto** — only that machine's outputs (secondary text = days, "aprox." when approximate). A single output (Bee House → Mel, Oil Maker → Óleo) is pre-selected and shown as text. Changing the machine keeps the product only if still valid; otherwise an inline message asks to choose one (nothing else is cleared).
3. **Início** — default "Hoje", "Outra data" link.
4. **Qualidade inicial** — Normal · Prata · Ouro, only for Cask (default Normal).
5. **Local** — Fazenda · Ilha Gengibre, only for Bee House (default Fazenda).
6. **Quantidade de máquinas** — `NumberStepper`, default 1.
7. **"Mais opções"** — Apelido.

Footer preview examples: "Pronto em Verão 3", "Coleta a cada 4 dias · próxima Verão 3", "Prata Verão 5 · Ouro Verão 19 · Irídio Outono 19"; "Ver detalhes" lists all dates.

### 8.2 `/maquinas`

Heading + "Adicionar máquina"; tabs **Todas · Prontas · Em andamento** with counts (`navigation/tabs/08-tabs-with-underline-and-badges.jsx`); stacked list (`lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx`) showing machine → product, quantity, status badge, next date, actions menu (Editar · Recolocar · Esvaziar); season calendar of collections (`data-display/calendars/02-month-view.jsx`, same as `HarvestCalendar`); dashed-border empty state with a button opening the drawer.

### 8.3 Integration

Home "Para fazer hoje" machine group, "Próximos 7 dias" and `/calendario` markers include machine collections and Cask milestones, with an icon per kind (Heroicons first, Lucide if missing; any icon not found in either is proposed to the user first).

## 9. Errors

- API: `422` for the validations in §4 and the existing planting rules; `404` unknown record/machine.
- Drawer: errors inline at the field; network errors via the existing notifications.
- Quick actions: optimistic update, rollback + error notification on failure.

## 10. Testing (TDD)

- `machine_schedule.py` (pytest): Keg Wine ready at +7; Bee House started Winter 26 on the farm → first collection Spring 1, then every 4 days; Bee House on Ginger Island produces in winter; Cask Wine from normal → 14/28/56, from silver → gold +14, iridium +42; Cask Pale Ale rounds up (9/17/34); Tapper returns 10 collections with `infinite`; invalid output / quality / location → error.
- Importer: corrections move the six aging entries to Cask, leave Bee House with Honey only, log each change, and are no-ops on already-correct input.
- API: `/me/machines` CRUD and `/machine-schedule` against moto; `/me` includes machines.
- Website (Vitest + Testing Library):
  - Planting drawer: changing location/date never clears the seed; default "Hoje"; invalid combination disables Save with the inline message; "Sei só a data de uma colheita" only for regrowing crops.
  - Machine drawer: conditional fields (quality only for Cask, location only for Bee House), single output pre-selected.
  - Home: "Avançar dia" updates the date; "Para fazer hoje" lists ready items; Replantar / Recolocar with Desfazer; rollback on failure.
- All through Nx (`pnpm nx run-many -t build`).

## 11. Out of scope

Short machines (Cheese Press, Mayonnaise Machine, Loom, Fish Smoker, Dehydrator, Furnace); hour/minute precision; sale value and specific inputs (e.g. "Ancient Fruit wine"); push notifications; command palette quick-add; marking a collection as done without changing the record; editing the dataset folder.
