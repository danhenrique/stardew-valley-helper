# Stardew Helper Machines and Simpler Add Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-open planting form with a "Hoje" home, an add/edit drawer and quick actions (Phase A), then add multi-day machine tracking on the same pattern (Phase B).

**Architecture:** Phase A is website-only: a shared `ItemDrawer`, a rewritten `PlantingForm` that never clears fields, a `PlantingDrawer` owning mutations and preview, a home made of `TodayBar` + `TodayList` + `UpcomingEvents`, and plantings moved to `/plantios`. Phase B adds an importer correction table, a `MachineBatch` player entity, a pure `machine_schedule.py`, machine routes (one Lambda per operation, generated from `operations.json`, no `.tf` edits), and the `/maquinas` page plus home/calendar integration.

**Tech Stack:** Python 3.14 (PynamoDB, FastAPI/Powertools, pytest + moto), React + TanStack Router/Query, Headless UI, Tailwind, Heroicons, Vitest + Testing Library, Nx (`pnpm nx ...`).

**Spec:** `docs/superpowers/specs/2026-11-08-stardew-machines-and-ux-design.md`

## Global Constraints

- Code, docs, identifiers and commits in **English**; UI labels in **Portuguese (pt-BR)**.
- Frontend: Tailwind utility classes only, light + dark themes, Heroicons (`@heroicons/react`) first, Lucide only if missing; ask the user before any other icon source. Adapt from `/home/danhenrique/projects/.tailwind/application-ui-v4/react/` and keep a `// Adapted from Tailwind Plus <path>` comment, as existing components do.
- Icon-only buttons: `aria-label` and the same `title`, in Portuguese.
- Run everything through Nx with pnpm: `pnpm nx run <project>:<target>`. Projects: `aws_danhenrique.stardew_valley_db`, `aws_danhenrique.stardew_valley_api`, `@aws-danhenrique/stardew-valley-helper-website`. Never guess flags (`--help` first).
- No secrets, no real personal data; test data is fictitious (`test-*` ids, except machine ids, which must be the real game ids because kinds are keyed by them).
- `camelCase` for API JSON/DynamoDB attribute names (`attr_name=` in PynamoDB, `CamelModel` in Pydantic). Structured Powertools logs, no PII (no `sub`).
- Caller `sub` only from the request context (`PlayerId`), never from the body.
- Do not edit `/home/danhenrique/projects/stardew-valley/game-data` nor any `.tf` file; do not touch `.claude/` or `.obsidian/`; never `git add` the untracked `.claude/CLAUDE.md`. Commit only the task's files.
- `pnpm nx run-many -t build -p aws_danhenrique.stardew_valley_db aws_danhenrique.stardew_valley_api @aws-danhenrique/stardew-valley-helper-website` must pass at the end of each phase.

## Review Focus

- Changing season/location/date in the planting drawer while a seed is selected must keep the seed and show the inline issue, never clear it (Task A3).
- "Avançar dia" on Winter 28, Year N goes to Spring 1, Year N+1; on the last valid year it stays (existing `shiftDay` cap) and the button is disabled (Task A4).
- Clicking "Desfazer" after "Remover" recreates the planting with the same fields (new id), and a second quick action replaces the first undo notification instead of stacking (Tasks A1, A5).
- Bee House started in winter on the farm: the first collection is Spring 1 of the next year, never a winter day (Task B3).
- An existing player record created before Phase B (no `MACHINE#` rows) must still load `/me` with `machines: []` (Task B5).

---

## Phase A — Simpler flow

### Task A1: Undo notifications

**Files:**
- Modify: `packages/stardew-valley/website/src/components/Notifications.tsx`
- Test: `packages/stardew-valley/website/src/components/Notifications.spec.tsx`

**Interfaces:**
- Produces: `useNotifications(): { notifyError(message: string): void; notifyUndo(message: string, onUndo: () => void): void }`; `UNDO_TIMEOUT_MS = 5000` (exported).

- [ ] **Step 1: Write failing tests** in `Notifications.spec.tsx`:
  - `should call onUndo when Desfazer is clicked` — render a consumer calling `notifyUndo('Plantio removido', onUndo)`; `screen.getByText('Plantio removido')`; click button `{ name: 'Desfazer' }`; `expect(onUndo).toHaveBeenCalledTimes(1)` and the message disappears.
  - `should hide the undo notification after 5 seconds` — fake timers, advance `UNDO_TIMEOUT_MS`; message gone; `onUndo` not called.
  - `should replace the previous undo notification` — two `notifyUndo` calls; only the second message is in the document.
- [ ] **Step 2: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- Notifications` → FAIL (`notifyUndo` is not a function).
- [ ] **Step 3: Implement** in the provider a single `notice` state `{ kind: 'error' | 'undo'; message; onUndo? }` (a new notice replaces the current one); the undo variant adapts `overlays/notifications/02-condensed.jsx` (message + "Desfazer" text button + `XMarkIcon` close "Fechar"); a `setTimeout(UNDO_TIMEOUT_MS)` keyed on the notice clears it. Keep `notifyError` behavior and markup unchanged. Add to `API_DETAILS` the Phase B messages now: `'Output does not belong to this machine': 'Este produto não é desta máquina.'`, `'Machine not found': 'Máquina não encontrada.'`, `'Machine batch not found': 'Registro de máquina não encontrado.'`.
- [ ] **Step 4: Run** the same command → PASS, and the existing `Notifications` tests still pass.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add undo notifications`

