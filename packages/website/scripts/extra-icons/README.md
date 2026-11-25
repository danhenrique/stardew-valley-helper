# Extra icons

Sprites the stardew-valley-scheduler project does not have. `sync_icons.py` copies each
`<id>.png` to `public/icons/<id>.png`, ahead of any scheduler copy (which goes to `variants/`).
The file name must be a data id, or the sync fails.

Each sprite is a tile of the unpacked game content (`Content/`), scaled ×3 with nearest-neighbour,
like the scheduler icons: 16×16 items become 48×48, and 16×32 big craftables
(`TileSheets/Craftables.png`) become 48×96. Tiles are numbered left to right, top to bottom
(`Data/Objects.json` or `Data/BigCraftables.json` → `SpriteIndex`).

| id | Sheet | Index |
|---|---|---|
| big-stone-chest | `TileSheets/Craftables.png` | 328 |
| broccoli-seeds | `TileSheets/Objects_2.png` | 86 |
| carrot-seeds | `TileSheets/Objects_2.png` | 84 |
| pine-cone | `Maps/springobjects.png` | 311 |
| pineapple-seeds | `Maps/springobjects.png` | 833 |
| powdermelon-seeds | `TileSheets/Objects_2.png` | 87 |
| rarecrow-6 | `TileSheets/Craftables.png` | 138 |
| rare-seed | `Maps/springobjects.png` | 347 |
| stone-cairn | `TileSheets/Craftables.png` | 32 |
| strawberry-seeds | `Maps/springobjects.png` | 745 |
| summer-squash-seeds | `TileSheets/Objects_2.png` | 85 |
| taro-tuber | `Maps/springobjects.png` | 831 |
