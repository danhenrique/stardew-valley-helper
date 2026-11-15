# Stardew Valley Helper — Design

- **Date:** 2026-11-07
- **Projects:** `packages/stardew-valley/{db,api,website,infra}`
- **Status:** approved in conversation; awaiting review of the written spec

## 1. Goal

Add a new application to the `aws-danhenrique` workspace: a helper website for Stardew Valley players, backed by a Python FastAPI and a DynamoDB table that becomes **the game's database**, all deployed by a dedicated Terraform project.

**Success means:**

- The whole game dataset (all 40 folders of `stardew-valley/game-data/data`) is imported **once** into the `stardew-valley-db` table, modelled as typed entities and relationships (single-table design). After the import the application reads only DynamoDB; the JSON files are no longer used.
- A logged-in player can, on the home page, register planted seeds/saplings using **selection fields only** and see when each one is ready, its regrowth harvests and when it dies, for the current in-game date.
- `pnpm nx run-many -t build -p <new projects>` passes (lint, typecheck, tests, checkov).
- `stardew-valley-infra` deploys website, API, table, Cognito and the `stardew.danhenrique.com.br` domain to **prod** without changing any existing resource or file outside the additive list in §3.

## 2. Decisions already made

| Decision | Choice | Reason |
|---|---|---|
| Workspace | `aws-danhenrique`, everything game-related under `packages/stardew-valley/` | User decision; keeps it apart from the personal website |
| Approach | `@aws/nx-plugin` generators + `connection` generators | Same pattern as the rest of the workspace; typed client, AppConfig runtime config |
| Player data | DynamoDB, per user, behind Cognito login | Syncs across devices |
| Growth modifiers | Speed fertilizers, Agriculturist, Greenhouse / Ginger Island | User decision |
| Where the calculation lives | API (`schedule.py`, pure Python) | One testable place for the rule; website only renders |
| Language | UI in pt-BR; item names `ptBr ?? en` | User decision |
| Domain | `stardew.<domain_name>` in the existing hosted zone (read-only data source) | User decision |
| WAF | **Off** for CloudFront and API (`enable_waf = false`) | User decision; saves ~US$ 14/month |
| Environments | **prod only** for now | User decision |
| Data model scope | All 40 data types typed in the first delivery | User decision |
| Unknown planting date | A regrowing crop can be registered from the date of a known harvest instead of the planting date (`anchor = harvested`) | User decision: the player planted, does not remember when, but wants the next regrowth harvests |
| Form inputs | Every field is a select/combobox/radio/toggle, except the optional planting label (text) and the quantity (number input, 1–999) | User decision |

## 3. Workspace layout and touched files

```
packages/stardew-valley/
├── db/        stardew_valley_db              py#dynamodb (PynamoDB), table "stardew-valley-db"
├── api/       stardew_valley_api             py#api (FastAPI, REST + Lambda, isolated, auth IAM)
├── website/   stardew-valley-helper-website  ts#website (React, TanStack Router, Tailwind, ux=none) + ts#website#auth
└── infra/     stardew-valley-infra           terraform#project
```

Connections: `connection` api → db, `connection` website → api.

**Existing files that receive additions only** (required by the generators / pnpm; nothing removed or rewritten):

- `pnpm-workspace.yaml` (`packages/stardew-valley/*`), `pnpm-lock.yaml`, pnpm catalog entries
- `nx.json` (only if a generator registers a plugin)
- New root Python files: `pyproject.toml`, `uv.lock`, `.python-version`
- `packages/common/terraform/src/app/*/<new module>` and any missing `core/*` modules (existing modules untouched)
- `packages/common/scripts` (DynamoDB Local scripts)

If a generator **modifies** anything else (e.g. `packages/infra/src/*`, `.github/workflows/*`, `packages/website/*`), that change is reverted and reported to the user.

## 4. Architecture

