# stardew_valley_helper.stardew_valley_db

Project description here.

## Local development

`config.json` keeps the `localDev` table and container names from `aws-danhenrique`
(`aws-danhenrique-stardew-valley-db`, `aws-danhenrique-dynamodb`) so an existing DynamoDB Local
volume (`aws-danhenrique-dynamodb-data`) keeps its data.

## Importing the game data

The dataset in `packages/db/data` is imported **once**; afterwards DynamoDB is the only source the
application reads. It is generated from the community scheduler (git-ignored in
`.tmp/stardew-valley-scheduler`) with:

```bash
python3 -I packages/db/scripts/build-data.py .tmp/stardew-valley-scheduler packages/db/data \
  .tmp/Content-unpacked
```

The last argument is the unpacked game content (`Content/`, git-ignored in `.tmp`). It is optional,
but without it most pt-BR names fall back to the scheduler's app strings (`nameVerified: false`):
`scripts/game_strings.py` reads the official names from it (items, villagers, achievements,
festivals, map places and the "Conjunto {0}" bundle names). Names the game does not have (app
reminders, Steam-only achievements, some shops) stay in `data/_meta/pending-translations.json`.

The script lives outside `data/` on purpose: it wipes everything in the output directory except
`README.md` (and the farm planner folders, see below).

### Hand-made changes

Data the scheduler does not have (for example the Mines Dwarf shop and the shop access texts) lives
in `packages/db/overrides/<folder>/<id>.json`, which mirrors `data/`. `build-data.py` applies it on
top of what it generates: an id it does not produce is added as is, and an existing one gets the
override's fields merged in (maps merge key by key, lists and values are replaced; new keys go right
after `id`/`type`/`name`/`nameVerified`). Each override needs matching `id` and `type`.

**Never edit `data/` by hand** — put the change in `overrides/` and regenerate. After regenerating,
`git diff packages/db/data` must show only the change you meant.

```bash
# Validate and convert only (no writes)
pnpm nx run stardew_valley_helper.stardew_valley_db:import --dry-run

# Write to the deployed table (prod). The table name is resolved from AWS AppConfig.
RUNTIME_CONFIG_APP_ID=$(cd packages/infra/src && terraform output -raw runtime_config_app_id) \
  AWS_REGION=sa-east-1 pnpm nx run stardew_valley_helper.stardew_valley_db:import
```

All files are validated before the first write: if any file is invalid the command exits with code 1
and writes nothing. Keys are deterministic, so re-running overwrites instead of duplicating.

## Renaming folders: backup → migrate → validate → delete

Game records use `pk = <PREFIX>#<id>`, independent of the folder, so renaming a folder only changes
`gsi1pk` (`TYPE#<folder>`) and a re-import overwrites the records in place. A renamed **id** leaves
the old record behind as an orphan. The import never deletes; only `migrate-cleanup --apply` does,
and it never touches player records (`PLAYER#…`).

Each step is manual, and nothing is deleted until validation passes. Set the prod environment once
(the table name comes from Terraform, the runtime config from AWS AppConfig, as for the import):

```bash
export AWS_PROFILE=<prod profile> AWS_REGION=sa-east-1
export TABLE_NAME=$(cd packages/infra/src && terraform output -raw table_name)
export RUNTIME_CONFIG_APP_ID=$(cd packages/infra/src && terraform output -raw runtime_config_app_id)
```

The Nx targets run from `packages/db`, so pass absolute paths for the snapshot file.

1. **Backup**, then snapshot the player record counts. The backup is the rollback path for every
   later step; record its ARN in the PR and wait until it is `AVAILABLE`.

   ```bash
   aws dynamodb create-backup --table-name "$TABLE_NAME" --backup-name stardew-pre-migration-<date>
   aws dynamodb describe-backup --backup-arn <BackupArn> --query BackupDescription.BackupDetails.BackupStatus
   pnpm nx run stardew_valley_helper.stardew_valley_db:migrate-snapshot -- --out "$PWD/user-counts.json"
   ```

2. **Deploy.** Merge the PR; CI deploys the API and the website.

3. **Migrate (write only).** Run the import; it overwrites existing keys and creates renamed ids.

   ```bash
   pnpm nx run stardew_valley_helper.stardew_valley_db:import
   ```

