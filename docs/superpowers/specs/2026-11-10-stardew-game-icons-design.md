# Stardew Helper: game icons (design)

Date: 2026-11-10 · Branch: `feat/stardew-game-icons` (on top of `feat/stardew-reminders-shops`)

## Goal

Show every Stardew Valley entity on the Stardew Helper website (villagers, items, seeds, machines,
shops, festivals, reminders, …) with its in-game icon next to its name, so the screens are quicker to
read and feel like the game. All images from the scheduler repository are copied.

Source: `/home/danhenrique/projects/stardew-valley/game-data/.tmp/stardew-valley-scheduler/public/icons`
(1,854 images, 8.7 MB, almost all 32×32 PNG, in 26 folders). Data ids: `game-data/data/_meta/index.json`
(1,075 ids); 894 ids match an image by normalized file name.

## Scope and decisions

- **Hosting (approach 1):** the images are bundled in the Stardew website (`public/icons/`) and served
  by its existing S3 + CloudFront distribution. No new infrastructure, cost, CORS or domain.
- **Rejected:** a shared media bucket + CloudFront (`media.danhenrique.com.br`). Only the Stardew site
  uses the images today, so it is cost and complexity without a use case. Migrating later means
  changing the base URL in one helper (`iconUrl`).
- **Rejected:** an `icon` field in the data/DynamoDB. The id is already the natural key; the field
  would require changes to `build-data.py`, entities, import and API for no gain.
- **Out of scope:** sprite sheets, WebP conversion, a media bucket, images for achievements
  (`conquistas`), bundles (`pacotes`) and monster goals (`metas-monstros`). Those use the fallback
  and show up in the script report.
- **License:** the sprites are © ConcernedApe, used as non-commercial fan content (see the source
  `NOTICE`). The site stays non-commercial and credits ConcernedApe in the footer and in
  `public/icons/NOTICE.txt`.
- UI labels stay in Portuguese (pt-BR); code, docs and commits are in English.

## 1. Copy pipeline

Script `packages/stardew-valley/website/scripts/sync_icons.py`, standard library only, run by hand
(`python3 -I`), outside the build (the source lives in another repository, on the developer's machine).

Arguments: the source `public/icons` folder and the `_meta/index.json` path.

1. Clear `website/public/icons/` (the run is deterministic: two runs give the same output).
2. Walk every image and normalize its base name to kebab-case: split CamelCase, lowercase, turn any
   run of non-alphanumeric characters into `-`, trim `-` (`Aged_Roe` → `aged-roe`). An image matches
   an id when the normalized name equals the id, or when both match after removing every non-alphanumeric
   character.
3. A matched image is copied to `public/icons/<id>.png`. When several folders hold the same id
   (e.g. `gifts/` and `bundleItems/`), a fixed folder preference order picks one, never disk order.
   The other copies (other folders or sizes) go to `public/icons/variants/<folder>/<name>.png`, so
   every source image is kept for future use.
4. `scripts/icon-overrides.json` (id → source path relative to the source folder), versioned next to the
   script, fixes names that do not match. Overrides win over automatic matches.
5. Images matching no id (`ui/*`, `reminders/*` leftovers, `addTask/*`, …) are copied to
   `public/icons/ui/<normalized-name>.<ext>`. On a name clash inside `ui/`, the scheduler's own `ui/`
   file keeps the name and the other folder is prefixed (`<folder>-<name>`).
6. Write `src/lib/icon-manifest.json`: the sorted list of ids that have an image (inside `src`,
   which the website's tsconfig `rootDir` requires).
7. Copy `public/icons/NOTICE.txt` (ConcernedApe credit, non-commercial use).
8. Print a report: ids without an image grouped by data folder, and the files sent to `ui/`.

## 2. `GameIcon` component

- `src/lib/icons.ts`:
  - `iconUrl(id)` → `${import.meta.env.BASE_URL}icons/${id}.png`. The only place that knows the base URL.
  - `hasIcon(id)` → whether `id` is in `manifest.json`, imported at build time.
  - `uiIconUrl(name)` → `${BASE_URL}icons/ui/${name}.png`, for the few generic game icons.
- `src/components/GameIcon.tsx`, props `id`, `label`, `size` (`sm` 16 px `size-4`, `md` 24 px `size-6`
  default, `lg` 48 px `size-12`), `decorative` (default `true`):
  - With an image: `<img src alt loading="lazy" decoding="async" width height>` with Tailwind classes,
    including `[image-rendering:pixelated]` so the 32×32 pixel art scales sharp. No custom CSS.
  - `alt=""` when `decorative` (icon next to its name, so screen readers do not repeat it);
    `alt={label}` when the icon stands alone.
  - No image in the manifest, or `onError`: Heroicons `PhotoIcon` at the same size, gray,
    `aria-hidden`.
  - Fixed size so the row does not shift while the image loads. Sprites have transparent backgrounds
    and work in light and dark themes.

## 3. Where icons appear

Rule: every game entity shown with its name gets a `GameIcon` on its left, in `flex items-center gap-2`.
Heroicons stay for actions (delete, close, refresh, theme).

| Screen / component | Icon |
|---|---|
| Seeds (`SeedCatalog`) | each seed/sapling and its harvest product |
| Plantings (`PlantingList`, `PlantingDrawer`, `PlantingForm`, `MyPlantings`) | seed/tree in each row and in the picker; `lg` in the drawer header |
| Harvest calendar (`HarvestCalendar`, `SeasonCalendar`, `SchedulePreview`) | `sm` inside day cells |
| Machines (`MachineList`, `MachineDrawer`, `MachineForm`, `MachineCalendar`) | machine and produced item |
| Items (`ItemDrawer`) | `lg` in the header; `sm` in gift, recipe and ingredient lists |
| Events (`EventCalendar`, `EventList`, `EventDetail`, `UpcomingEvents`) | birthday → villager portrait; festival → festival icon; foraging → item. Replaces `KIND_ICONS` when an image exists; otherwise the current Heroicon stays |
| Today (`TodayList`, `TodayBar`, `Notifications`) | reminders use the game sprite instead of `REMINDER_ICONS` (Heroicon kept as fallback); closed shops and events follow the rules above |
| Shops (`ShopTable`, `lojas` route) | shop and each item on sale |
| Footer (`Footer`) | credit line: "Stardew Valley © ConcernedApe. Imagens usadas sem fins comerciais." |

Components already receive entity ids from the API; the backend does not change.

## 4. Tests and verification

- `sync_icons.py` (pytest, fixture with a few fake PNGs and a small `index.json`): name normalization
  (underscores, CamelCase, spaces, apostrophes), folder preference on duplicate ids, overrides,
  unmatched images to `ui/` (including clashes), `manifest.json` content, determinism. Tests live in
  `website/scripts/tests/` and run with the workspace's uv environment
  (`uv run pytest packages/stardew-valley/website/scripts`); they are not part of the Nx website build.
- `lib/icons.ts` (Vitest): `iconUrl` honors `BASE_URL`; `hasIcon`.
- `GameIcon` (Vitest + Testing Library): `<img>` with the right `src` for a known id; `PhotoIcon`
  for an unknown id and after `onError`; `alt` empty when decorative and set otherwise; size classes.
- Screens: existing specs (`TodayList`, `EventList`, `ShopTable`, …) check that the icon renders for a
  known entity, and that events and reminders fall back to their Heroicon.
- Integrity (Vitest): every id in `manifest.json` has its `.png` in `public/icons/`.
- Final check: `pnpm nx run @aws-danhenrique/stardew-valley-helper-website:build` (lint, compile,
  test, bundle) and a look at the local site in light and dark themes.