```
Browser ──Cognito Hosted UI──► User Pool + Identity Pool (temporary IAM credentials)
   │ typed client (SigV4)
   ▼
CloudFront (stardew.<domain>) ──► S3 (static site, runtime-config.json)
API Gateway REST ──► Lambda per operation (FastAPI via Lambda Web Adapter) ──► DynamoDB stardew-valley-db
                                   └─ table name from AppConfig
import (run once, locally) ──► DynamoDB (game data)
```

## 5. Data model — single table `stardew-valley-db`

Keys: `pk`, `sk` (String); `gsi1pk/gsi1sk` = **list by type**; `gsi2pk/gsi2sk` = **inverted relationships**. Every item carries `entityType` (PynamoDB discriminator, `attr_name="entityType"`). Attributes and API JSON fields are `camelCase` (rule `coding.md`; PynamoDB maps Python names with `attr_name`); translated text is a Map `{en, ptBr}`; references store ids only. Numbers (including floats) are `Number`.

### 5.1 Core entities (`sk` = entity name)

| Entity | pk | Source folders | Main attributes | gsi1pk / gsi1sk |
|---|---|---|---|---|
| `Item` | `ITEM#<id>` | all item folders: sementes, arvores-frutiferas, frutas, vegetais, flores, cogumelos, coleta, peixes, produtos-animais, artesanato, culinaria, maquinas, recursos, minerais, artefatos, fosseis, geodos, ferramentas, armas, equipamentos, pesca, fertilizantes, consumiveis, fabricaveis, moveis-e-decoracao, livros, berloques, itens-especiais, lanches-cinema | `itemType` (folder), `subtype`, `name`, `nameVerified`, `tags`, `sellPrice`, `museumDonation`, `artisan{kegPrice,jarPrice}`, `averageForageValue`, `crop{seasons,growthDays,phases,regrowDays,lastPlantingDay,averageExtraYield,produce,notes}`, `fruitTree{fruit,season,daysToMature,fruitsPerDay,maxFruitOnTree}`, `catch{tool,seasons,weather,timeWindows,location,locationVerified}`, `processing[]{output,days,label}`, `machineCategory` | `TYPE#<folder>` / `<id>` |
| `Villager` | `VILLAGER#<id>` | personagens | `name`, `birthday{season,day}`, `marriageable` | `TYPE#personagens` / `<id>` |
| `Shop` | `SHOP#<id>` | lojas | `name`, `schedule` (full Map), `scheduleText`, `scheduleTextVerified` | `TYPE#lojas` / `<id>` |
| `Building` | `BUILDING#<id>` | construcoes | `category`, `price`, `buildDays`, `builtBy`, `upgradeFrom`, `materials[]{item,qty}` | `TYPE#construcoes` / `<id>` |
| `Animal` | `ANIMAL#<id>` | animais | `housing` (→ Building), `purchase{shop,price}` | `TYPE#animais` / `<id>` |
| `Festival` | `FESTIVAL#<id>` | festivais | `season`, `startDay`, `endDay`, `shopsClosed` | `TYPE#festivais` / `<seasonIdx>#<startDay:02>` |
| `Bundle` | `BUNDLE#<id>` | pacotes | `room{id,name}`, `quality`, `remixed`, `slotsRequired` | `TYPE#pacotes` / `<roomId>#<id>` |
| `Category` | `CATEGORY#<id>` | categorias | `name`, `note` | `TYPE#categorias` / `<id>` |
| `Movie` | `MOVIE#<id>` | filmes | `name` | `TYPE#filmes` / `<id>` |
| `Achievement` | `ACHIEVEMENT#<id>` | conquistas | `description`, `order` | `TYPE#conquistas` / `<order:03>` |
| `MonsterGoal` | `MONSTER_GOAL#<id>` | metas-monstros | `killsRequired`, `location`, `reward` (→ Item) | `TYPE#metas-monstros` / `<id>` |
| `Collection` | `COLLECTION#<id>` | colecoes | `name` (members are relationships) | `TYPE#colecoes` / `<id>` |
| `Perfection` | `PERFECTION#<id>` | perfeicao | `categories[]` (Map: `id,name,kind,weight,max,goals,items,villagers,entries`) | `TYPE#perfeicao` / `<id>` |
| `UniversalGifts` | `UNIVERSAL_GIFTS` | presentes | `description`, `tierLabels` (tastes are relationships) | — |
| `GameMeta` | `META#<id>` | `_meta/enums.json`, `_meta/locales.json` | season/weekday labels, locales | — |