### Task A2: Planting rules helpers and ItemDrawer

**Files:**
- Create: `packages/stardew-valley/website/src/lib/plantings.ts`, `packages/stardew-valley/website/src/lib/plantings.spec.ts`
- Create: `packages/stardew-valley/website/src/components/ItemDrawer.tsx`, `packages/stardew-valley/website/src/components/ItemDrawer.spec.tsx`

**Interfaces:**
- Produces (`lib/plantings.ts`):
  - `plantingIssue(plantable: PlantableOut | undefined, input: { date: GameDateIn; location: Location; anchor: Anchor }): string | null`
  - `canReplant(planting: PlantingOut, plantable: PlantableOut | undefined, today: GameDateIn): boolean`
  - `replantBody(planting: PlantingOut, today: GameDateIn): PlantingIn` (`anchor: 'planted'`, `plantedOn: today`, `lastHarvestOn: null`, all other fields copied)
  - `toPlantingIn(planting: PlantingOut): PlantingIn` (strips `id`, `schedule`)
  - `summarizeSchedule(schedule: ScheduleOut): string`
  - `isActionable(planting: PlantingOut): boolean` (status `ready`)
- Produces (`ItemDrawer.tsx`): `ItemDrawer({ open, title, onClose, footer, children }: { open: boolean; title: string; onClose: () => void; footer: ReactNode; children: ReactNode })`.

- [ ] **Step 1: Write failing tests** in `plantings.spec.ts` (use `PLANTABLES` from `components/testData.ts`):
  - `plantingIssue` returns `'Fora da estação na Fazenda — use Estufa ou Ilha'` for `test-melon-seeds` on `spring`/`farm`/`planted`; `null` for the same on `greenhouse`; `null` for `test-sapling` on the farm in any season; `'Só cultivos que rebrotam podem partir de uma colheita'` for `test-flower-seeds` with `anchor: 'harvested'`; `'Escolha uma semente ou muda'` for `undefined`.
  - `canReplant` is `false` for a regrowing crop (`test-berry-seeds`) and for `test-melon-seeds` on the farm in spring; `true` for `test-flower-seeds` on the farm in spring.
  - `replantBody` of a harvested-anchor planting returns `anchor: 'planted'`, `plantedOn: today`, `lastHarvestOn: null`, same `seedId`, `location`, `quantity`, `fertilizer`.
  - `summarizeSchedule`: `firstHarvest` Spring 20 Y1 + `totalHarvests: 4` → `'Pronto em Primavera 20, Ano 1 · 4 colheitas'`; `totalHarvests: 1` → `'… · 1 colheita'`; `infinite: true` → `'Pronto em Primavera 20, Ano 1 · colheitas sem fim'`; `firstHarvest: null` → `'Não amadurece antes do fim da estação'`.
