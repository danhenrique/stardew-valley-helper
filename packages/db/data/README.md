# Stardew Valley data

Game resources as JSON, one file per resource, grouped by type. Generated from the
`stardew-valley-scheduler` repository by `../scripts/build-data.py`:

```bash
# from the repository root
python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data
```

> The script **regenerates everything in `data/`** except this README. Manual edits to the JSON
> files are lost on the next run — fix the script or the source instead.

## Conventions

- **Folders** are in Portuguese (`frutas/`, `personagens/`, …); **ids / file names** are English
  kebab-case (`frutas/strawberry.json`). Ids are stable and language-independent.
- Every file has `id`, `type` (= folder name) and usually `name`.
- **References** between files use the id only:
  - `"item": "<id>"` points to any **item** folder (item ids are unique across those folders);
  - `"shop"` → `lojas/`, `"category"` → `categorias/`, villager ids → `personagens/`.
  - `_meta/index.json` lists the ids in every folder.
- Seasons: `spring | summer | fall | winter`. Weekdays: `mon … sun`. Translated labels live in
  `_meta/enums.json`.
- Times: `"HH:MM"`; `"(+1d)"` means after midnight.
- Prices are integers in in-game gold (`g`). The only non-integer value is
  `sementes/*-seeds.json → averageForageValue` for wild seeds, which is an average.

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
`processing[].label`, `categorias/` labels) also comes from the app and is flagged `*Verified: false`.

## Folders

| Folder | Content |
|---|---|
| `personagens/` | villagers: birthday, marriageable, gift tastes (`loves/likes/neutral/dislikesOrHates`), movie theater preferences |
| `presentes/universais.json` | universal gifts |
| `categorias/` | item groups used by gift tastes (e.g. "all fruit") and their members |
| `festivais/` | festivals: season, days, whether shops close |
| `eventos-coleta/` | foraging events: season, days, item |
| `lembretes/` | weekly reminders: `trigger` (`weekly` weekdays or `seasonStart`), `order`, optional `nightMarketDaily` and `suppressOnFestival`, `detail` text |
| `sementes/` | seeds with planting data (`crop`: seasons, growth days, phases, regrowth, last planting day, `produce`) |
| `arvores-frutiferas/` | saplings (`fruitTree`: fruit, season, days to mature) |
| `frutas/` `vegetais/` `flores/` `cogumelos/` `coleta/` | produce and forage: sell price, keg/jar values, `growsFrom`, `giftTastes` |
| `peixes/` | fish (`catch`: tool, seasons, weather, time windows, location) |
| `animais/` | farm animals: ranch price, required building |
| `produtos-animais/` `artesanato/` `culinaria/` | animal products, artisan goods, dishes (`cookingRecipe`) |
| `maquinas/` | machines: `processing` (output and days), `craftingRecipe` |
| `construcoes/` | buildings: cost, materials, build days, upgrade path, builder |
| `lojas/` | shops: hours (`schedule`, incl. `weekdayHours` and `dateHours` overrides), offers (`offers`: price, materials, season, day, currency, requirements) |
| `pacotes/` | Community Center bundles (standard and remixed): room, items, quantity, quality |
| `conquistas/` `metas-monstros/` `perfeicao/` `colecoes/` | progress: achievements, Adventurer's Guild goals, perfection, museum and field office |
| `minerais/` `artefatos/` `fosseis/` `geodos/` `recursos/` | minerals, artifacts, fossils, geodes, materials (`museumDonation`) |
| `ferramentas/` `armas/` `equipamentos/` `pesca/` `fertilizantes/` `consumiveis/` `fabricaveis/` `moveis-e-decoracao/` `livros/` `berloques/` `filmes/` `lanches-cinema/` `itens-especiais/` | all other items |

## Data license

Names, values and translations are © ConcernedApe LLC (Stardew Valley), and part of the data is
adapted from the Stardew Valley Wiki (CC BY-NC-SA 3.0). The source repository provides them for
**non-commercial fan use only**, and the same applies to any site built on these files.
