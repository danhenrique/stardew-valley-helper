# Stardew Helper: merge Events into Calendar and Plantings + Machines into Production (design)

Date: 2026-11-16 · Branch: `feature/unificar-paginas`

## Goal

Reduce the main menu from 8 to 6 items by merging pages that answer the same question: "what happens
on which day" (Calendar + Events) and "what is producing on my farm" (Plantings + Machines).

## Scope and decisions

- Tabs, not stacked sections, using the existing `UnderlineTabs` component.
- The active tab lives in the URL search (`?aba=...`), validated with TanStack Router
  `validateSearch`; an invalid or missing value falls back to the first tab.
- Old routes redirect, so bookmarks and in-app links keep working.
- Menu name for the new page: **"Produção"** (route `/producao`).
- UI labels in pt-BR; code in English; Tailwind only.

## 1. Routes

| Route | Tabs (`aba`) | Content |
|---|---|---|
| `/calendario` | `calendario` (default), `eventos` | `EventCalendar` · `EventList` |
| `/producao` (new) | `plantios` (default), `maquinas` | `MyPlantings` + `PlantingDrawer` · `MachineList` + `MachineCalendar` + `MachineDrawer` |
| `/eventos/$id` | unchanged | `EventDetailPage` |

- `/eventos` (index) → `redirect` to `/calendario?aba=eventos`.
- `/plantios` → `/producao?aba=plantios`; `/maquinas` → `/producao?aba=maquinas`.
- The current page bodies of `plantios.tsx` and `maquinas.tsx` move to `components/PlantingsTab.tsx`
  and `components/MachinesTab.tsx`; `calendario.tsx` and `eventos.index.tsx` bodies move to
  `CalendarTab.tsx` and `EventsTab.tsx`. Route files only compose tabs. Each tab keeps its own
  loading/error states and only fetches when rendered.
- Page title stays the page name ("Calendário", "Produção"); tabs sit below it.

## 2. Navigation and links

- `AppShell` `NAVIGATION`: Hoje, Produção, Sementes, Peixes, Calendário, Lojas. `isCurrent` matches by
  pathname, so `/producao?aba=maquinas` highlights "Produção".
- `UpcomingDays`: harvest → `/producao?aba=plantios`, machine → `/producao?aba=maquinas`.
- `EventDetail` "back" link → `/calendario?aba=eventos`.
- `renderWithRouter` test helper: replace `/plantios` and `/maquinas` with `/producao`; keep
  `/eventos` for the redirect tests.
- Switching tabs uses `navigate({ search: { aba }, replace: true })` so tab changes do not stack
  history entries.

## 3. Testing

- `calendario.spec.tsx`: default tab, `?aba=eventos`, invalid `aba` falls back.
- New `producao.spec.tsx`: both tabs and their drawers (merging `plantios.spec.tsx` and
  `maquinas.spec.tsx`).
- Redirect specs for `/eventos`, `/plantios`, `/maquinas`.
- `AppShell.spec.tsx` updated for 6 items; `UpcomingDays.spec.tsx` updated link targets.
- Run through Nx: `pnpm nx run-many -t lint test build`.

## Out of scope

- Visual redesign of the tab contents; changes to event detail page.
