# Stardew Valley data

Game resources as JSON, one file per resource, grouped by type. Generated from the
`stardew-valley-scheduler` repository by `../scripts/build-data.py`:

```bash
# from the repository root
python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data
```

> The script **regenerates everything in `data/`** except this README and the farm planner folders.
> Manual edits to the JSON files are lost on the next run — put them in `../overrides/` instead
> (see `packages/db/README.md`, "Hand-made changes").

## Conventions

- **Folders** are in English (`fruits/`, `villagers/`, …); **ids / file names** are English
  kebab-case (`fruits/strawberry.json`). Ids are stable and language-independent.
- Every file has `id`, `type` (= folder name) and usually `name`.
- **References** between files use the id only:
  - `"item": "<id>"` points to any **item** folder (item ids are unique across those folders);
  - `"shop"` → `shops/`, `"category"` → `categories/`, villager ids → `villagers/`.
  - `_meta/index.json` lists the ids in every folder.
- Seasons: `spring | summer | fall | winter`. Weekdays: `mon … sun`. Translated labels live in
  `_meta/enums.json`.
- Times: `"HH:MM"`; `"(+1d)"` means after midnight.
- Prices are integers in in-game gold (`g`). The only non-integer value is
  `seeds/*-seeds.json → averageForageValue` for wild seeds, which is an average.

## Localization

Text lives in objects keyed by locale:

```json
"name": { "en": "Strawberry", "pt-BR": "Morango" },
"nameVerified": true
```

Only `en` and `pt-BR` for now (`_meta/locales.json`). To add a locale, add its key in the script
(the source has item names in 12 languages).

| `nameVerified` | Source of the pt-BR text |
|---|---|
| `true`  | `gameItemNames.json`, extracted from the **game files** (official translation) |
| `false` | the app's `messages/pt-BR.json`, **not yet checked** against the official translation |
| `pt-BR: null` | no translation in any source |

`_meta/pending-translations.json` lists everything still to be checked against the official wiki
(pt.stardewvalleywiki.com) or the game files. Descriptive text (`catch.location`, `scheduleText`,
`processing[].label`, `categories/` labels) also comes from the app and is flagged `*Verified: false`.

## Folders

| Folder | Content |
|---|---|
| `villagers/` | villagers: birthday, marriageable, gift tastes (`loves/likes/neutral/dislikesOrHates`), movie theater preferences |
| `gifts/universal.json` | universal gifts |
| `categories/` | item groups used by gift tastes (e.g. "all fruit") and their members |
| `festivals/` | festivals: season, days, whether shops close |
| `foraging-events/` | foraging events: season, days, item |
| `reminders/` | weekly reminders: `trigger` (`weekly` weekdays or `seasonStart`), `order`, optional `nightMarketDaily` and `suppressOnFestival`, `detail` text |
| `seeds/` | seeds with planting data (`crop`: seasons, growth days, phases, regrowth, last planting day, `produce`) |
| `fruit-trees/` | saplings (`fruitTree`: fruit, season, days to mature) |
| `fruits/` `vegetables/` `flowers/` `mushrooms/` `forage/` | produce and forage: sell price, keg/jar values, `growsFrom`, `giftTastes` |
| `fish/` | fish (`catch`: tool, seasons, weather, time windows, location) |
| `animals/` | farm animals: ranch price, required building |
| `animal-products/` `artisan-goods/` `cooking/` | animal products, artisan goods, dishes (`cookingRecipe`) |
| `machines/` | machines: `processing` (output and days), `craftingRecipe` |
| `buildings/` | buildings: cost, materials, build days, upgrade path, builder |
| `shops/` | shops: hours (`schedule`, incl. `weekdayHours` and `dateHours` overrides), offers (`offers`: price, materials, season, day, currency, requirements) |
| `bundles/` | Community Center bundles (standard and remixed): room, items, quantity, quality |
| `achievements/` `monster-goals/` `perfection/` `collections/` | progress: achievements, Adventurer's Guild goals, perfection, museum and field office |
| `minerals/` `artifacts/` `fossils/` `geodes/` `resources/` | minerals, artifacts, fossils, geodes, materials (`museumDonation`) |
| `tools/` `weapons/` `equipment/` `fishing/` `fertilizers/` `consumables/` `craftables/` `furniture/` `books/` `trinkets/` `movies/` `movie-snacks/` `special-items/` | all other items |

## Data license

Names, values and translations are © ConcernedApe LLC (Stardew Valley), and part of the data is
adapted from the Stardew Valley Wiki (CC BY-NC-SA 3.0). The source repository provides them for
**non-commercial fan use only**, and the same applies to any site built on these files.