- [ ] **Step 2: Write failing tests** in `ItemDrawer.spec.tsx`: renders `title` as the dialog name (`getByRole('dialog', { name: 'Adicionar plantio' })`), renders `footer`, calls `onClose` on the icon-only button `{ name: 'Fechar' }` and on `Escape`; nothing rendered when `open` is false.
- [ ] **Step 3: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- plantings ItemDrawer` → FAIL (modules not found).
- [ ] **Step 4: Implement** `lib/plantings.ts` (season rule same as `filterPlantables`; reuse `formatGameDate`) and `ItemDrawer` adapted from `overlays/drawers/05-with-sticky-footer.jsx` (Headless UI `Dialog`; `max-w-md` panel, `w-screen` on small screens; scrolling body; sticky footer slot; close `XMarkIcon` with `aria-label`/`title` "Fechar").
- [ ] **Step 5: Run** the same command → PASS.
- [ ] **Step 6: Commit** `feat(stardew-valley-website): add planting helpers and item drawer`

### Task A3: Planting form rewrite and PlantingDrawer

**Files:**
- Modify: `packages/stardew-valley/website/src/components/PlantingForm.tsx`, `PlantingForm.spec.tsx`
- Create: `packages/stardew-valley/website/src/components/PlantingDrawer.tsx`, `PlantingDrawer.spec.tsx`
- Create: `packages/stardew-valley/website/src/hooks/useDraftSchedule.ts`
- Delete: `packages/stardew-valley/website/src/components/form/ModeRadio.tsx` (only if no other importer remains)

**Interfaces:**
- Consumes: `plantingIssue`, `summarizeSchedule` (A2), `ItemDrawer` (A2), `useNotifications().notifyError` (A1), existing `useCreatePlanting`, `useUpdatePlanting`, `useSchedulePreview`, `usePlantables`, `useFertilizers`.
- Produces:
  - `PlantingForm` keeps its props (`today`, `plantables`, `fertilizers`, `initial?`, `onSubmit`, `onDraftChange?`) minus `submitting`, plus `formId: string`; it renders no submit button (the drawer footer submits with `form={formId}`).
  - `useDraftSchedule(draft: PlantingDraft | null, profile: ProfileOut | undefined): { schedule: ScheduleOut | null; loading: boolean }` (the 300 ms debounce moved out of `routes/index.tsx`).
  - `PlantingDrawer({ open, editing, profile, onClose }: { open: boolean; editing: PlantingOut | null; profile: ProfileOut; onClose: () => void })`; title `'Editar plantio'` when `editing`, else `'Adicionar plantio'`; closes on save success.

- [ ] **Step 1: Rewrite `PlantingForm.spec.tsx`** keeping the existing snapped-value tests (adapted: the submit happens via `form.requestSubmit()` or a test-only external submit button with `form={formId}`), and adding:
  - `should list all plantables including out-of-season ones with a badge` — with today Spring 1, options include `Sementes de Melão` with text `Fora da estação`.
  - `should keep the seed when the location changes` — pick `Sementes de Fruta`, change location to Estufa, the combobox still shows `Sementes de Fruta`.
  - `should show the inline issue and emit a null draft for an out-of-season seed` — pick `Sementes de Melão` on Fazenda: `getByText('Fora da estação na Fazenda — use Estufa ou Ilha')`, last `onDraftChange` call is `null`; switch to Estufa → draft non-null.
  - `should default the date to today and reveal the fields on Outra data` — text `Hoje (Primavera 1, Ano 1)`; no `Dia` field until clicking `Outra data`.
  - `should hide fertilizer and nickname behind Mais opções`.
  - `should enable the harvest toggle only for regrowing crops` — toggle `Sei só a data de uma colheita` disabled with `Flower Seeds` (`test-flower-seeds`, no `ptBr`), enabled with `Sementes de Fruta`; when on, legend `Data da colheita` and no `Fertilizante`.
- [ ] **Step 2: Write `PlantingDrawer.spec.tsx`** (mock the hooks module like existing page specs do): Save button `{ name: 'Salvar' }` disabled while draft is null; footer shows `summarizeSchedule` text once the preview resolves; Save calls create with the draft and `onClose`; with `editing` it calls update with `plantingId: editing.id`.
- [ ] **Step 3: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- PlantingForm PlantingDrawer` → FAIL.
- [ ] **Step 4: Implement** the form in spec §7.3 order: `Combobox` over all `plantables` (secondary = `describePlantable` + `' · Fora da estação'` when `plantingIssue` for farm/planted is non-null); "Hoje (<formatGameDate(today)>)" + text button "Outra data" revealing `GameDateFields`; `LocationRadio`; `NumberStepper` (`Quantidade`, 1–999); Headless UI `Disclosure` "Mais opções" with `SelectMenu` Fertilizante, `Toggle` "Sei só a data de uma colheita" (description "Para cultivos que rebrotam", disabled unless selected plantable has `regrowDays`), Apelido input. Remove the `useEffect` that cleared `seedId`. Draft is `null` whenever `plantingIssue(...)` is non-null; the issue is shown under the combobox (`text-sm text-red-600 dark:text-red-400`, `aria-describedby`). Drawer footer: summary line (or "Escolha uma semente para ver a previsão"), "Ver detalhes" `Disclosure` with the existing `SchedulePreview`, "Cancelar" and "Salvar" (`type="submit" form={formId}`).
- [ ] **Step 5: Run** the same command → PASS; then the full website `test` target → PASS (fix `routes/index.spec.tsx` imports only if it broke; the page itself changes in A5).
- [ ] **Step 6: Commit** `feat(stardew-valley-website): simplify planting form inside a drawer`

### Task A4: TodayBar (date bar)

**Files:**
- Create: `packages/stardew-valley/website/src/components/TodayBar.tsx`, `TodayBar.spec.tsx`
- Delete: `packages/stardew-valley/website/src/components/GameDatePanel.tsx` and its spec once A5 stops using it (do it in A5).

**Interfaces:**
- Consumes: `shiftDay`, `MAX_YEAR` from `lib/gameDate.ts`; `GameDateFields`, `Toggle`.
- Produces: `TodayBar({ profile, saving, onSave }: { profile: ProfileOut; saving?: boolean; onSave: (profile: ProfileIn) => void })`.

- [ ] **Step 1: Write failing tests**: shows `Primavera 12 · Ano 2` for that profile; `Avançar dia` calls `onSave` with Spring 13 and the same `agriculturist`; icon-only `{ name: 'Dia anterior' }` calls Spring 11 and is disabled on Spring 1, Year 1; Winter 28 Year 1 → Spring 1 Year 2; `Avançar dia` disabled on Winter 28 of `MAX_YEAR`; `Alterar` reveals `GameDateFields` + `Toggle` "Profissão Agricultor" and a `Salvar` button that calls `onSave` with the edited values.
- [ ] **Step 2: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- TodayBar` → FAIL.
- [ ] **Step 3: Implement** a card (same `CARD` classes as the home) with date text, `ChevronLeftIcon` icon button (`aria-label`/`title` "Dia anterior"), primary "Avançar dia" button, and a Headless UI `Disclosure` "Alterar" holding the former `GameDatePanel` content. Disable both day buttons while `saving`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add today bar with day stepping`

### Task A5: Home "Hoje", `/plantios` and navigation

