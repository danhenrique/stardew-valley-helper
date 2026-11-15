# Stardew Helper Events and Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player look up festivals, birthdays, last planting days and foraging events on a calendar page, an events list/detail, and a home summary.

**Architecture:** Foraging events become a new game-data folder, DynamoDB entity and (through the generic `/game/{type}` route) API type. The API exposes `lastPlantingDay` on plantables. The website builds one list of fixed events in a pure module (`lib/events.ts`) from `listGameEntities` + `listPlantables`; every page filters that list. No new endpoint, table or per-player state.

**Tech Stack:** Python 3.14 (PynamoDB, FastAPI/Powertools, pytest), React + TanStack Router/Query, Tailwind, Heroicons, Vitest + Testing Library, Nx (`pnpm nx ...`).

**Spec:** `docs/superpowers/specs/2026-11-07-stardew-events-calendar-design.md`

## Global Constraints

- Code, docs, identifiers and commits in **English**; UI labels in **Portuguese (pt-BR)**.
- Frontend: Tailwind only, light + dark themes, Heroicons only; icon-only buttons need `aria-label` and the same `title` (Portuguese). Look in `/home/danhenrique/projects/.tailwind/` for an equivalent before building a component; if none exists, ask the user.
- Run tasks through `pnpm nx ...`, never the underlying tool. Never guess Nx flags (`--help` first).
- No secrets, no real personal data. Test data is fictitious (`test-*` ids).
- `camelCase` for API attribute names. Fixed events have no year. `foraging` item ids must exist in game-data or be omitted.
- Do not touch `.claude/` or `.obsidian/`. Commit only the files of the task (the working tree has an untracked `.claude/CLAUDE.md`; never add it).
- `game-data` is at `/home/danhenrique/projects/stardew-valley/game-data` (a separate repo; commit there separately). Its JSON files are generated; never edit them by hand.

## Review Focus

- A villager without a `birthday` must not produce an event or crash `buildEvents` (Task 4).
- A plantable with `lastPlantingDay` null/undefined (fruit trees, older data) must produce no `cropDeadline` (Task 4).
- Today = day 28: the home summary still shows day 28 events and does not spill into the next season (Task 4).
- `/eventos/$id` with an unknown or malformed id shows a "Evento não encontrado" message with a link back, not a blank page (Task 6).
- The event id contains `:`; the route must round-trip it (`cropDeadline:parsnip-seeds:spring`) via the router's param encoding (Task 6).
- Empty states: a season with no events in the calendar, and a player with no plantings (Tasks 5, 7).

---

## File Structure

- game-data: `scripts/build-data.py` (modify), `data/eventos-coleta/*.json` (generated), `data/README.md` (modify), `data/_meta/index.json` (regenerated).
- db: `entities/game.py`, `entities/__init__.py`, `importer/convert.py` (modify); `tests/fixtures/data/eventos-coleta/test-foraging.json`, `tests/test_game_entities.py`, `tests/test_convert.py`.
- api: `stardew_valley_api/game_data.py`, `models.py`, `routes/game.py` (modify); `tests/test_game_routes.py`.
- website `src/`: `lib/events.ts` (+ `.spec.ts`), `hooks/useGameData.ts` (`useFixedEvents`), `components/EventCalendar.tsx`, `EventList.tsx`, `EventDetail.tsx`, `UpcomingEvents.tsx` (+ specs), `components/testData.ts`, `components/AppShell/index.tsx`, `routes/calendario.tsx`, `routes/eventos.index.tsx`, `routes/eventos.$id.tsx`, `routes/index.tsx` (modify).

---

### Task 1: Foraging events in game-data

**Files:**
- Modify: `/home/danhenrique/projects/stardew-valley/game-data/scripts/build-data.py` (new section after "5. festivals")
- Generated: `data/eventos-coleta/{salmonberry-season,summer-beach-foraging,blackberry-season}.json`, `data/_meta/index.json`
- Modify: `data/README.md` (folder table)

**Interfaces:**
- Produces: JSON files `{id, type: "eventos-coleta", name: {en, pt-BR}, nameVerified: false, season, startDay, endDay, item}`; values: salmonberry-season spring 15-18 `salmonberry`; summer-beach-foraging summer 12-14 `clam`; blackberry-season fall 8-11 `blackberry`. Names come from the scheduler `messages` namespace `foraging` (en/pt-BR already present).