Not imported: `_meta/index.json` (replaced by gsi1) and `_meta/pending-translations.json` (translation worklist; covered by `nameVerified`).

### 5.2 Relationships (children under the owner's pk, inverted on gsi2)

| Relationship | pk | sk | gsi2pk / gsi2sk | Attributes |
|---|---|---|---|---|
| Gift taste | `VILLAGER#<v>` or `UNIVERSAL_GIFTS` | `GIFT#<tier>#ITEM#<i>` / `GIFT#<tier>#CATEGORY#<c>` | `ITEM#<i>` (or `CATEGORY#<c>`) / `GIFT#<tier>#VILLAGER#<v>` (or `#UNIVERSAL`) | `except[]` |
| Movie taste | `VILLAGER#<v>` | `MOVIE_TASTE#<loved\|liked>#MOVIE#<m>` / `…#ITEM#<snack>` | `MOVIE#<m>` (or `ITEM#<snack>`) / `MOVIE_TASTE#<…>#VILLAGER#<v>` | — |
| Shop offer | `SHOP#<s>` | `OFFER#ITEM#<i>#<n>` | `ITEM#<i>` / `OFFER#SHOP#<s>#<n>` | `price`, `priceByYear`, `currency{qiCoins,qiGems,goldenWalnuts}`, `materials[]`, `season`, `section`, `availability`, `fromYear`, `fishingLevel`, `packSize`, `recipe`, `rotating`, `requiresBuilding`, `requiresMonsterGoal`, `special` |
| Recipe | `ITEM#<result>` | `RECIPE#<crafting\|cooking>` | — | `ingredients[]{item\|category\|anyOf,qty}`, `alternatives[]{condition,ingredients}`, `note` |
| Ingredient | `ITEM#<result>` | `INGREDIENT#<kind>#ITEM#<i>` | `ITEM#<i>` / `USED_IN#ITEM#<result>` | `qty`, `recipeKind` |
| Produces | `ITEM#<seed\|sapling\|machine>` | `PRODUCES#ITEM#<product>` | `ITEM#<product>` / `PRODUCED_BY#ITEM#<origin>` | `via` (`crop\|fruitTree\|machine`), `days` |
| Member | `CATEGORY#<c>` or `COLLECTION#<c>` | `MEMBER#ITEM#<i>` | `ITEM#<i>` / `MEMBER_OF#<CATEGORY\|COLLECTION>#<c>` | — |
| Bundle requirement | `BUNDLE#<b>` | `REQUIRES#<n:02>#ITEM#<i>` / `REQUIRES#<n:02>#GOLD` | `ITEM#<i>` / `IN_BUNDLE#<b>` | `qty`, `gold`, `rainOnly`, `seasons` |

### 5.3 Player data

| Entity | pk | sk | Attributes |
|---|---|---|---|
| `PlayerProfile` | `PLAYER#<sub>` | `PROFILE` | `agriculturist` (bool), `currentDate{year,season,day}`, `updatedAt` |
| `Planting` | `PLAYER#<sub>` | `PLANTING#<ulid>` | `seedId`, `anchor` (`planted\|harvested`), `plantedOn{year,season,day}` (when `anchor = planted`), `lastHarvestOn{year,season,day}` (when `anchor = harvested`), `fertilizer` (`none\|speed-gro\|deluxe-speed-gro\|hyper-speed-gro`), `location` (`farm\|greenhouse\|ginger-island`), `quantity`, `label` (optional), `createdAt` |

`<sub>` is the opaque Cognito identity; no email, name or other personal data is stored.

### 5.4 Access patterns