**Files:**
- Create: `packages/stardew-valley/website/src/components/TodayList.tsx`, `TodayList.spec.tsx`
- Create: `packages/stardew-valley/website/src/hooks/usePlantingActions.ts`
- Create: `packages/stardew-valley/website/src/routes/plantios.tsx`, `routes/plantios.spec.tsx`
- Modify: `packages/stardew-valley/website/src/routes/index.tsx`, `routes/index.spec.tsx`, `components/AppShell/index.tsx` (+ spec), `components/PlantingList.tsx` (+ spec), `components/EmptyPlantings.tsx`, `components/MyPlantings.tsx`, `routeTree.gen.ts` (regenerated by the router plugin during build/dev; commit it)
- Delete: `components/GameDatePanel.tsx`, `components/GameDatePanel.spec.tsx` (`SchedulePreview` stays; the drawer uses it).

**Interfaces:**
- Consumes: A1–A4, `canReplant`, `replantBody`, `toPlantingIn`, `isActionable`.
- Produces:
  - `usePlantingActions(): { replant(planting: PlantingOut): void; remove(planting: PlantingOut): void }` — optimistic via the existing mutations; on success `notifyUndo('Plantio replantado' | 'Plantio removido', undo)` where undo is `update(previous toPlantingIn)` / `create(toPlantingIn(previous))`; on error `notifyError(apiErrorMessage(error))`.
  - `TodayList({ plantings, plantables, names, today, onAddPlanting }: …)` with a `machines` slot added in B8 (keep the list built from a `TodayEntry[]` union so B8 only adds a second group).
  - `PlantingList` gains `onReplant(planting)` and `canReplant(planting): boolean` props; its actions menu shows Editar · Replantar (hidden when `!canReplant`) · Remover. `EmptyPlantings` gains optional `action?: { label: string; onClick: () => void }` and its default description becomes `'Adicione sua primeira semente.'`.
  - `NAVIGATION` = Hoje `/` · Plantios `/plantios` · Sementes · Calendário · Eventos (Máquinas added in B7).

- [ ] **Step 1: Write failing tests**
  - `TodayList.spec.tsx`: lists only `status: 'ready'` plantings under heading `Plantios`; a ready non-regrowing in-season planting has text buttons `Replantar` and icon button `{ name: 'Remover' }`; a ready regrowing planting has no action buttons; with nothing ready shows `Nada para coletar hoje` and `Próximo: <name> em 2 dias` (smallest `daysUntilNext` among `growing`/`regrowing`).
  - `routes/index.spec.tsx` (rewrite): renders `TodayBar`, `Para fazer hoje`, `UpcomingEvents`; button `Adicionar plantio` opens the dialog `Adicionar plantio`; no planting form is in the page before clicking.
  - `routes/plantios.spec.tsx`: heading `Plantios`, location tabs, list, calendar; `Adicionar plantio` opens the drawer; actions menu `Editar` opens `Editar plantio` pre-filled.
  - `AppShell.spec.tsx`: nav links `Hoje`, `Plantios`, `Sementes`, `Calendário`, `Eventos` in that order.
  - Undo flow (in `TodayList.spec.tsx` with mocked mutations): `Remover` calls delete, then `Desfazer` calls create with the removed planting's fields; a failing delete calls `notifyError`.
- [ ] **Step 2: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test` → the new tests FAIL.
- [ ] **Step 3: Implement** home (`TodayBar` → `TodayList` card "Para fazer hoje" → `UpcomingEvents` → shortcut button "Adicionar plantio" + `PlantingDrawer`), `/plantios` (heading + "Adicionar plantio" + `MyPlantings` + `PlantingDrawer`, edit wiring), updated `PlantingList`/`EmptyPlantings`/nav. `TodayList` rows adapt `lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx` with `LOCATION_LABELS` badge and quantity.
- [ ] **Step 4: Run** `pnpm nx run-many -t build -p @aws-danhenrique/stardew-valley-helper-website` → PASS (lint, typecheck, tests).
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add today home and move plantings to /plantios`

**Phase A checkpoint:** run the full build of the three projects (Global Constraints) and `pnpm nx dev @aws-danhenrique/stardew-valley-helper-website` for a manual pass of the success criteria in spec §1 (first three bullets), in light and dark themes.

---

## Phase B — Machines

**Before starting Phase B:** ask the user to confirm the Cask fractions (silver ¼, gold ½, iridium 1) and `APPROXIMATE_OUTPUTS` (Keg `beer`, `pale-ale`; Oil Maker `oil`) — spec §4.

### Task B1: Importer corrections

**Files:**
- Create: `packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/importer/corrections.py`, `packages/stardew-valley/db/tests/test_corrections.py`
- Modify: `packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/importer/cli.py`
- Create fixtures: `packages/stardew-valley/db/tests/fixtures/data/maquinas/{keg,bee-house,cask,tapper}.json`

**Interfaces:**
- Produces: `AGING_OUTPUTS: frozenset[str] = {"wine", "pale-ale", "beer", "mead", "cheese", "goat-cheese"}`; `apply_corrections(dataset: dict[str, list[dict]]) -> tuple[dict[str, list[dict]], list[dict[str, str]]]` returning a corrected deep copy and one `{"machine": ..., "output": ..., "action": "moved-to-cask"}` per moved entry.
- Fixtures (fictitious values, real machine ids): `keg` → `test-wine` 7, `beer` 2; `bee-house` → `honey` 4, `wine` 56, `cheese` 14; `cask` → no `processing`; `tapper` → `test-syrup` 9. Names `{en, pt-BR}` like `test-keg.json`; `category: "artisan"`/`"refining"`.