- [ ] **Step 1: Add a "foraging events" section to `build-data.py`** that parses the `FORAGING_EVENTS` array in `src/lib/events.ts` (or hard-codes the three tuples with a comment citing the source) and calls `put("eventos-coleta", slug(refId), {...})` with `lname(...)` names like the festivals section. Map the item via the scheduler icon name (`salmonberry`, `clam`, `blackberry`) and keep it only if that id exists in an item folder (`coleta/salmonberry`, `peixes/clam`, `frutas/blackberry` all exist).
- [ ] **Step 2: Regenerate:** `python3 -I scripts/build-data.py .tmp/stardew-valley-scheduler data`. Expected: 3 new files, `_meta/index.json` lists `eventos-coleta`, and `git diff --stat data` shows no changes in other folders.
- [ ] **Step 3: Add the row** `| eventos-coleta/ | foraging events: season, days, item |` to the README folder table.
- [ ] **Step 4: Commit** in the game-data repo: `feat: add foraging events`.

---

### Task 2: `ForagingEvent` entity and importer

**Files:**
- Modify: `packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/entities/game.py`, `entities/__init__.py` (export + `__all__`), `importer/convert.py` (register `"eventos-coleta"`)
- Create: `db/tests/fixtures/data/eventos-coleta/test-foraging.json`
- Test: `db/tests/test_game_entities.py`, `db/tests/test_convert.py`

**Interfaces:**
- Produces: `ForagingEvent(GameEntity)` with `PREFIX, SK, FOLDER = "FORAGING_EVENT", "FORAGING_EVENT", "eventos-coleta"`; attributes `season: str`, `start_day` (`startDay`), `end_day` (`endDay`), `item: str | None`; `_gsi1sk` = `f"{SEASON_INDEX[season]}#{int(start_day):02d}"` (same as `Festival`).