| # | Pattern | Operation |
|---|---|---|
| 1 | Get an entity | GetItem `<TYPE>#<id>` / `<TYPE>` |
| 2 | Entity + its owned relationships (recipe, offers, tastes, produces…) | Query pk `<TYPE>#<id>` |
| 3 | List a type (seeds, saplings, fertilizers, festivals by date…) | Query gsi1 `TYPE#<folder>` |
| 4 | Everything pointing at an item (who loves it, where to buy, grows from, used in, categories, bundles) | Query gsi2 `ITEM#<id>` (filter by gsi2sk prefix when needed) |
| 5 | Player profile + all plantings | Query `PLAYER#<sub>` |
| 6 | Create / update / delete a planting | Put / Update / Delete `PLAYER#<sub>` / `PLANTING#<ulid>` |

### 5.5 Import (`nx run stardew_valley_db:import`)

- Reads `--data-dir` (default `../../stardew-valley/game-data/data` relative to the workspace root), converts each JSON (i18n `pt-BR` → `ptBr`; source keys are already camelCase) into the entities and relationships above, and batch-writes them. Idempotent (deterministic keys); re-running overwrites.
- **Source duplication:** item `giftTastes` mirrors villager `gifts`, item `soldAt` mirrors shop `offers`. Only villagers and shops are imported; the other side is compared and differences are logged. A `soldAt` with no matching shop offer becomes an offer.
- Validates **every** file before writing anything; if any file is invalid it exits with code 1 and writes nothing. `--dry-run` converts without writing.
- Run once by the user after the first deploy; never run automatically.

## 6. Planting schedule rules (`api/.../schedule.py`, pure, no I/O)

- Calendar: 4 seasons × 28 days; absolute day `abs = (year-1)*112 + seasonIdx*28 + day`.
- **Speed** = fertilizer (`0 | 0.10 | 0.25 | 0.33`) + `0.10` if Agriculturist. Game constants in code (the data has no speed values).
- **First harvest (crops):** with `phases`, replicate the game: `daysToRemove = ceil(sum(phases) × speed)`, remove 1 day per phase in order, up to 3 passes, first phase never below 1. Without `phases`: `growthDays − ceil(growthDays × speed)` and `approximate: true`. `ready = planted + growthDays` (Strawberry planted Spring 1 → Spring 9).
- **Regrowth:** every `regrowDays` after the previous harvest (harvested on the ready day); not affected by speed.
- **From a known harvest (`anchor = harvested`):** only for crops with `regrowDays` (other seeds and fruit trees → `422` "Only regrowing crops can start from a harvest date"). The player gives `lastHarvestOn` (any harvest they remember, usually the last one). Next harvests = `lastHarvestOn + k × regrowDays` (k ≥ 1); `firstHarvest = lastHarvestOn`; fertilizer and Agriculturist are ignored (they do not affect regrowth) and the response sets `fertilizer = none`. Season rules are the same: on the farm `lastHarvestOn` must fall in a season in `crop.seasons` (else `422`), the plant dies on day 1 of the first following season not in `crop.seasons`; greenhouse/island → next 10 harvests and `infinite: true`. `totalHarvests` counts only the harvests after `lastHarvestOn`; the planting date stays unknown and is not shown. Status uses the same rules (on `lastHarvestOn` itself → `ready`).
- **Season end (farm only):** the plant dies on day 1 of the first following season not in `crop.seasons`; harvests after that are dropped; first harvest after death → `willNotMature` warning. Planting outside a valid season → `422`. **Greenhouse / Ginger Island:** no seasonal death; with regrowth return the next 10 harvests and `infinite: true`.
- **Fruit trees:** mature at `planted + daysToMature`; unaffected by fertilizer/profession; 1 fruit/day in `fruitTree.season` (all year in greenhouse/island), up to `maxFruitOnTree`.
- **Status** vs `profile.currentDate`: `growing` (N days left), `ready`, `regrowing` (next in N), `finished`, `dead`.
- **Output:** `firstHarvest`, `harvests[]`, `totalHarvests`, `infinite`, `diesOn`, `status`, `daysUntilNext`, `approximate`, `warnings[]`.
- **Expected yield:** `yieldPerHarvest = round(quantity × (1 + averageExtraYield), 1)`; `expectedTotalYield = yieldPerHarvest × totalHarvests`, or `null` for open-ended schedules (greenhouse/island regrowth, fruit trees).
- **Out of scope:** giant crops, paddy (water) bonus, Mixed Seeds, per-plant extra yield.