- [ ] **Step 1: Write failing tests** `test_corrections.py`:
  - `test_should_move_aging_entries_from_bee_house_to_cask` — bee-house `processing` outputs == `["honey"]`; cask has `wine` 56 and `cheese` 14, each with `"kind": "aging"`; two log entries returned.
  - `test_should_not_change_already_correct_dataset` — feeding the output back returns an equal dataset and `[]`.
  - `test_should_not_mutate_the_input`.
  - `test_should_import_cask_produces_relations` (in `test_import_cli.py` style, against moto) — after `main(["--data-dir", fixtures])`, `Produces` under `ITEM#cask` exists for `wine`; none for `ITEM#bee-house` → `wine`.
- [ ] **Step 2: Run** `pnpm nx run aws_danhenrique.stardew_valley_db:test` → FAIL.
- [ ] **Step 3: Implement** `apply_corrections` and call it in `cli.main` between `load_dataset` and `convert_dataset`; log each correction with `logger.info("Dataset correction applied", extra=correction)`.
- [ ] **Step 4: Run** the db `test` target → PASS. Update any existing count assertions that change because of the new fixtures (only counts; no behavior changes).
- [ ] **Step 5: Commit** `feat(stardew-valley-db): correct bee house and cask processing on import`

### Task B2: MachineBatch entity

**Files:**
- Modify: `packages/stardew-valley/db/aws_danhenrique_stardew_valley_db/entities/player.py`, `entities/__init__.py`
- Test: `packages/stardew-valley/db/tests/test_player.py`

**Interfaces:**
- Produces:
  - `MACHINE_PREFIX = "MACHINE#"`
  - `class MachineBatch(BaseModel, discriminator="MachineBatch")` with `machine_id` (`machineId`), `output_id` (`outputId`), `started_on: GameDateAttribute` (`startedOn`), `quantity` (default 1), `start_quality` (`startQuality`, null), `location` (default `"farm"`), `label` (null), `created_at` (`createdAt`); `machine_batch_id` property; `new(player_id, **fields)`; `key(player_id, machine_batch_id)`.
  - `@dataclass PlayerRecords(profile: PlayerProfile | None, plantings: list[Planting], machines: list[MachineBatch])` and `player_records(player_id: str) -> PlayerRecords` (one query). `Planting.list_for_player` stays for compatibility.

- [ ] **Step 1: Write failing tests**: `MachineBatch.new("p1", machine_id="keg", output_id="test-wine", started_on=..., quantity=3)` saves with `sk` starting `MACHINE#`; `player_records("p1")` returns profile, one planting and one machine; a player without machines returns `machines == []`; another player's rows are not returned.
- [ ] **Step 2: Run** `pnpm nx run aws_danhenrique.stardew_valley_db:test -- -k player` → FAIL.
- [ ] **Step 3: Implement** following `Planting`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-db): add machine batch player entity`

### Task B3: Machine schedule rules

**Files:**
- Create: `packages/stardew-valley/api/stardew_valley_api/machine_schedule.py`, `packages/stardew-valley/api/tests/test_machine_schedule.py`

**Interfaces:**
- Consumes: `GameDate`, `Location`, `DAYS_PER_SEASON`, `SEASONS` from `schedule.py`.
- Produces:
  - `MachineKind = Literal["batch", "continuous", "aging"]`; `Quality = Literal["normal", "silver", "gold", "iridium"]`; `StartQuality = Literal["normal", "silver", "gold"]`; `MachineStatus = Literal["processing", "ready", "aging", "iridium"]`.
  - `MACHINE_KINDS: dict[str, MachineKind]` = `keg`, `preserves-jar`, `oil-maker` → batch; `tapper`, `heavy-tapper`, `crystalarium`, `bee-house` → continuous; `cask` → aging.
  - `APPROXIMATE_OUTPUTS: frozenset[tuple[str, str]] = {("keg", "beer"), ("keg", "pale-ale"), ("oil-maker", "oil")}`; `QUALITY_FRACTION = {"normal": Fraction(0), "silver": Fraction(1, 4), "gold": Fraction(1, 2), "iridium": Fraction(1)}`; `COLLECTION_LIMIT = 10`.
  - `@dataclass(frozen=True) MachineSchedule(ready_on: GameDate | None, collections: list[GameDate], milestones: list[tuple[Quality, GameDate]], infinite: bool, status: MachineStatus, days_until_next: int | None, approximate: bool, warnings: list[str])`.
  - `batch_schedule(days: int, started_on: GameDate, today: GameDate) -> MachineSchedule`
  - `continuous_schedule(days: int, started_on: GameDate, today: GameDate, *, pauses_in_winter: bool) -> MachineSchedule`
  - `aging_schedule(total_days: int, start_quality: StartQuality, started_on: GameDate, today: GameDate) -> MachineSchedule`
  - `machine_schedule(machine_id: str, output_id: str, days: int, started_on: GameDate, location: Location, start_quality: StartQuality | None, today: GameDate) -> MachineSchedule` — dispatches by `MACHINE_KINDS`, sets `approximate`, `pauses_in_winter = machine_id == "bee-house" and location == "farm"`; raises `InvalidMachineInputError(ValueError)` with messages `"Unknown machine"`, `"Start quality only applies to the cask"`, `"Bee house can only be on the farm or Ginger Island"`.

- [ ] **Step 1: Write failing tests** (dates as `GameDate(year, season, day)`):
  - `test_batch_keg_wine_is_ready_after_seven_days` — start Spring 1, today Spring 3 → `ready_on` Spring 8, `status "processing"`, `days_until_next 5`; today Spring 10 → `status "ready"`, `days_until_next 0`.
  - `test_continuous_returns_ten_collections_and_is_infinite` — tapper 9 days, start Spring 1, today Spring 1 → first Spring 10, 10 dates, `infinite True`; today Spring 10 → `status "ready"`.
  - `test_bee_house_skips_winter_on_the_farm` — start Winter 26 Y1, 4 days → collections start `Spring 1 Y2`, then `Spring 5 Y2`; start Fall 26 Y1 (+4 = Winter 2) → first `Spring 1 Y2`.
  - `test_bee_house_on_ginger_island_produces_in_winter` — start Winter 1 → first Winter 5.
  - `test_cask_wine_from_normal` — start Spring 1 Y1 → silver Spring 15, gold Summer 1, iridium Fall 1 (+14/+28/+56); `test_cask_wine_from_silver` → only gold (+14) and iridium (+42).
  - `test_cask_pale_ale_rounds_up` — 34 days from normal → +9, +17, +34; from silver → +9, +26.
  - `test_cask_status` — before iridium `status "aging"`, `days_until_next` = days to the next milestone; on/after iridium `status "iridium"`, `days_until_next None`.
  - `test_approximate_outputs` — keg beer `approximate True`, keg wine `False`.
  - `test_invalid_inputs` — unknown machine, `start_quality="silver"` on keg, bee-house on `greenhouse` → `InvalidMachineInputError`.
- [ ] **Step 2: Run** `pnpm nx run aws_danhenrique.stardew_valley_api:test -- tests/test_machine_schedule.py` → FAIL (module not found).
- [ ] **Step 3: Implement.** Bee-house winter rule, the one non-obvious algorithm:

```python
def _next_collection(prev_abs: int, days: int, pauses_in_winter: bool) -> int:
    nxt = prev_abs + days
    if pauses_in_winter and GameDate.from_abs(nxt).season == "winter":
        year = GameDate.from_abs(nxt).year
        nxt = GameDate(year + 1, "spring", 1).to_abs()
    return nxt