4. **Validate** (read-only). Exits with code 1 and logs each problem when a record of `data/` is
   missing or differs, a record still has an old Portuguese `TYPE#…`, a type's record count differs
   from `data/`, or the player record counts differ from the snapshot. Smoke-test the site too.

   ```bash
   pnpm nx run stardew_valley_helper.stardew_valley_db:migrate-validate -- --user-snapshot "$PWD/user-counts.json"
   ```

5. **Delete orphans.** The dry run lists the game records whose key `data/` no longer produces.
   Review the list, then apply and validate again.
   - `--apply` requires the snapshot file and runs the step 4 validation in the same run; it
     deletes nothing (exit 1) unless the validation passes.
   - `--apply` recomputes the orphan list when it runs; if time passed since the review, re-run the
     dry run right before applying.
   - Records under key prefixes the dataset no longer produces are never listed by cleanup (and
     `PLAYER#…` never is); remove those by hand if needed.

   ```bash
   pnpm nx run stardew_valley_helper.stardew_valley_db:migrate-cleanup
   pnpm nx run stardew_valley_helper.stardew_valley_db:migrate-cleanup -- --apply --user-snapshot "$PWD/user-counts.json"
   pnpm nx run stardew_valley_helper.stardew_valley_db:migrate-validate -- --user-snapshot "$PWD/user-counts.json"
   ```

**Run in a quiet window.** Validation compares the player record counts with the step 1 snapshot, so
any planting, machine or farm-plan change by a live player makes `validate` (and therefore
`migrate-cleanup --apply`) fail safe without deleting anything. If the only problem reported is
changed player record counts and the change is expected, take a new snapshot and validate again
before applying.

**Rollback:** restore the backup (`aws dynamodb restore-table-from-backup`) and revert the merge.

## Farm maps

The planner's terrain comes from the game's own farm maps (`Maps/Farm*.tmx`) and building data
(`Data/Buildings.json`). Neither is committed: the game is unpacked locally, a script converts it,
and only the generated JSON and WebP files are committed (CI never reads `.tmp`).

### Unpacking the game (manual, once per game update)