## 7. API (`stardew_valley_api`)

FastAPI, REST API + one Lambda per operation, IAM auth (Cognito Identity Pool). The caller's `sub` is always taken from the request context, never from the body.

| Method | Path | Purpose |
|---|---|---|
| GET | `/game/{type}` | List entities of a type (pattern 3) |
| GET | `/plantables` | Seeds with `crop` + saplings, `?season=&location=` (farm filters crops by season; greenhouse/island list all) |
| GET | `/game/{type}/{id}` | Entity + owned relationships (pattern 2) |
| GET | `/game/items/{id}/references` | Inverted relationships (pattern 4) |
| GET | `/me` | Profile + plantings with computed schedule/status |
| PUT | `/me/profile` | Update `currentDate` and `agriculturist` |
| POST | `/me/plantings` | Create planting (validated) |
| PUT | `/me/plantings/{id}` | Update planting |
| DELETE | `/me/plantings/{id}` | Delete planting |
| POST | `/schedule` | Preview a schedule without saving (accepts both anchors) |

Logging: AWS Lambda Powertools structured JSON logger only; no PII (the Cognito `sub` is not logged either, only the request correlation id).

Errors: `422` validation (seed out of season, invalid date/fertilizer), `404` unknown entity/planting, `403` unable to determine caller. Response models are declared on every route (needed by the typed client).

## 8. Website (`stardew-valley-helper-website`)

React + TanStack Router (generated, `ux=none`, `tailwind=true`), Tailwind, `@headlessui/react`, `@heroicons/react`, TanStack Query typed client from the connection. UI in pt-BR. Every route requires login (Cognito Hosted UI from `ts#website#auth`).

Components adapted from `/home/danhenrique/projects/.tailwind/application-ui-v4/react` (keeping their utility classes):

| Area | Base component |
|---|---|
| Shell + navbar (Plantios · Sementes · user menu / sign out) | `application-shells/stacked/01-with-bottom-border.jsx` |
| Home — current in-game date: season, day (1–28), year | `forms/select-menus/02-simple-custom.jsx` |
| Home — Agriculturist | `forms/toggles/04-with-left-label-and-description.jsx` |
| Add planting — seed/sapling (search, secondary text = seasons/days; only plantable in the chosen season unless greenhouse/island) | `forms/comboboxes/05-with-secondary-text.jsx` |
| Add planting — mode: "Sei a data do plantio" / "Sei a data de uma colheita" (the second lists only regrowing crops and hides the fertilizer field) | `forms/radio-groups/02-simple-inline-list.jsx` |
| Add planting — season/day/year planted **or** of the known harvest ("Data da colheita") | `forms/select-menus/02-simple-custom.jsx` |
| Add planting — fertilizer (None + 3 speed fertilizers from the DB, secondary text "−10%") | `forms/select-menus/06-with-secondary-text.jsx` |
| Add planting — location (Fazenda · Estufa · Ilha Gengibre) | `forms/radio-groups/11-small-cards.jsx` |
| Schedule preview (debounced 300 ms, `POST /schedule`) | `data-display/description-lists` + `feedback/alerts` |
| My plantings: location tabs (Todos · Fazenda · Estufa · Ilha Gengibre, with counts) filtering the list and the calendar | `navigation/tabs/08-tabs-with-underline-and-badges.jsx` + location badge `elements/badges/09-flat-pill.jsx` |
| My plantings + status badge | `lists/stacked-lists/06-with-badges-button-and-actions-menu.jsx` + `elements/badges/11-flat-pill-with-dot.jsx` |
| Harvest calendar (28-day season grid, prev/next season) | `data-display/calendars/02-month-view.jsx` |
| No plantings yet | `feedback/empty-states/02-with-dashed-border.jsx` |
| `/sementes` catalog by season | `navigation/tabs/03-tabs-in-pills.jsx` + `lists/grid-lists/03-simple-cards.jsx` |
| API errors | `overlays/notifications` |