```

  Collections are generated from `started_on` with `_next_collection` until 10 dates `>= today` are collected. Aging milestone days use `math.ceil(total_days * (QUALITY_FRACTION[q] - QUALITY_FRACTION[start]))`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-api): add machine schedule rules`

### Task B4: Machine catalog and preview routes

**Files:**
- Create: `packages/stardew-valley/api/stardew_valley_api/machine_service.py`, `packages/stardew-valley/api/stardew_valley_api/routes/machines.py`, `packages/stardew-valley/api/tests/test_machine_routes.py`
- Modify: `packages/stardew-valley/api/stardew_valley_api/models.py`, `routes/__init__.py` (register the module like the others)

**Interfaces:**
- Consumes: B3; `Item`, `list_folder`, `rule_error`, `game_date`, `_name`-style localization (move `_name` from `routes/game.py` to `game_data.py` as `localized_name(model) -> LocalizedTextOut | None` and import it in both).
- Produces (models, all `CamelModel`):
  - `MachineOutputOut(id: str, name: LocalizedTextOut | None, days: int, approximate: bool)`
  - `MachineOut(id: str, name: LocalizedTextOut | None, kind: MachineKind, outputs: list[MachineOutputOut])`
  - `MachineBatchIn(machine_id: str (1–80), output_id: str (1–80), started_on: GameDateIn, quantity: int = 1 (1–999), start_quality: StartQuality | None = None, location: Location = "farm", label: str | None (≤60))`; validator: `start_quality` required when `machine_id == "cask"` (`"Cask requires startQuality"`).
  - `MilestoneOut(quality: Quality, on: GameDateOut)`
  - `MachineScheduleOut(ready_on: GameDateOut | None, collections: list[GameDateOut], milestones: list[MilestoneOut], infinite: bool, status: MachineStatus, days_until_next: int | None, approximate: bool, warnings: list[str])`
  - `MachineSchedulePreviewIn(MachineBatchIn)` + `today: GameDateIn`
  - Service: `list_machines() -> list[MachineOut]` (folder `maquinas`, only ids in `MACHINE_KINDS`, outputs from corrected `processing`, output `name` = the step `label`); `machine_batch_schedule(body: MachineBatchIn, today: GameDateIn) -> MachineScheduleOut` (404 `"Machine not found"`; 422 via `rule_error("Output does not belong to this machine")` and for `InvalidMachineInputError` messages).
  - Routes: `GET /machines` → `list_machines`; `POST /machine-schedule` (`responses=NOT_FOUND_RESPONSE`) → `preview_machine_schedule`.

- [ ] **Step 1: Write failing tests** (`seeded` fixtures from B1): `GET /machines` returns ids `{"keg", "bee-house", "cask", "tapper"}` (not `test-keg`), bee-house outputs `["honey"]`, cask kind `"aging"`, keg `beer` `approximate True`; preview keg `test-wine` from Spring 1 with today Spring 1 → `readyOn` Spring 8; preview with `outputId: "honey"` on keg → 422; unknown machine → 404; cask without `startQuality` → 422; cask `wine` normal → three milestones.
- [ ] **Step 2: Run** `pnpm nx run aws_danhenrique.stardew_valley_api:test -- tests/test_machine_routes.py` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the api `test` target → PASS (including existing game route tests after the `_name` move).
- [ ] **Step 5: Commit** `feat(stardew-valley-api): add machine catalog and schedule preview`