1. Install SMAPI (https://smapi.io) if the StardewXnbHack README asks for it; follow that README.
2. Move `StardewXnbHack.exe` from `...\Stardew Valley\StardewXnbHack 1.1.2 for Windows\` into
   `...\Stardew Valley\`, next to `Stardew Valley.dll`, and run it.
3. When it finishes, copy `...\Stardew Valley\Content (unpacked)` to `.tmp/Content-unpacked`
   (git-ignored). SMAPI can be uninstalled afterwards.
4. Check: `ls .tmp/Content-unpacked/Maps/Farm*.tmx .tmp/Content-unpacked/Data/Buildings.json`
   lists the farm maps and the buildings file.

Then run the farm script on the committed data (it needs Pillow, a dev dependency of this package):

```bash
uv run python -I packages/db/scripts/build_farm_maps.py .tmp/Content-unpacked packages/db/data packages/website/public/farms
```

It rewrites only `data/farms/`, `data/planner-objects/`, the `farms` and `planner-objects`
keys of `data/_meta/index.json` and `public/farms/*.webp`.

When both scripts run, `build-data.py` goes first: it keeps `farms/` and `planner-objects/`
(and their index entries), and the farm script then refreshes them.

### Confirmed map format (Stardew Valley 1.6)

Verified against the unpacked content of all eight maps.

**Files**

| Farm id | Map file | Size (W x H) |
| --- | --- | --- |
| `standard` | `Maps/Farm.tmx` | 80 x 65 |
| `riverland` | `Maps/Farm_Fishing.tmx` | 80 x 65 |
| `forest` | `Maps/Farm_Foraging.tmx` | 80 x 65 |
| `hilltop` | `Maps/Farm_Mining.tmx` | 80 x 65 |
| `wilderness` | `Maps/Farm_Combat.tmx` | 80 x 65 |
| `four-corners` | `Maps/Farm_FourCorners.tmx` | 80 x 80 |
| `beach` | `Maps/Farm_Island.tmx` | 110 x 110 |
| `meadowlands` | `Maps/Farm_Ranching.tmx` | 100 x 75 |

All maps are TMX 1.4 (`tiledversion="1.4.2"`), orthogonal, 16 x 16 tiles, `<data encoding="csv">`
(no compression, no flip bits). The `firstgid` of each tileset differs per map, so always resolve
a gid through that map's own `<tileset>` list.

**Layers** (a layer's `Draw` property says which layer it is drawn as; the game looks tile
properties up by the layer's real name):

- Every map: `Back`, `Buildings`, `Paths`, `Front`, `AlwaysFront` (layer order varies per map).
- Extra layers: `AlwaysFront2` (Farm, Fishing, Mining, FourCorners, Island, Ranching),
  `Buildings2` (Fishing, Mining, Island, Ranching; `Draw=Buildings`), `Back2` (Island, Ranching;
  `Draw=Back`), `AlwaysFront3` (Island).
- Only `Back` and `Buildings` matter for the planner. `Buildings2` only holds `Water` tiles, always
  on top of `Back` water; `Back2` carries no properties. Ignore both, `Front`, `AlwaysFront*`, `Paths`.
- `Paths` tiles only carry `PathType` / `Order` data used by the game's world generation. Ignored.

**Where tile properties live.** Two sources, merged per tile, the second wins:

1. The tileset `<tile id=... ><properties>` definition of the tile's gid (the bulk of the data).
2. Per-cell overrides: `<objectgroup name="Back|Buildings|Paths">` with `<object name="TileData"
   x=.. y=.. width="16" height="16">` and `<properties>`; the tile is `x/16, y/16`. On `Back` these
   are `NoSpawn`, `NoFurniture`, `NPCBarrier`, `AllSpawn` and `Buildable=f` (see below); on
   `Buildings` only `Action`; on `Paths` only `Order`.

**Water, Diggable and Buildable are `Back` properties** (the game reads them with
`doesTileHaveProperty(x, y, name, "Back")`). Tiles of the `Buildings` layer also carry some of
these names through shared tilesets (`Buildable`, `Water`, `Diggable`...), but the game never reads
them from there: ignore them. `Passable` is read from `Buildings` (and `Back`, see below).

**Buildable area.** There is no `NoBuild` map property in 1.6; the brief's guess was wrong. The
rule is the `Buildable` tile property on `Back`, written `T`, `t`, `True` (type `bool` in the
tileset, string `True` in the file) or `f` (override objects only: explicit "do not build here"; 16 cells on Farm,
19 on FourCorners, 10 on Ranching, 31 on each of the other five maps). Reading `GameLocation.isBuildable` in the game DLL shows it also treats a `Back`
`Diggable` tile as buildable and re-checks for `Buildable=f` at the end, so on the real farm the
open dirt (`Diggable` without `Buildable`, thousands of tiles) is buildable too: **a Diggable tile
without a `Buildable` property is buildable (`b`)**. There is also a
location-level map property `CanBuildHere` (not present on any farm map) checked in
`IsBuildableLocation`.

**Tile codes (binding for Task 2).** Evaluate top to bottom; the first match wins. `Diggable`
and `Water` are read from `Back`, `Buildable` from `Back` (tileset value or override object),
`Passable` from `Buildings`. "Buildable is yes" means `T`, `t` or `True`; "Buildable is no" means `f`,
`F` or `false`.

| Order | Code | Condition |
| --- | --- | --- |
| 1 | `x` | no `Back` tile, or a `Buildings` tile without `Passable=T` |
| 2 | `w` | `Back` has `Water=T` |
| 3 | `b` | `Diggable` and `Buildable` is not "no" (so Diggable without `Buildable` is `b`, and Diggable with `Buildable` yes is `b`) |
| 4 | `c` | `Buildable` is yes and not `Diggable` |
| 5 | `d` | `Diggable` and `Buildable` is "no" (explicit `Buildable=f`) |
| 6 | `f` | anything else |
| after | `x` | the tile is an in-map `Warp` tile (see below); this overrides the code above |

Equivalently: `buildable = Buildable yes or (Diggable and Buildable not "no")`; `b` = Diggable and
buildable; `c` = buildable and not Diggable; `d` = Diggable and not buildable.

**Blocked tiles.** A cell is blocked when:

1. `Back` is empty (void; e.g. 11 cells on Farm, 520 on Farm_Island), or
2. `Buildings` has a tile and that tile does **not** have `Passable=T` (`Passable` on `Buildings`
   only ever takes the value `T`; 26 cells on Mining, 420 on Island, 80 on Fishing, 3 on Ranching), or
3. `Back` has `Water=T` (also always `Passable=F` on `Back`; `Passable=F` never appears on a
   non-water `Back` tile).

Empty cells in `Buildings` are not blocking by themselves.

**Warp tiles are blocked too.** The `Warp` map property lists groups of five values,
`x y targetMap targetX targetY`. A warp tile that lies inside the map (for example the farm cave
entrance `34 5` on Farm) is classified `x` after the codes above, because stepping on it leaves the
farm. Edge warps one tile outside the map (`x = -1`, `y = -1`, `x = width`, `y = height`) are
ignored. A `Warp` value that is not groups of five, or has a non-integer tile, fails loudly. The
fixed-object footprint clearing (`f` to `c`, below) never touches these tiles. In-map warp tiles per
farm: Farm, Fishing, Foraging, Mining, Combat `34 5`; FourCorners `30 35`, `40-42 65`; Island
`34 15`, `81 16-18`, `81-83 105`; Ranching `88 54`.

**Tile property inventory (Back and Buildings tiles, tileset definitions plus override objects, all
eight maps).** Task 2's "unknown property fails loudly" check is this exact list; any other name,
or any value outside the listed ones for a *used* property, must raise.

| Property | Seen on | Values seen | Status |
| --- | --- | --- | --- |
| `Buildable` | Back (read), Buildings (not read) | `True` (bool), `T`, `t`, `f` (override) | **used** (Back only) |
| `Diggable` | Back, Buildings | `T` | **used** (Back only) |
| `Water` | Back, Buildings, Buildings2 | `T` | **used** (Back only) |
| `Passable` | Back, Buildings | `T` (Buildings), `F` (Back, water only) | **used** (Buildings only; Back `F` is redundant with `Water`) |
| `Type` | Back, Buildings, Front | `Grass`, `Dirt`, `Stone`, `Wood` | known, ignored (footstep sound) |
| `NoSpawn` | Back, Buildings | `T`, `t`, `True`, `All`, `Tree`, `Trees` | known, ignored (spawning) |
| `CanPlantTrees` | Back, Buildings | `T` | known, ignored |
| `NoFurniture` | Back | `T`, `total` | known, ignored (indoor furniture) |
| `NoSprinklers` | Back, Buildings | `T` | known, ignored |
| `NPCBarrier` | Back (override) | `T`, `t` | known, ignored |
| `placeable` | Back | `f`, `F` | known, ignored |
| `BeachSpawn` | Back, Buildings | `T` | known, ignored |
| `Spawnable` | Back, Buildings | `T`, `F` | known, ignored |
| `AllSpawn` | Back | `T` | known, ignored |
| `Action` | Buildings (override) | `Message "Farm.1"`-style strings | known, ignored |

`FloorID` / `WallID`, `TouchAction` and `Order` / `PathType` do not appear on `Back` or `Buildings`
tiles of the farm maps (`PathType` and `Order` exist only on `Paths`).

**Map properties** present on the farm maps: `AllowGrassSurviveInWinter`, `Outdoors`, `Warp` (all
eight); `PetBowlLocation` (FourCorners `49 40`, Island `78 21`, Ranching `91 14`);
`SpouseAreaLocation` (Island, Ranching); and only on Ranching: `FarmHouseEntry` (`81 19`),
`GreenhouseLocation` (`37 19`), `ShippingBinLocation` (`88 18`), `MailboxLocation` (`85 20`),
`GrandpaShrineLocation` (`14 9`), `BackwoodsEntry`, `BrookSounds`, `BusStopEntry`, `FarmCaveEntry`,
`FarmHouseFlooring`, `FarmHouseFurniture`, `FarmHouseStarterGift`, `FarmHouseStarterSeedsPosition`,
`FarmHouseWallpaper`, `ForestEntry`, `WarpTotemEntry`. Values are `x y` tile pairs.

**Fixed objects (farmhouse, greenhouse, shipping bin, pet bowl).** They are *not* in the TMX
(no tile, object or layer marks them); they are buildings created by the game at runtime. Position
= map property if present, else a default hard-coded in `Farm.cs`. The defaults were read from the IL
of `Stardew Valley.dll` (`Farm.GetMainFarmHouseEntry`, `GetStarterFarmhouseLocation`,
`GetGreenhouseStartLocation`, `GetStarterShippingBinLocation`, `GetStarterPetBowlLocation`); they are
not in `Content`. Positions are the building's **top-left tile**. These defaults are derived from
the game code; to be checked against the rendered background in Task 3.

- Farmhouse: `FarmHouseEntry` (the tile below the door; default `64 15`). Top-left =
  `(entry.x - 5, entry.y - 3)`, i.e. `(59, 12)` by default and `(76, 16)` on Meadowlands. Matches
  `Data/Buildings.json` `Farmhouse` `Size 9x5`, `HumanDoor (5, 2)`: door `(64, 14)`, entry one tile
  below.
- Greenhouse: `GreenhouseLocation`, else `(25, 10)`; Four Corners `(36, 29)`; Beach `(14, 14)`.
- Shipping bin: `ShippingBinLocation`, else `(71, 14)`.
- Pet bowl: `PetBowlLocation`, else `(53, 7)`.

| Farm | Farmhouse (entry) | Greenhouse | Shipping bin | Pet bowl |
| --- | --- | --- | --- | --- |
| standard, riverland, forest, hilltop, wilderness | `(59, 12)` (`64 15`) | `(25, 10)` | `(71, 14)` | `(53, 7)` |
| four-corners | `(59, 12)` (`64 15`) | `(36, 29)` | `(71, 14)` | `(49, 40)` (property) |
| beach | `(59, 12)` (`64 15`) | `(14, 14)` | `(71, 14)` | `(78, 21)` (property) |
| meadowlands | `(76, 16)` (`81 19`) | `(37, 19)` (property) | `(88, 18)` (property) | `(91, 14)` (property) |

Sizes come from `Data/Buildings.json` (`Farmhouse` 9x5, `Greenhouse` 7x6, `Shipping Bin` 2x1,
`Pet Bowl` 2x2). The script turns every free (`f`) tile under these starting footprints into `c`
(buildable): the game places the buildings there whatever the tiles say. Only the Beach farmhouse
needs it today: its footprint covers one `Buildable=f` path tile at `(64, 16)`. Water, blocked and
diggable tiles are never changed, so a fixed object on one of those still shows up as an error. Each map also has a few `Buildable=f` rectangles of override cells (for example a
4x4 block at `(69..72, 10..13)` on the standard layout) that are explicitly unbuildable.

### `Data/Buildings.json`

A JSON object keyed by the building's English name (`Coop`, `Barn`, `Big Barn`, `Shed`, `Stable`,
`Well`, `Silo`, `Mill`, `Cabin`, `Fish Pond`, `Pet Bowl`, `Shipping Bin`, `Farmhouse`, `Greenhouse`...).
Keys the planner needs:

- `Size`: `{ "X": width, "Y": height }` in tiles (footprint).
- `HumanDoor`: `{ "X", "Y" }`, tile offset from the building's top-left; `{ -1, -1 }` means none.
- `AnimalDoor`: `{ "X", "Y", "Width", "Height" }`, offset from the top-left; `{ -1, -1, 0, 0 }`
  means none.
- Also available (not needed): `BuildCost`, `BuildMaterials` (`ItemId`, `Amount`), `Builder`,
  `CollisionMap` (`X` = blocked, `O` = open rows, or `null`), `AdditionalPlacementTiles`, `IndoorMap`.

Example, `Barn`:

```json
{
  "Size": { "X": 7, "Y": 4 },
  "HumanDoor": { "X": 1, "Y": 3 },
  "AnimalDoor": { "X": 3, "Y": 3, "Width": 2, "Height": 1 },
  "BuildCost": 6000,
  "BuildMaterials": [{ "ItemId": "(O)388", "Amount": 350 }, { "ItemId": "(O)390", "Amount": 150 }]
}
```
