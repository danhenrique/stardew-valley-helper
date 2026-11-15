# Stardew Helper game icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy every scheduler image into the Stardew website and show each game entity with its in-game icon next to its name.

**Architecture:** A hand-run Python script copies the scheduler's `public/icons` into `website/public/icons/<id>.png` (renamed to data ids) plus `ui/` for the rest, and writes `manifest.json`. The website resolves icons by id through `lib/icons.ts` and renders them with one `GameIcon` component (Heroicons `PhotoIcon` fallback). No backend or infra change.

**Tech Stack:** Python 3 standard library + pytest (workspace uv env), React 19 + Tailwind + Heroicons, Vitest + Testing Library, Nx.

**Spec:** `docs/superpowers/specs/2026-11-10-stardew-game-icons-design.md`

## Global Constraints

- Code, docs, commits in English; UI labels in pt-BR.
- Tailwind utility classes only (pixel scaling: `[image-rendering:pixelated]`); no custom CSS.
- Icons for actions stay Heroicons; fallback icon is `PhotoIcon` from `@heroicons/react/20/solid`.
- Sizes: `sm` = `size-4` (16 px), `md` = `size-6` (24 px, default), `lg` = `size-12` (48 px).
- Base URL lives only in `src/lib/icons.ts` (`import.meta.env.BASE_URL`).
- Footer credit (exact): "Stardew Valley © ConcernedApe. Imagens usadas sem fins comerciais."
- Script: `python3 -I`, standard library only, deterministic output.
- Run website tasks through Nx: `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- <filter>`.
- Commits end with the session's Co-Authored-By / Claude-Session lines. Never stage `.claude/`.

## Review Focus

- A sprite path or id containing characters that are unsafe in a URL (e.g. `'`, spaces) → normalized ids never contain them; Task 1 tests apostrophes/spaces (`Joja_Cola's` style names).
- Non-PNG sources (`event/festival.gif`, `ui/achievement.jpg`, `ui/paypal.svg`) → never written as `<id>.png`; they go to `ui/` keeping their extension (Task 1 test).
- The same id in several source folders (`gifts` + `museum`, `fish` + `perfection/fish`, …) → the fixed folder order picks the item sprite, not the perfection/collection one (Task 1 test).
- An entity id that is in the data but has no image (achievements, bundles) → the row still shows a same-size `PhotoIcon`, no broken `<img>` request (Task 3 test).
- A stale `manifest.json` listing an id whose file was removed → integrity test fails the build (Task 3).

---

### Task 1: `sync-icons.py` script

**Files:**
- Create: `packages/stardew-valley/website/scripts/sync_icons.py`
- Create: `packages/stardew-valley/website/scripts/icon-overrides.json` (`{}`)
- Create: `packages/stardew-valley/website/scripts/ICONS_NOTICE.txt` (copied to `public/icons/NOTICE.txt`)
- Test: `packages/stardew-valley/website/scripts/tests/test_sync_icons.py`