### Task B5: Player machine routes

**Files:**
- Modify: `packages/stardew-valley/api/stardew_valley_api/routes/player.py`, `models.py`
- Create: `packages/stardew-valley/api/tests/test_player_machine_routes.py`

**Interfaces:**
- Consumes: B2 `MachineBatch`, `player_records`; B4 `machine_batch_schedule`, models.
- Produces: `MachineBatchOut(MachineBatchIn)` + `id: str`, `schedule: MachineScheduleOut`; `MeOut.machines: list[MachineBatchOut] = []`; routes `POST /me/machines` (201), `PUT /me/machines/{machine_batch_id}`, `DELETE /me/machines/{machine_batch_id}` (204), all with `NOT_FOUND_RESPONSE`; 404 detail `"Machine batch not found"`. `get_me` uses `player_records`.

- [ ] **Step 1: Write failing tests** (`client_as`): new player `/me` has `machines == []`; create keg batch → 201 with `schedule.readyOn`; listed in `/me`; update `startedOn` changes `readyOn`; delete → 204 then 404 on update; player `p2` cannot update or delete `p1`'s batch (404); invalid output → 422 and nothing saved.
- [ ] **Step 2: Run** `pnpm nx run aws_danhenrique.stardew_valley_api:test -- tests/test_player_machine_routes.py` → FAIL.
- [ ] **Step 3: Implement** mirroring the planting routes (validate via `machine_batch_schedule` before saving; schedule computed with `profile.current_date`).
- [ ] **Step 4: Run** `pnpm nx run-many -t build -p aws_danhenrique.stardew_valley_api` → PASS; this also regenerates the OpenAPI spec and `operations.json` (verify the 5 new operations are listed in `packages/common/terraform/src/generated/stardew-valley-api/operations.json` if that file is produced by the build; do not edit `.tf`).
- [ ] **Step 5: Commit** `feat(stardew-valley-api): add player machine batch routes`

### Task B6: Website machine data layer

**Files:**
- Modify: `packages/stardew-valley/website/src/generated/stardew-valley-api/*` (regenerated), `hooks/useGameData.ts`, `lib/i18n.ts`
- Create: `packages/stardew-valley/website/src/lib/machines.ts`, `lib/machines.spec.ts`; extend `components/testData.ts` with `MACHINES: MachineOut[]` and a `machineBatch(overrides)` factory.

**Interfaces:**
- Consumes: generated `MachineOut`, `MachineBatchIn`, `MachineBatchOut`, `MachineScheduleOut`, `Quality`, `MachineStatus` and client ops `listMachines`, `previewMachineSchedule`, `createMachineBatch`, `updateMachineBatch`, `deleteMachineBatch`.
- Produces:
  - Hooks: `useMachines()` (`staleTime: Infinity`), `useCreateMachineBatch()`, `useUpdateMachineBatch()`, `useDeleteMachineBatch()` (invalidate `/me`), `useMachineSchedulePreview()`.
  - i18n: `QUALITY_LABELS = { normal: 'Normal', silver: 'Prata', gold: 'Ouro', iridium: 'Irídio' }`, `MACHINE_STATUS_LABELS = { processing: 'Processando', ready: 'Pronto', aging: 'Envelhecendo', iridium: 'Irídio' }`.
  - `lib/machines.ts`: `MachineDraft` type (= `MachineBatchIn` with required fields); `machineIssue(machine: MachineOut | undefined, outputId: string | null): string | null` (`'Escolha uma máquina'`, `'Escolha um produto desta máquina'`); `summarizeMachineSchedule(kind: MachineKind, schedule: MachineScheduleOut): string` → `'Pronto em Verão 3, Ano 1'`, `'Coleta a cada 4 dias · próxima Verão 3, Ano 1'`, `'Prata Verão 5, Ano 1 · Ouro Verão 19, Ano 1 · Irídio Outono 19, Ano 1'`; `machineDates(batch: MachineBatchOut): { date: GameDateIn; label: string }[]` (batch → ready; continuous → collections; aging → each milestone `'<Qualidade>'`); `isMachineActionable(batch)` (status `ready` or `iridium`); `recollectBody(batch, today): MachineBatchIn`; `toMachineBatchIn(batch)`.

- [ ] **Step 1: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:generate:stardew-valley-api-client` and confirm the new types and ops exist in `types.gen.ts` / `options-proxy.gen.ts` (adjust the names above if the generator names them differently, and use the generated names everywhere after).
- [ ] **Step 2: Write failing tests** `lib/machines.spec.ts` for each function above with the exact strings listed, and for `machineDates` of a continuous batch returning its 10 collections.
- [ ] **Step 3: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- machines` → FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** `feat(stardew-valley-website): add machine data hooks and helpers`

### Task B7: Machine form, drawer and `/maquinas`