- [ ] **Step 1: Write failing tests.** `test_should_sort_by_season_and_day_when_building_foraging_event`: `ForagingEvent.build(entity_id="test-foraging", season="fall", start_day=8, end_day=11, item="test-fruit")` gives `gsi1sk == "2#08"` and `gsi1pk` for `eventos-coleta`, and `serialize()` contains `startDay` and `endDay`. In `test_convert.py` assert the converted fixture contains an instance `by_key(result, "FORAGING_EVENT#test-foraging", "FORAGING_EVENT")`.
- [ ] **Step 2:** Run `pnpm nx test @aws-danhenrique/stardew-valley-db` (confirm the project name with `pnpm nx show projects`). Expected: FAIL (`ForagingEvent` not defined).
- [ ] **Step 3: Implement** the entity, the fixture JSON (`season: fall`, `startDay: 8`, `endDay: 11`, `item: test-fruit`) and the `convert.py` entry modelled on `"festivais"`.
- [ ] **Step 4:** Re-run the db tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(stardew-valley-db): add foraging event entity`.

---

### Task 3: API: foraging type and `lastPlantingDay`

**Files:**
- Modify: `api/stardew_valley_api/game_data.py` (`ENTITY_FOLDERS["eventos-coleta"] = ("FORAGING_EVENT", "FORAGING_EVENT")`), `models.py` (`PlantableOut.last_planting_day: int | None = None`), `routes/game.py` (`_plantable` sets it for crops only)
- Test: `api/tests/test_game_routes.py`

**Interfaces:**
- Produces: `GET /game/eventos-coleta` returns `GameEntityOut` with `attributes.season/startDay/endDay/item`; `PlantableOut.lastPlantingDay: number | null` (JSON camelCase), `null` for `fruit_tree`.

- [ ] **Step 1: Write failing tests:** `test_should_list_foraging_events_when_type_is_eventos_coleta` (the fixture event is returned with `attributes["startDay"] == 8`); `test_should_expose_last_planting_day_when_listing_plantables` (crop value equals the fixture crop's `lastPlantingDay`, adding one to the fixture crop if missing; tree is `None`).
- [ ] **Step 2:** Run `pnpm nx test @aws-danhenrique/stardew-valley-api`. Expected: FAIL.
- [ ] **Step 3: Implement** the three edits above; the value is `int(model.crop.last_planting_day)` guarded for `None`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5: Regenerate the website client.** Find the codegen target with `pnpm nx show project @aws-danhenrique/stardew-valley-helper-website`, run it, and confirm `types.gen.ts` now has `lastPlantingDay` on `PlantableOut`.
- [ ] **Step 6: Commit** api + regenerated client: `feat(stardew-valley-api): expose last planting day and foraging events`.

---

### Task 4: `lib/events.ts`

**Files:**
- Create: `website/src/lib/events.ts`, `website/src/lib/events.spec.ts`

**Interfaces:**
- Consumes: `GameEntityOut`, `PlantableOut`, `Season`, `GameDateIn` (generated types); `SEASONS` from `lib/i18n`.
- Produces:
  - `type EventKind = 'festival' | 'birthday' | 'cropDeadline' | 'foraging'`
  - `type FixedEvent = { id: string; kind: EventKind; refId: string; season: Season; day: number; endDay?: number; name: LocalizedName }` (`name` is `GameEntityOut['name']`; for `cropDeadline` it is the seed's name)
  - `buildEvents(input: { festivals: GameEntityOut[]; villagers: GameEntityOut[]; foraging: GameEntityOut[]; plantables: PlantableOut[] }): FixedEvent[]`
  - `eventsOn(events: FixedEvent[], season: Season, day: number): FixedEvent[]`
  - `eventsInSeason(events: FixedEvent[], season: Season): FixedEvent[]` (sorted by `day`)
  - `upcomingInSeason(events: FixedEvent[], today: GameDateIn): FixedEvent[]` (events with `(endDay ?? day) >= today.day` in `today.season`, sorted by `day`)
  - `findEvent(events: FixedEvent[], id: string): FixedEvent | undefined`
  - id format: `festival:<id>`, `birthday:<id>`, `foraging:<id>`, `cropDeadline:<plantableId>:<season>`.

- [ ] **Step 1: Write failing tests** with fictitious entities (`test-festival` spring 9-10, `test-villager` fall 13, `test-foraging` fall 8-11, `test-berry-seeds` crop spring with `lastPlantingDay: 20`, a sapling): ids are unique and match the format above; the villager gets `season: 'fall', day: 13`; the multi-season crop yields one `cropDeadline` per season; `eventsOn` returns the 9-10 festival on day 10 and not on day 11; **Review Focus:** a villager without `birthday` yields no event, a plantable with `lastPlantingDay` null/undefined and a `fruit_tree` yield no `cropDeadline`, `upcomingInSeason` with `today.day = 28` keeps a day-28 event and excludes events of other seasons, `findEvent` returns `undefined` for an unknown id.
- [ ] **Step 2:** Run `pnpm nx test @aws-danhenrique/stardew-valley-helper-website -- events.spec` (check the flag with `--help`). Expected: FAIL.
- [ ] **Step 3: Implement** the module. Entity attributes arrive untyped (`attributes?: {[k]: unknown}`): read them through small typed guards, ignoring entities with missing season/day.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(stardew-valley-website): add fixed events model`.

---

### Task 5: Hook, navigation and `/calendario`

**Files:**
- Modify: `hooks/useGameData.ts`, `components/testData.ts` (fictitious festival/villager/foraging entities + a plantable with `lastPlantingDay`), `components/AppShell/index.tsx` (`NAVIGATION`: add `{ name: 'Calendário', to: '/calendario' }`, `{ name: 'Eventos', to: '/eventos' }`)
- Create: `components/EventCalendar.tsx` (+ `.spec.tsx`), `routes/calendario.tsx`; `routeTree.gen.ts` is regenerated by the router plugin.

**Interfaces:**
- Consumes: Task 4 functions.
- Produces: `useFixedEvents(): UseQueryResult<FixedEvent[]>` (combines four queries, `staleTime: Infinity`); `EventCalendar` props `{ events: FixedEvent[]; plantings: readonly PlantingOut[]; names: Record<string,string>; today: GameDateIn }`; shared constants `EVENT_KIND_LABELS: Record<EventKind, string>` in `lib/i18n.ts` ("Festival", "Aniversário", "Prazo de plantio", "Coleta").