(The spec names the script `sync-icons.py`; use `sync_icons.py` so pytest can import it. Update the spec's mention in the same commit.)

**Interfaces:**
- Produces:
  - `normalize(name: str) -> str` — split `([a-z0-9])([A-Z])` with `-`, lowercase, runs of `[^a-z0-9]` → `-`, strip `-`.
  - `squash(name: str) -> str` — lowercase, drop every `[^a-z0-9]`.
  - `FOLDER_ORDER: list[str]` = `["villagers", "shops", "festival", "movies", "snacks", "reminders", "machines", "buildings", "tools", "fish", "gifts", "food", "seeds", "materials", "machineOutputs", "bundleItems", "costMaterials", "museum", "fruitTrees/saplings", "fruitTrees", "fertilizer", "profitFertilizer", "fieldOffice", "addTask", "event", "ui"]`; any folder not listed (e.g. `perfection/*`) sorts after, alphabetically.
  - `sync(source: Path, index: Path, overrides: Path, dest: Path) -> Report` where `Report` is a dataclass with `missing: dict[str, list[str]]` (data folder → ids without image) and `ui_files: list[str]` (dest-relative paths).
  - CLI: `python3 -I scripts/sync_icons.py <source-icons-dir> <index.json>` writes to `packages/stardew-valley/website/public/icons` (resolved from the script's location) and prints the report.
  - Output: `dest/<id>.png`, `dest/ui/<name>.<ext>`, `dest/manifest.json` (sorted JSON array of ids, 2-space indent, trailing newline), `dest/NOTICE.txt`.

- [ ] **Step 1: Write the failing tests** (fixture builds tiny files in `tmp_path`; byte content can be the source path so tests can tell which file won)
  - `test_normalize`: `Aged_Roe` → `aged-roe`; `CamelCase` → `camel-case`; `Joja Cola` → `joja-cola`; `Maple_Seed's` → `maple-seed-s`; `abigail` → `abigail`.
  - `test_matches_by_normalized_or_squashed_name`: ids `aged-roe`, `wild-horseradish`; files `gifts/Aged_Roe.png`, `seeds/WildHorseradish.png` → both `dest/<id>.png` exist.
  - `test_folder_order_on_duplicates`: `museum/X.png`, `gifts/X.png`, `perfection/shipped/X.png` for id `x` → `dest/x.png` bytes come from `gifts/X.png`.
  - `test_override_wins`: override `{"apple-sapling": "fruitTrees/saplings/Apple.png"}` → `dest/apple-sapling.png` from that file, even when another file normalizes to `apple-sapling`.
  - `test_unmatched_and_non_png_go_to_ui`: `ui/calendar.png` (no id) → `dest/ui/calendar.png`; `event/festival.gif` with id `festival` existing → `dest/ui/festival.gif`, and `dest/festival.png` not created from it.
  - `test_ui_name_clash_prefixes_folder`: `addTask/star.png` and `ui/star.png`, no matching id → the folder earlier in `FOLDER_ORDER` (`addTask`) keeps `dest/ui/star.png`; the other becomes `dest/ui/ui-star.png`.
  - `test_manifest_and_notice`: `manifest.json` == sorted matched ids; `NOTICE.txt` exists.
  - `test_report_missing`: index with folder `conquistas: ["first-steps"]` and no file → `report.missing == {"conquistas": ["first-steps"]}`.
  - `test_deterministic_and_clears_dest`: a stale `dest/old.png` is gone after `sync`; two runs give identical file trees and bytes.

- [ ] **Step 2: Run** `uv run pytest packages/stardew-valley/website/scripts -q` → FAIL (module not found).

- [ ] **Step 3: Implement `sync_icons.py`.** Read `index.json` as `{folder: [ids]}` (skip non-list values). Build candidate lists per id from PNG files only, sorted by `(FOLDER_ORDER position, folder, filename)`; first candidate wins; the other PNG candidates for that id are not copied (same sprite). Files matching no id, and all non-PNG files, go to `ui/`, processed in `FOLDER_ORDER` so clashes resolve deterministically. `ICONS_NOTICE.txt` text: "Stardew Valley sprites © ConcernedApe LLC. Copied from the stardew-valley-scheduler project (public/icons) for non-commercial fan use. Not covered by this repository's license."

- [ ] **Step 4: Run** `uv run pytest packages/stardew-valley/website/scripts -q` → PASS.

- [ ] **Step 5: Commit** `feat(stardew-valley-website): add the icon sync script`.

### Task 2: Copy the icons

**Files:**
- Create: `packages/stardew-valley/website/public/icons/**` (generated)
- Modify: `packages/stardew-valley/website/scripts/icon-overrides.json`
- Modify: `packages/stardew-valley/website/README.md` (how to re-run the script)

- [ ] **Step 1: Run** `python3 -I packages/stardew-valley/website/scripts/sync_icons.py /home/danhenrique/projects/stardew-valley/game-data/.tmp/stardew-valley-scheduler/public/icons /home/danhenrique/projects/stardew-valley/game-data/data/_meta/index.json`. Expected: ~894 ids copied; report lists missing ids.
- [ ] **Step 2:** For missing ids in `animais`, `arvores-frutiferas`, `construcoes`, `equipamentos`, `ferramentas`, `itens-especiais`, `moveis-e-decoracao`, `sementes`, look for the obvious source file among the `ui/` files and the source folders and add overrides only where the sprite clearly is that entity. Do not add overrides for `conquistas`, `pacotes`, `metas-monstros`, `categorias`, `colecoes`, `eventos-coleta`, `perfeicao`, `presentes` (out of scope). Re-run step 1.
- [ ] **Step 3: Verify** `ls packages/stardew-valley/website/public/icons | wc -l` ≈ manifest size + 3 (`ui`, `manifest.json`, `NOTICE.txt`), and the total file count under `public/icons` minus `manifest.json`/`NOTICE.txt` ≥ 1,854 minus duplicate losers (the report prints both numbers; paste them in the commit body).
- [ ] **Step 4:** Add a "Game icons" section to the website README with the command from step 1 and a note that `public/icons` is generated (do not edit by hand).
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add the game icons` (overrides + README + `public/icons`).

### Task 3: `lib/icons.ts`, `GameIcon`, footer credit

**Files:**
- Create: `packages/stardew-valley/website/src/lib/icons.ts`, `src/lib/icons.spec.ts`
- Create: `packages/stardew-valley/website/src/components/GameIcon.tsx`, `src/components/GameIcon.spec.tsx`
- Modify: `packages/stardew-valley/website/src/components/Footer.tsx`

**Interfaces:**
- Consumes: `public/icons/manifest.json` (Task 2), imported as JSON (`import manifest from '../../public/icons/manifest.json'`; add `resolveJsonModule` to `tsconfig.app.json` only if compile needs it).
- Produces:
  - `iconUrl(id: string): string` → `` `${import.meta.env.BASE_URL}icons/${id}.png` ``
  - `uiIconUrl(name: string): string` → `` `${import.meta.env.BASE_URL}icons/ui/${name}.png` ``
  - `hasIcon(id: string): boolean`
  - `GameIcon({ id, label, size = 'md', decorative = true, className? }: { id: string; label: string; size?: 'sm' | 'md' | 'lg'; decorative?: boolean; className?: string })`
  - `GameIconOr({ id, label, size, fallback }: … & { fallback: ComponentType<{ className?: string; 'aria-hidden'?: boolean }> })` — renders `GameIcon` when `hasIcon(id)`, else `fallback` at the same size class. Used by events and reminders (Tasks 4–5).

- [ ] **Step 1: Write failing tests.**
  - `icons.spec.ts`: `iconUrl('abigail')` ends with `/icons/abigail.png` and starts with `import.meta.env.BASE_URL`; `hasIcon('abigail')` true; `hasIcon('not-a-real-id')` false; **integrity**: every id in `manifest.json` has `public/icons/<id>.png` on disk (`node:fs` + `new URL('../../public/icons/', import.meta.url)`).
  - `GameIcon.spec.tsx`: known id → `img` with `src` = `iconUrl(id)`, `alt=""`, `loading="lazy"`, class `size-6` and `[image-rendering:pixelated]`; `decorative={false}` → `getByRole('img', { name: 'Abigail' })`; `size="sm"`/`"lg"` → `size-4`/`size-12`; unknown id → no `<img>`, an `svg` with `aria-hidden="true"` and `size-6`; `fireEvent.error(img)` → replaced by the `svg`; `GameIconOr` with unknown id renders the given fallback.
- [ ] **Step 2: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:test -- icons GameIcon` → FAIL.
- [ ] **Step 3: Implement.** `GameIcon` keeps a `failed` state set by `onError`; `width`/`height` attributes 16/24/48; fallback `PhotoIcon` with `text-gray-400 dark:text-gray-500`. Footer: add a second `<p>` with the exact credit line from Global Constraints, same classes.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): add the game icon component`.

### Task 4: Events

**Files:**
- Modify: `src/lib/events.ts` (+ `events.spec.ts`), `src/components/EventCalendar.tsx`, `EventList.tsx`, `EventDetail.tsx`, `UpcomingEvents.tsx` (+ their specs)

**Interfaces:**
- Produces: `eventIconId(event: FixedEvent): string` → `event.item ?? event.refId` for `foraging`, `event.refId` otherwise.
- Consumes: `GameIconOr` (Task 3), existing `KIND_ICONS` as `fallback`.

- [ ] **Step 1: Failing tests.** `events.spec.ts`: birthday → villager id; festival → festival id; foraging with `item` → item; foraging without `item` → `refId`. `EventList.spec.tsx`: a birthday for `abigail` renders an `img` whose `src` ends with `/icons/abigail.png`; an event with an id missing from the manifest still renders its Heroicon (`svg`). One equivalent assertion each in `EventCalendar.spec` (size `sm` in the day cell), `EventDetail.spec` (size `lg` in the header), `UpcomingEvents.spec`.
- [ ] **Step 2: Run** `…:test -- events Event UpcomingEvents` → FAIL.
- [ ] **Step 3: Implement**: replace each `KIND_ICONS[event.kind]` render with `GameIconOr id={eventIconId(event)} fallback={KIND_ICONS[event.kind]}`, keeping current sizes (`sm` in calendar cells, `md` in lists, `lg` in the detail header).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show game icons on events`.

### Task 5: Today card (reminders, closed shops, notifications)

**Files:**
- Modify: `src/components/TodayList.tsx`, `TodayBar.tsx`, `Notifications.tsx`, `reminderIcons.ts` (+ specs)

- [ ] **Step 1: Failing tests** in `TodayList.spec.tsx`: reminder `traveling-cart` renders `img` `src` ending `/icons/traveling-cart.png`; a reminder id absent from the manifest renders `BellIcon` fallback (`svg`); a closed shop row renders the shop's icon; plantings/machines rows render their seed/machine icon. `TodayBar.spec`/`Notifications.spec`: one icon assertion each for whatever entity they name (skip a file if it names no entity).
- [ ] **Step 2: Run** `…:test -- Today Notifications` → FAIL.
- [ ] **Step 3: Implement** with `GameIconOr id={reminder.id} fallback={REMINDER_ICONS[reminder.id] ?? BellIcon}`, and `GameIcon` for shops, plantings, machines. Update the `reminderIcons.ts` doc comment: fallback when no sprite exists.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show game icons on the today card`.

### Task 6: Seeds, plantings and harvest calendars

**Files:**
- Modify: `src/components/SeedCatalog.tsx`, `PlantingList.tsx`, `PlantingDrawer.tsx`, `PlantingForm.tsx`, `MyPlantings.tsx`, `HarvestCalendar.tsx`, `SeasonCalendar.tsx`, `SchedulePreview.tsx` (+ specs)

- [ ] **Step 1: Failing tests**: `SeedCatalog.spec` — each plantable row has an `img` for `plantable.id` and one for its harvest product id when the component shows the product; `PlantingList.spec` — row icon; `PlantingDrawer.spec` — `size-12` header icon; `PlantingForm.spec` — selected seed shows its icon; `HarvestCalendar.spec` — `size-4` icon in a harvest day cell; `SchedulePreview.spec` — icon next to the seed name.
- [ ] **Step 2: Run** `…:test -- Seed Planting Harvest Schedule MyPlantings` → FAIL.
- [ ] **Step 3: Implement** with `GameIcon` (decorative, next to the existing name) using the id each component already has. In the planting picker (Headless UI listbox/combobox) put the icon in both the button and the options.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show game icons on seeds and plantings`.

### Task 7: Machines and the item drawer

**Files:**
- Modify: `src/components/MachineList.tsx`, `MachineDrawer.tsx`, `MachineForm.tsx`, `MachineCalendar.tsx`, `ItemDrawer.tsx` (+ specs)

- [ ] **Step 1: Failing tests**: `MachineList.spec` — machine icon and produced item icon in a row; `MachineDrawer.spec` — `size-12` header icon; `MachineForm.spec` — machine and input item options show icons; `ItemDrawer.spec` — `size-12` header icon and `size-4` icons in the gift/recipe/ingredient lists (villager ids for gift lists).
- [ ] **Step 2: Run** `…:test -- Machine ItemDrawer` → FAIL.
- [ ] **Step 3: Implement** with `GameIcon`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show game icons on machines and items`.

### Task 8: Shops page

**Files:**
- Modify: `src/components/ShopTable.tsx`, `src/routes/lojas.tsx` (+ `lojas.spec.tsx`)

The shops page shows no offers today (prices/offers were out of scope in the reminders spec), so only the shop gets an icon; "each item on sale" applies once offers exist.

- [ ] **Step 1: Failing test** in `lojas.spec.tsx`: the `pierre` row renders `img` `src` ending `/icons/pierre.png` (use the id present in test data).
- [ ] **Step 2: Run** `…:test -- lojas` → FAIL.
- [ ] **Step 3: Implement** `GameIcon` before the shop name in the table cell.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(stardew-valley-website): show game icons on shops`.

### Task 9: Final verification

- [ ] **Step 1: Run** `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:build` → lint, compile, test, bundle pass; `dist/.../icons/manifest.json` exists in the bundle output.
- [ ] **Step 2: Run** `uv run pytest packages/stardew-valley/website/scripts -q` → PASS.
- [ ] **Step 3:** Start the site locally (`pnpm nx run @aws-danhenrique/stardew-valley-helper-website:serve`, port 4201) and check Hoje, Calendário, Sementes, Plantios, Máquinas, Lojas in light and dark themes: icons sharp, rows aligned, fallbacks visible for achievements/bundles.
- [ ] **Step 4:** Commit any fixes from step 3.