Icon-only buttons (Heroicons, `aria-label` = `title` in pt-BR): delete planting (`TrashIcon`, "Excluir plantio"), previous/next season (`ChevronLeftIcon` / `ChevronRightIcon`, "Estação anterior" / "Próxima estação"), close notification (`XMarkIcon`, "Fechar"). "Adicionar plantio" and "Salvar data" keep text labels.

## 9. Infrastructure (`stardew-valley-infra`)

- Terraform, **prod only** (`env/prod.tfvars`: `aws_region = "sa-east-1"`, `domain_name = "danhenrique.com.br"`, `environment = "prod"`). Same state bucket as the existing bootstrap with a **separate state key**.
- Providers: default (`sa-east-1`) and `aws.us_east_1` (ACM / CloudFront).
- Modules, in order: `asset_bucket` → table `stardew-valley-db` (deletion protection + PITR on) → Cognito (from `ts#website#auth`; `enable_waf = false`, user pool tier **Essentials** instead of the generated Plus — keeps the 10k MAU free tier —, MFA `OPTIONAL` with TOTP only (no SMS), localhost callback/logout URLs removed) → API (`enable_waf = false`, `ALLOWED_ORIGINS = https://stardew.danhenrique.com.br`, table access via the connection) → website (`enable_waf = false`, `custom_domain_names = ["stardew.danhenrique.com.br"]`, `depends_on` API and Cognito).
- DNS/TLS: `data "aws_route53_zone"` for the existing zone (read-only); new ACM certificate in us-east-1 with DNS validation; alias A/AAAA record `stardew` → CloudFront.
- Checkov: skips for WAF-off checks with in-code justification, in the **new project's** `checkov.yml` (same pattern as the personal website).
- `.github/workflows` is not changed; the new projects join the existing `nx affected` run. Any CI change needed is proposed first.
- Deploy and import are run only after explicit user confirmation:
  `pnpm nx run stardew-valley-infra:apply --configuration=prod`, then `pnpm nx run stardew_valley_db:import`.

## 10. Estimated cost (prod, low traffic, sa-east-1, WAF off)

| Item | US$/month |
|---|---|
| ~4 customer-managed KMS keys | 4–5 |
| AppConfig reads on Lambda cold starts | 1–2.50 |
| API Gateway REST (100k requests) | 0.35–0.45 |
| DynamoDB on-demand + storage + PITR | < 0.10 |
| Lambda, CloudFront, S3, Cognito (≤ 10k MAU), CloudWatch, X-Ray, ACM | ≈ 0 (free tiers) |
| **Total** | **≈ 5–8** |

sa-east-1 rates were not confirmed from AWS during design; check the AWS Pricing Calculator for exact figures.

## 11. Testing

- `schedule.py`: pytest with known cases (Strawberry 8d/regrow 4d, Cauliflower with Speed-Gro + Agriculturist, Coffee crossing Spring→Summer, planting on `lastPlantingDay`, Ancient Fruit in greenhouse, strawberry from a known harvest on Spring 13 → Spring 17/21/25, non-regrowing crop from a harvest → error) and computed vs imported `lastPlantingDay` for seeds with `phases`.
- Import: JSON → entities/relationships conversion with small fictitious fixtures.
- API: endpoint tests against DynamoDB Local.
- Website: Vitest + Testing Library for the planting form (only valid selections, preview) and the plantings list.
- Infra: `terraform fmt`, `validate`, `test`, `checkov` through Nx targets.

## 12. Data license

Game data is © ConcernedApe LLC and partly from the Stardew Valley Wiki (CC BY-NC-SA 3.0): **non-commercial fan use only**. The website shows this notice in its footer.