- [ ] **Step 1: Write failing component tests** for `EventCalendar`: shows the current season title (`Primavera, Ano 1`) and a marker with the event name on its day; the previous/next buttons (aria-label "Estação anterior"/"Próxima estação") change the season; unchecking a kind filter hides that kind's markers; selecting a day lists its events with a link to `/eventos/<id>`; a season with no events shows "Nenhum evento nesta estação."; the player's harvest appears on its day.
- [ ] **Step 2:** Run the website tests. Expected: FAIL.
- [ ] **Step 3: Implement** `EventCalendar` adapted from `HarvestCalendar.tsx` (same 4x7 grid and `shiftSeason`); check `.tailwind/` for a day-selection/legend pattern first. Implement `useFixedEvents`, the route (loading and error states like `sementes.tsx`) and the nav entries.
- [ ] **Step 4:** Re-run tests, then `pnpm nx lint @aws-danhenrique/stardew-valley-helper-website`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(stardew-valley-website): add calendar page`.

---

### Task 6: `/eventos` list and `/eventos/$id` detail

**Files:**
- Create: `components/EventList.tsx`, `EventDetail.tsx` (+ specs), `routes/eventos.index.tsx`, `routes/eventos.$id.tsx`
- Modify: `hooks/useGameData.ts` (`useVillagerGifts(villagerId: string)`: `getGameEntity({type:'personagens', id})`, returns the item ids of relations whose `attributes.sk` starts with `GIFT#loves#ITEM#`)

**Interfaces:**
- Consumes: `useFixedEvents`, `findEvent`, `EVENT_KIND_LABELS`.
- Produces: `EventList` props `{ events: FixedEvent[] }`; `EventDetail` props `{ event: FixedEvent; details: ... }` where kind-specific content is rendered from props, not fetched inside the component.