**Files:**
- Create: `packages/stardew-valley/website/src/components/MachineForm.tsx` (+ spec), `MachineDrawer.tsx` (+ spec), `MachineList.tsx` (+ spec), `MachineCalendar.tsx`, `hooks/useMachineActions.ts`, `routes/maquinas.tsx` (+ spec)
- Modify: `components/AppShell/index.tsx` (+ spec) — insert `Máquinas` `/maquinas` after `Plantios`.

**Interfaces:**
- Consumes: B6, `ItemDrawer`, `NumberStepper`, `SelectMenu`, `GameDateFields`, `notifyUndo`.
- Produces: `MachineForm({ today, machines, initial?, formId, onDraftChange, onSubmit })`; `MachineDrawer({ open, editing: MachineBatchOut | null, profile, onClose })`; `useMachineActions(): { recollect(batch): void; remove(batch): void }` (undo like A5; messages `'Máquina recolocada'`, `'Máquina esvaziada'`); `MachineList({ batches, machines, onEdit, onRecollect, onRemove })`; `MachineCalendar({ batches, machines, today })` (same grid/props pattern as `HarvestCalendar`, markers from `machineDates`).

- [ ] **Step 1: Write failing tests**
  - `MachineForm`: fields in order Máquina, Produto, Início, Quantidade de máquinas; `Qualidade inicial` only after choosing the cask (default `Normal`); `Local` (Fazenda · Ilha Gengibre) only for the bee house; bee house shows `Mel` as text, no product select; switching keg → preserves jar keeps quantity and start date and shows `Escolha um produto desta máquina`, draft `null`; option secondary text `7 dias` and `2 dias · aprox.` for approximate.
  - `MachineDrawer`: titles `Adicionar máquina` / `Editar máquina`; footer shows `summarizeMachineSchedule` text after preview; Save calls create/update.
  - `MachineList`: tabs `Todas`, `Prontas`, `Em andamento` with counts; row text `Barril → Vinho`, quantity, status badge from `MACHINE_STATUS_LABELS`; menu Editar · Recolocar (batch kind only) · Esvaziar.
  - `routes/maquinas.spec.tsx`: heading `Máquinas`, `Adicionar máquina` opens drawer, empty state with button opening drawer.
  - `AppShell.spec.tsx`: nav order Hoje, Plantios, Máquinas, Sementes, Calendário, Eventos.
- [ ] **Step 2: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- Machine maquinas AppShell` → FAIL.
- [ ] **Step 3: Implement** per spec §8.1–8.2 (tabs from `navigation/tabs/08-tabs-with-underline-and-badges.jsx`, list from `lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx`, empty state from `feedback/empty-states/02-with-dashed-border.jsx`, calendar like `HarvestCalendar`). The preview uses a `useDraftMachineSchedule` debounce identical to `useDraftSchedule` (300 ms) — put both on a shared `useDebouncedPreview` helper in `hooks/useDraftSchedule.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add machines page and drawer`

### Task B8: Home, upcoming list and calendar integration

**Files:**
- Modify: `components/TodayList.tsx` (+ spec), `routes/index.tsx` (+ spec), `components/UpcomingEvents.tsx` (+ spec), `components/EventCalendar.tsx` (+ spec), `routes/calendario.tsx`, `lib/i18n.ts`

**Interfaces:**
- Consumes: B6 `machineDates`, `isMachineActionable`, B7 `useMachineActions`, `MachineDrawer`.
- Produces: `TodayList` gains `machines: readonly MachineBatchOut[]` and `machineCatalog: MachineOut[]`; `UpcomingEvents` and `EventCalendar` gain `machines?: readonly MachineBatchOut[]` and `machineCatalog?: MachineOut[]` (optional, so existing callers compile). New marker kinds `'machine'` (icon `BeakerIcon`, screen-reader label `'Máquina'`) and `'caskMilestone'` (icon `StarIcon`, label `'Barril de Madeira'`).

- [ ] **Step 1: Write failing tests**
  - `TodayList`: group heading `Máquinas` lists ready/iridium batches; batch keg ready → `Recolocar`, `Trocar produto`, icon `{ name: 'Esvaziar' }`; continuous ready → no actions; cask iridium → icon `{ name: 'Retirar' }`; `Trocar produto` opens `Editar máquina` pre-filled.
  - `UpcomingEvents`: a keg ready in 2 days shows `Barril · Vinho` with the machine screen-reader kind; items within 7 days only (spec §7.2 "Próximos 7 dias").
  - `EventCalendar`: a day with a cask silver milestone shows the `Barril de Madeira` marker.
  - Home: `Adicionar máquina` opens `Adicionar máquina`.
- [ ] **Step 2: Run** the website `test` target → the new tests FAIL.
- [ ] **Step 3: Implement.** In `UpcomingEvents`, machine entries are merged into the existing sorted list (same `dateLabel` rules) and limited to dates within 7 days of today.
- [ ] **Step 4: Run** `pnpm nx run-many -t build -p aws_danhenrique.stardew_valley_db aws_danhenrique.stardew_valley_api @aws-danhenrique/stardew-valley-helper-website` → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show machines on home, upcoming list and calendar`

**Phase B checkpoint:** `pnpm nx dev @aws-danhenrique/stardew-valley-helper-website` manual pass of spec §1 success criteria (all bullets), light and dark themes. Deploy (`stardew-valley-infra:plan`/`apply`) and re-import (`stardew_valley_db:import`) only after explicit user confirmation; the plan will show 5 new Lambdas and their API Gateway resources.