- [ ] **Step 1: Write failing tests:** the list groups by season in game order, filters by kind, and filters by name search (case-insensitive, accent-insensitive); the detail shows days for a festival (`Primavera 9–10`) and whether shops close; for a birthday shows the villager and loved gifts; for `cropDeadline` shows growth days and the last planting day; for `foraging` shows the day window; **Review Focus:** the route with an unknown id renders "Evento não encontrado" with a link to `/eventos`; a `cropDeadline:test-berry-seeds:spring` id resolves.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** list, detail and routes. Decision: gift names. `GiftTaste` relations carry only item ids, and resolving names needs the folder, so show loved gifts as humanized ids (`golden-pumpkin` -> "Golden Pumpkin"). This departs from the spec's "names via i18n"; keep the humanizer in one function so real names can replace it later.
- [ ] **Step 4:** Re-run tests and lint. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(stardew-valley-website): add events list and detail`.

---

### Task 7: Home summary card

**Files:**
- Create: `components/UpcomingEvents.tsx` (+ `.spec.tsx`)
- Modify: `routes/index.tsx` (render the card between `GameDatePanel` and the planting form section)

**Interfaces:**
- Consumes: `upcomingInSeason`, `useFixedEvents`.
- Produces: `UpcomingEvents` props `{ events: FixedEvent[]; today: GameDateIn }`; shows only `festival`, `birthday` and `foraging`.

- [ ] **Step 1: Write failing tests:** today's events appear first under "Hoje"; later events show their day; birthdays are grouped under one "Aniversários" heading; crop deadlines are not shown; **Review Focus:** with no events left in the season it shows "Nenhum evento até o fim da estação." and the "Ver calendário" link still renders; a player with no plantings does not affect the card.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the card (Tailwind, `CARD` classes as in `index.tsx`, link to `/calendario`) and mount it in the home route; its loading/error states must not block the plantings page.
- [ ] **Step 4:** Run `pnpm nx run-many -t lint test build -p @aws-danhenrique/stardew-valley-helper-website`. Expected: all pass.
- [ ] **Step 5: Commit:** `feat(stardew-valley-website): add upcoming events card to home`.

---

### Task 8: Numeric day and year fields with stepper buttons

Added by the user after the spec (request: "year and day as numeric fields; make changing day and year more usable, the select is not very usual"). Applies to the shared `GameDateFields`, so both the game date panel and the planting form get it.

**Files:**
- Modify: `website/src/components/form/GameDateFields.tsx`, `website/src/lib/gameDate.ts` (+ `gameDate.spec.ts`), `components/GameDatePanel.spec.tsx`, `components/PlantingForm.spec.tsx` (and any spec that picks day/year from the select)
- Create: `website/src/components/form/NumberStepper.tsx` (+ `.spec.tsx`)

**Interfaces:**
- Produces in `lib/gameDate.ts`: `MAX_YEAR = 999`, `clampDay(day: number): number` (1..28), `clampYear(year: number): number` (1..`MAX_YEAR`), `shiftDay(date: GameDateIn, delta: 1 | -1): GameDateIn` (rolls over seasons and years: spring 28 + 1 day = summer 1, winter 28 + 1 day = spring 1 of the next year; `-1` from spring 1 of year 1 returns the date unchanged).
- Produces `NumberStepper` props `{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }`: a labelled `<input type="number" inputMode="numeric">` flanked by "−" and "+" icon buttons (Heroicons `MinusIcon`/`PlusIcon`, `aria-label` and `title` "Diminuir <label>" / "Aumentar <label>"). While typing the text may be empty or out of range; `onChange` fires only with a valid integer in `min..max`, and on blur the input snaps back to the clamped value (empty restores the last valid value).
- `GameDateFields` keeps its props. Season stays a `SelectMenu`. Day and year use `NumberStepper` (day 1-28, year 1-`MAX_YEAR`). Add two icon buttons "Dia anterior" / "Próximo dia" (`ChevronLeftIcon`/`ChevronRightIcon`) that call `shiftDay` on the whole date.

- [ ] **Step 1: Write failing tests.** `gameDate.spec.ts`: `shiftDay({year:1,season:'spring',day:28},1)` is summer 1; `shiftDay({year:1,season:'winter',day:28},1)` is `{year:2,season:'spring',day:1}`; `shiftDay` -1 from `{year:2,season:'spring',day:1}` is `{year:1,season:'winter',day:28}`; -1 from year 1 spring 1 is unchanged; `clampDay(0)=1`, `clampDay(40)=28`, `clampYear(0)=1`, `clampYear(1000)=999`. `NumberStepper.spec.tsx`: typing "13" calls `onChange(13)`; typing "40" does not call `onChange` and blur shows "28"; clearing the field and blurring restores the previous value; the + and − buttons call `onChange(value±1)` and are disabled at `max`/`min`. `GameDatePanel.spec.tsx` (update): replace the day/year option clicks with `userEvent.clear` + `type` on the "Dia" and "Ano" spinbuttons, keep the season select and the expected saved date `{ year: 2, season: 'fall', day: 13 }`; add a test where "Próximo dia" from spring 28 saves summer 1.
- [ ] **Step 2:** Run the website tests. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers, `NumberStepper` (check `/home/danhenrique/projects/.tailwind/` for an input with add-on/stepper pattern first; if none fits, ask the user) and the new `GameDateFields`. Keep `DAYS` and `YEARS` only if still used elsewhere; remove them otherwise.
- [ ] **Step 4:** Update every spec that used the day/year selects (search for `/^Dia/` and `/^Ano/`), then run `pnpm nx run-many -t lint test -p @aws-danhenrique/stardew-valley-helper-website`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(stardew-valley-website): numeric day and year fields with steppers`.

---

### Task 9: Data rollout (needs user confirmation)

- [ ] **Step 1:** Run the full workspace build for the three projects (`pnpm nx run-many -t build -p <db> <api> <website>`). Expected: pass.
- [ ] **Step 2:** **Ask the user** before touching prod. Then re-import game data with the existing import flow (see `docs/` deploy runbook and `.superpowers/sdd/2026-11-07-stardew-valley-helper/import.log`), and deploy the API and website the way the runbook describes.
- [ ] **Step 3:** Verify in the deployed site: `/calendario` shows foraging events and prazo de plantio, and the home card appears.

---

## Self-Review

- **Extra request:** Task 8 (numeric day/year fields) is outside the spec; it comes from the user after the spec was approved.
- **Spec coverage:** game-data (T1), entity/importer (T2), API folder + `lastPlantingDay` + client regen (T3), `lib/events.ts` + ids (T4), hook + calendar + nav + harvests (T5), list + detail + gifts (T6), home card with kind restriction (T7), re-import (T8). Tests section of the spec maps to the tests in T2 to T7.
- **Known deviation:** loved-gift names are humanized ids in v1 (T6), not i18n names.
- **Types:** `FixedEvent`, `EventKind`, `useFixedEvents` and `EVENT_KIND_LABELS` are defined in T4/T5 and only consumed afterwards.
