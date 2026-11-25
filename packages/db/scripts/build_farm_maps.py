#!/usr/bin/env python3
"""Farm terrain extractor: reads the game's farm .tmx maps and classifies every tile.

Tile codes: f free, d diggable (not buildable), b buildable and diggable, c buildable (not diggable),
w water, x blocked (also in-map warp tiles). See the "Farm maps" section of packages/db/README.md for the
confirmed map format.
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

FARMS: dict[str, str] = {
    "standard": "Farm",
    "riverland": "Farm_Fishing",
    "forest": "Farm_Foraging",
    "hilltop": "Farm_Mining",
    "wilderness": "Farm_Combat",
    "four-corners": "Farm_FourCorners",
    "beach": "Farm_Island",
    "meadowlands": "Farm_Ranching",
}

# Tile properties (Back and Buildings): used ones have a closed value set, ignored ones accept any value.
USED_VALUES: dict[str, set[str]] = {
    "Buildable": {"True", "T", "t", "f", "F", "false"},
    "Diggable": {"T"},
    "Water": {"T"},
    "Passable": {"T", "F"},
}
IGNORED_PROPERTIES = {
    "Type", "NoSpawn", "CanPlantTrees", "NoFurniture", "NoSprinklers", "NPCBarrier",
    "placeable", "BeachSpawn", "Spawnable", "AllSpawn", "Action",
}  # fmt: skip
BUILDABLE_YES = {"True", "T", "t"}
BUILDABLE_NO = {"f", "F", "false"}
PLANNER_LAYERS = ("Back", "Buildings")
FLIP_MASK = 0xE0000000

# Fixed objects: map-property overrides win, else these defaults (top-left tiles, see the README).
GREENHOUSE_DEFAULTS = {"four-corners": (36, 29), "beach": (14, 14)}
FARMHOUSE_ENTRY_TO_TOP_LEFT = (5, 3)


class ExtractError(Exception):
    """The map has a shape the extractor does not know; never guess."""


@dataclass
class Tileset:
    first_gid: int
    image: Path
    columns: int
    tile_properties: dict[int, dict[str, str]] = field(default_factory=dict)


@dataclass
class TmxMap:
    width: int
    height: int
    layers: dict[str, list[int]]
    tilesets: list[Tileset]
    properties: dict[str, str]
    # Per-cell overrides from <objectgroup> "TileData" objects: layer name -> {(x, y): properties}
    overrides: dict[str, dict[tuple[int, int], dict[str, str]]] = field(default_factory=dict)
    name: str = ""
    # Layer name -> the layer it is drawn as (its `Draw` property, else its own name), in file order
    draw_as: dict[str, str] = field(default_factory=dict)


def _properties(element: ET.Element | None) -> dict[str, str]:
    if element is None:
        return {}
    result = {}
    for prop in element.findall("property"):
        value = prop.get("value")
        result[prop.get("name", "")] = value if value is not None else (prop.text or "")
    return result


def read_tmx(path: Path) -> TmxMap:
    path = Path(path)
    root = ET.parse(path).getroot()
    width, height = int(root.get("width", "0")), int(root.get("height", "0"))
    tilesets = []
    for ts in root.findall("tileset"):
        image = ts.find("image")
        if ts.get("source") is not None or image is None:
            raise ExtractError(f"{path.name}: external or image-less tilesets are not supported")
        tilesets.append(
            Tileset(
                first_gid=int(ts.get("firstgid", "0")),
                image=path.parent / image.get("source", ""),
                columns=int(ts.get("columns", "0")),
                tile_properties={
                    int(tile.get("id", "0")): _properties(tile.find("properties")) for tile in ts.findall("tile")
                },
            )
        )
    tilesets.sort(key=lambda t: t.first_gid)
    layers: dict[str, list[int]] = {}
    draw_as: dict[str, str] = {}
    for layer in root.findall("layer"):
        name = layer.get("name", "")
        draw_as[name] = _properties(layer.find("properties")).get("Draw", name)
        data = layer.find("data")
        if data is None or data.get("encoding") != "csv" or data.get("compression"):
            raise ExtractError(f"{path.name}: layer {name!r} must use uncompressed csv encoding")
        gids = [int(v) for v in re.split(r"[\s,]+", (data.text or "").strip()) if v]
        if len(gids) != width * height:
            raise ExtractError(f"{path.name}: layer {name!r} has {len(gids)} tiles, expected {width * height}")
        if any(g & FLIP_MASK for g in gids):
            raise ExtractError(f"{path.name}: layer {name!r} uses flipped tiles")
        layers[name] = gids
    overrides: dict[str, dict[tuple[int, int], dict[str, str]]] = {}
    for group in root.findall("objectgroup"):
        cells = overrides.setdefault(group.get("name", ""), {})
        for obj in group.findall("object"):
            if obj.get("name") != "TileData":
                continue
            cell = (int(float(obj.get("x", "0"))) // 16, int(float(obj.get("y", "0"))) // 16)
            cells.setdefault(cell, {}).update(_properties(obj.find("properties")))
    return TmxMap(width, height, layers, tilesets, _properties(root.find("properties")), overrides, path.name, draw_as)


def _tile_properties(tmx: TmxMap, gid: int) -> dict[str, str]:
    for tileset in reversed(tmx.tilesets):
        if gid >= tileset.first_gid:
            return tileset.tile_properties.get(gid - tileset.first_gid, {})
    raise ExtractError(f"{tmx.name}: gid {gid} belongs to no tileset")


def _check(tmx: TmxMap, layer: str, where: str, props: dict[str, str]) -> None:
    for name, value in props.items():
        if name in USED_VALUES:
            if value not in USED_VALUES[name]:
                raise ExtractError(f"{tmx.name}: {layer} {where}: unexpected value {value!r} for property {name}")
        elif name not in IGNORED_PROPERTIES:
            raise ExtractError(f"{tmx.name}: {layer} {where}: unknown tile property {name!r}")


def _cell_properties(tmx: TmxMap, layer: str, index: int) -> dict[str, str]:
    """Tileset properties of the cell's tile merged with its TileData override (the override wins)."""
    x, y = index % tmx.width, index // tmx.width
    gid = tmx.layers[layer][index]
    props = dict(_tile_properties(tmx, gid)) if gid else {}
    props.update(tmx.overrides.get(layer, {}).get((x, y), {}))
    _check(tmx, layer, f"({x}, {y})", props)
    return props


def warp_tiles(tmx: TmxMap) -> set[tuple[int, int]]:
    """Tiles of the `Warp` map property (groups of `x y targetMap tx ty`) that lie inside the map.

    Walking onto one leaves the farm, so nothing can stand there. Edge warps sit one tile
    outside the map (x = -1, y = height...) and are ignored.
    """
    parts = tmx.properties.get("Warp", "").split()
    if len(parts) % 5:
        raise ExtractError(f"{tmx.name}: map property Warp is not groups of 'x y map x y': {len(parts)} values")
    tiles = set()
    for i in range(0, len(parts), 5):
        x, y, _, tx, ty = parts[i : i + 5]
        if not all(v.lstrip("-").isdigit() for v in (x, y, tx, ty)):
            raise ExtractError(f"{tmx.name}: map property Warp has a non-integer tile: {' '.join(parts[i : i + 5])!r}")
        if 0 <= int(x) < tmx.width and 0 <= int(y) < tmx.height:
            tiles.add((int(x), int(y)))
    return tiles


def classify(tmx: TmxMap) -> list[str]:
    for layer in PLANNER_LAYERS:
        if layer not in tmx.layers:
            raise ExtractError(f"{tmx.name}: missing layer {layer}")
    for layer in PLANNER_LAYERS:  # overrides outside the grid or with unknown properties must fail too
        for (x, y), props in tmx.overrides.get(layer, {}).items():
            _check(tmx, layer, f"override ({x}, {y})", props)
    codes = []
    for i in range(tmx.width * tmx.height):
        back = tmx.layers["Back"][i]
        buildings = tmx.layers["Buildings"][i]
        back_props = _cell_properties(tmx, "Back", i)
        buildings_props = _cell_properties(tmx, "Buildings", i)
        if not back or (buildings and buildings_props.get("Passable") != "T"):
            codes.append("x")
        elif back_props.get("Water") == "T":
            codes.append("w")
        else:
            diggable = back_props.get("Diggable") == "T"
            buildable = back_props.get("Buildable")
            if diggable and buildable not in BUILDABLE_NO:
                codes.append("b")
            elif buildable in BUILDABLE_YES:
                codes.append("c")
            elif diggable:
                codes.append("d")
            else:
                codes.append("f")
    for x, y in warp_tiles(tmx):
        codes[y * tmx.width + x] = "x"
    return codes


def rle(codes: list[str]) -> str:
    out = []
    i = 0
    while i < len(codes):
        j = i
        while j < len(codes) and codes[j] == codes[i]:
            j += 1
        out.append(f"{j - i}{codes[i]}")
        i = j
    return "".join(out)


def unrle(text: str) -> list[str]:
    if text and not re.fullmatch(r"(?:\d+[a-z])+", text):
        raise ExtractError(f"invalid run-length text {text!r}")
    codes: list[str] = []
    for count, code in re.findall(r"(\d+)([a-z])", text):
        codes.extend(code * int(count))
    return codes


def _point(tmx: TmxMap, key: str) -> tuple[int, int] | None:
    value = tmx.properties.get(key)
    if value is None:
        return None
    parts = value.split()
    if len(parts) != 2 or not all(p.lstrip("-").isdigit() for p in parts):
        raise ExtractError(f"{tmx.name}: map property {key} is not an 'x y' pair: {value!r}")
    return int(parts[0]), int(parts[1])


def fixed_objects(tmx: TmxMap, farm_id: str) -> list[dict]:
    """Farmhouse, greenhouse, shipping bin and pet bowl as {t, x, y} with the top-left tile."""
    if farm_id not in FARMS:
        raise ExtractError(f"unknown farm id {farm_id!r}")
    entry = _point(tmx, "FarmHouseEntry") or (64, 15)
    farmhouse = (entry[0] - FARMHOUSE_ENTRY_TO_TOP_LEFT[0], entry[1] - FARMHOUSE_ENTRY_TO_TOP_LEFT[1])
    greenhouse = _point(tmx, "GreenhouseLocation") or GREENHOUSE_DEFAULTS.get(farm_id, (25, 10))
    shipping_bin = _point(tmx, "ShippingBinLocation") or (71, 14)
    pet_bowl = _point(tmx, "PetBowlLocation") or (53, 7)
    return [
        {"t": t, "x": x, "y": y}
        for t, (x, y) in (
            ("farmhouse", farmhouse),
            ("greenhouse", greenhouse),
            ("shipping-bin", shipping_bin),
            ("pet-bowl", pet_bowl),
        )
    ]


def fixed_sizes(buildings_json: dict) -> dict[str, tuple[int, int]]:
    """Footprint (w, h) of each fixed building, by planner id, from Data/Buildings.json."""
    sizes = {}
    for key, building in buildings_json.items():
        object_id = _slug(key)
        if object_id in FIXED_BUILDINGS:
            sizes[object_id] = (building["Size"]["X"], building["Size"]["Y"])
    return sizes


def clear_fixed_footprints(
    codes: list[str], width: int, height: int, fixed: list[dict], sizes: dict[str, tuple[int, int]]
) -> list[str]:
    """Free (`f`) tiles under a fixed building's starting footprint become buildable (`c`).

    The game places these buildings there itself, whatever the tiles say (the Beach farmhouse
    stands on a `Buildable=f` path tile), so a new plan must not start with a placement error.
    """
    out = list(codes)
    for obj in fixed:
        if obj["t"] not in sizes:
            raise ExtractError(f"no Data/Buildings.json size for fixed object {obj['t']}")
        w, h = sizes[obj["t"]]
        for y in range(max(0, obj["y"]), min(height, obj["y"] + h)):
            for x in range(max(0, obj["x"]), min(width, obj["x"] + w)):
                if out[y * width + x] == "f":
                    out[y * width + x] = "c"
    return out


# ---------------------------------------------------------------- backgrounds

TILE = 16
DRAWN_LAYERS = ("Back", "Buildings", "Front")  # Paths is data, AlwaysFront* would hide the ground


def _tileset_image(tileset: Tileset) -> Path:
    image = tileset.image
    if not image.exists() and not image.suffix:  # the game's maps name sheets without the extension
        image = image.with_suffix(".png")
    if not image.exists():
        raise ExtractError(f"tileset image not found: {tileset.image}")
    return image


def render_background(tmx: TmxMap, out: Path) -> None:
    """Draws the Back, Buildings and Front layers (and layers drawn as them) into a lossless WebP."""
    from PIL import Image  # dev dependency, only needed when rendering

    sheets = {}
    for tileset in tmx.tilesets:
        with Image.open(_tileset_image(tileset)) as sheet:
            sheets[tileset.first_gid] = sheet.convert("RGBA")
    tiles: dict[int, Image.Image] = {}

    def tile(gid: int) -> Image.Image:
        if gid not in tiles:
            tileset = next((t for t in reversed(tmx.tilesets) if gid >= t.first_gid), None)
            if tileset is None:
                raise ExtractError(f"{tmx.name}: gid {gid} belongs to no tileset")
            index = gid - tileset.first_gid
            left, top = (index % tileset.columns) * TILE, (index // tileset.columns) * TILE
            sheet = sheets[tileset.first_gid]
            if left + TILE > sheet.width or top + TILE > sheet.height:
                raise ExtractError(f"{tmx.name}: gid {gid} lies outside {tileset.image.name}")
            tiles[gid] = sheet.crop((left, top, left + TILE, top + TILE))
        return tiles[gid]

    canvas = Image.new("RGBA", (tmx.width * TILE, tmx.height * TILE))
    for drawn in DRAWN_LAYERS:
        for name, gids in tmx.layers.items():
            if tmx.draw_as.get(name, name) != drawn:
                continue
            for i, gid in enumerate(gids):
                if gid:
                    canvas.alpha_composite(tile(gid), ((i % tmx.width) * TILE, (i // tmx.width) * TILE))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "WEBP", lossless=True, method=6)


# ---------------------------------------------------------------- planner catalog

PLANNER_TYPE = "planner-objects"
FIXED_BUILDINGS = {"farmhouse", "greenhouse", "shipping-bin", "pet-bowl"}
ANY_PLACEMENT_BUILDINGS = {"shipping-bin", "pet-bowl"}
# Fixed buildings without a `buildings/` file carry their own name (Strings/Buildings, Data/Buildings.json).
OWN_BUILDING_NAMES = {
    "farmhouse": ({"en": "Farmhouse", "pt-BR": "Casa da fazenda"}, False),
    "greenhouse": ({"en": "Greenhouse", "pt-BR": "Estufa"}, True),
    "pet-bowl": ({"en": "Pet Bowl", "pt-BR": "Tigela para Animal"}, True),
}
TILLED_SOIL = {"en": "Tilled Soil", "pt-BR": "Terra arada"}
SPRINKLERS = {
    "sprinkler": ("diamond", 1),
    "quality-sprinkler": ("square", 1),
    "iridium-sprinkler": ("square", 2),
}
SCARECROWS = {"scarecrow": ("circle", 8), "deluxe-scarecrow": ("circle", 16)}
RARECROW_RANGE = ("circle", 8)
# Attachments and tree-only machines cannot stand alone on a farm tile
NON_STANDALONE_MACHINES = {"pressure-nozzle", "enricher", "tapper", "heavy-tapper"}
EXTRA_MACHINES = ("bee-house", "keg", "preserves-jar", "furnace", "crystalarium", "chest")
FENCES = ("wood-fence", "stone-fence", "iron-fence", "hardwood-fence")
DECORATION_FOLDERS = ("craftables", "furniture")
GENERATED_FOLDERS = ("farms", PLANNER_TYPE)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _load_items(data_dir: Path) -> dict[str, dict[str, dict]]:
    """folder -> id -> document, for every data folder except the generated ones."""
    items: dict[str, dict[str, dict]] = {}
    for path in sorted(Path(data_dir).glob("*/*.json")):
        folder = path.parent.name
        if folder.startswith("_") or folder in GENERATED_FOLDERS:
            continue
        items.setdefault(folder, {})[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return items


def _warn(message: str) -> None:
    print(f"warning: {message}")


def planner_catalog(buildings_json: dict, data_dir: Path) -> list[dict]:
    """The planner's object catalog. Listed ids missing from the data are skipped with a warning."""
    items = _load_items(data_dir)
    catalog: dict[str, dict] = {}

    def add(object_id: str, category: str, placement: str, *, folders: tuple[str, ...] = (), **extra) -> None:
        if object_id in catalog:
            return
        entry: dict = {"id": object_id, "type": PLANNER_TYPE}
        if folders:
            doc = next((items[f][object_id] for f in folders if object_id in items.get(f, {})), None)
            if doc is None:
                _warn(f"{object_id}: not found in {', '.join(f'{f}/' for f in folders)}; skipped")
                return
            entry["name"] = doc["name"]
            if "nameVerified" in doc:
                entry["nameVerified"] = doc["nameVerified"]
            entry["item"] = object_id
        size = extra.pop("size", {"w": 1, "h": 1})
        entry |= {"category": category, "placement": placement, "size": size}
        entry |= extra
        entry.setdefault("paint", False)
        entry.setdefault("removable", True)
        catalog[object_id] = entry

    # Buildings: footprint and doors from Data/Buildings.json
    with_entry = set()
    for key, building in buildings_json.items():
        object_id = _slug(key)
        with_entry.add(object_id)
        extra: dict = {"size": {"w": building["Size"]["X"], "h": building["Size"]["Y"]}}
        door = building.get("HumanDoor") or {}
        if door.get("X", -1) >= 0 and door.get("Y", -1) >= 0:
            extra["humanDoor"] = {"x": door["X"], "y": door["Y"]}
        door = building.get("AnimalDoor") or {}
        if door.get("X", -1) >= 0 and door.get("Width", 0) > 0 and door.get("Height", 0) > 0:
            extra["animalDoor"] = {"x": door["X"], "y": door["Y"], "w": door["Width"], "h": door["Height"]}
        placement = "any" if object_id in ANY_PLACEMENT_BUILDINGS else "buildable"
        extra["removable"] = object_id not in FIXED_BUILDINGS
        if object_id in OWN_BUILDING_NAMES:
            name, verified = OWN_BUILDING_NAMES[object_id]
            catalog[object_id] = {"id": object_id, "type": PLANNER_TYPE, "name": name, "nameVerified": verified}
            catalog[object_id] |= {"icon": None, "category": "building", "placement": placement}
            catalog[object_id] |= {"size": extra.pop("size")} | extra | {"paint": False}
        else:
            add(object_id, "building", placement, folders=("buildings",), **extra)
    for object_id in sorted(set(items.get("buildings", {})) - with_entry):
        _warn(f"buildings/{object_id}: no Data/Buildings.json entry; skipped")

    # Planting
    catalog["tilled-soil"] = {"id": "tilled-soil", "type": PLANNER_TYPE, "name": TILLED_SOIL, "nameVerified": False}
    catalog["tilled-soil"] |= {"icon": None, "category": "planting", "placement": "diggable", "size": {"w": 1, "h": 1}}
    catalog["tilled-soil"] |= {"paint": True, "removable": True}
    for object_id, (shape, radius) in SPRINKLERS.items():
        add(object_id, "planting", "any", folders=("machines",), range={"shape": shape, "radius": radius})
    for object_id, (shape, radius) in SCARECROWS.items():
        add(object_id, "planting", "any", folders=("craftables",), range={"shape": shape, "radius": radius})
    rarecrows = sorted({i for docs in items.values() for i in docs if i.startswith("rarecrow-")})
    if not rarecrows:
        _warn("rarecrow-*: none found in the data; skipped")
    for object_id in rarecrows:
        shape, radius = RARECROW_RANGE
        add(object_id, "planting", "any", folders=tuple(items), range={"shape": shape, "radius": radius})
    for object_id in sorted(items.get("fruit-trees", {})):
        add(object_id, "planting", "diggable", folders=("fruit-trees",))

    # Machines
    for object_id in sorted(set(items.get("machines", {})) - set(SPRINKLERS) - NON_STANDALONE_MACHINES):
        add(object_id, "machine", "any", folders=("machines",))
    for object_id in EXTRA_MACHINES:
        add(object_id, "machine", "any", folders=("craftables",))

    # Decoration: fences, gate, paths and floors
    for object_id in FENCES:
        add(object_id, "decoration", "any", folders=DECORATION_FOLDERS, paint=True)
    add("gate", "decoration", "any", folders=DECORATION_FOLDERS)
    surfaces = sorted({i for f in DECORATION_FOLDERS for i in items.get(f, {}) if re.search(r"-(path|floor)$", i)})
    for object_id in surfaces:
        add(object_id, "decoration", "any", folders=DECORATION_FOLDERS, paint=True)

    return [catalog[i] for i in sorted(catalog)]


# ---------------------------------------------------------------- main

# English and pt-BR names from the game: Strings/UI Character_Farm* and Strings/1_6_Strings Farm_Ranching_Description
FARM_NAMES = {
    "standard": ("Standard Farm", "Fazenda Padrão"),
    "riverland": ("Riverland Farm", "Fazenda entre Rios"),
    "forest": ("Forest Farm", "Fazenda na Floresta"),
    "hilltop": ("Hill-top Farm", "Fazenda na Colina"),
    "wilderness": ("Wilderness Farm", "Fazenda Remota"),
    "four-corners": ("Four Corners Farm", "Fazenda Quatro Cantos"),
    "beach": ("Beach Farm", "Fazenda da Praia"),
    "meadowlands": ("Meadowlands Farm", "Fazenda dos Prados"),
}


def _dump(path: Path, doc) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _farm(tmx: TmxMap, farm_id: str, sizes: dict[str, tuple[int, int]]) -> dict:
    fixed = fixed_objects(tmx, farm_id)
    codes = clear_fixed_footprints(classify(tmx), tmx.width, tmx.height, fixed, sizes)
    tiles = rle(codes)
    if len(unrle(tiles)) != tmx.width * tmx.height:
        raise ExtractError(f"{tmx.name}: run-length text does not decode to {tmx.width} x {tmx.height}")
    en, pt = FARM_NAMES[farm_id]
    return {
        "id": farm_id,
        "type": "farms",
        "name": {"en": en, "pt-BR": pt},
        "nameVerified": True,
        "width": tmx.width,
        "height": tmx.height,
        "tiles": tiles,
        "fixed": fixed,
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: build_farm_maps.py <content-unpacked> <data-dir> <farms-out-dir>", file=sys.stderr)
        return 2
    content, data_dir, farms_out = (Path(a) for a in argv)
    missing = [f"Maps/{m}.tmx" for m in FARMS.values() if not (content / "Maps" / f"{m}.tmx").is_file()]
    if not (content / "Data" / "Buildings.json").is_file():
        missing.append("Data/Buildings.json")
    if missing:
        print(f"error: missing in {content}: {', '.join(missing)}; nothing written", file=sys.stderr)
        return 1

    staging = Path(tempfile.mkdtemp(prefix="farm-maps-"))
    try:
        buildings = json.loads((content / "Data" / "Buildings.json").read_text(encoding="utf-8"))
        sizes = fixed_sizes(buildings)
        for farm_id, map_name in FARMS.items():
            tmx = read_tmx(content / "Maps" / f"{map_name}.tmx")
            _dump(staging / "farms" / f"{farm_id}.json", _farm(tmx, farm_id, sizes))
            render_background(tmx, staging / "backgrounds" / f"{farm_id}.webp")
            print(f"{farm_id}: {tmx.width} x {tmx.height}")
        for entry in planner_catalog(buildings, data_dir):
            _dump(staging / PLANNER_TYPE / f"{entry['id']}.json", entry)
    except (ExtractError, OSError, KeyError, ValueError) as error:
        shutil.rmtree(staging, ignore_errors=True)
        print(f"error: {error}; nothing written", file=sys.stderr)
        return 1

    # Every farm succeeded: move the results into place
    for folder in GENERATED_FOLDERS:
        shutil.rmtree(data_dir / folder, ignore_errors=True)
        shutil.move(staging / folder, data_dir / folder)
    farms_out.mkdir(parents=True, exist_ok=True)
    for old in farms_out.glob("*.webp"):
        old.unlink()
    for webp in sorted((staging / "backgrounds").glob("*.webp")):
        shutil.move(webp, farms_out / webp.name)
    shutil.rmtree(staging, ignore_errors=True)

    index_path = data_dir / "_meta" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    for folder in GENERATED_FOLDERS:
        index[folder] = sorted(p.stem for p in (data_dir / folder).glob("*.json"))
    _dump(index_path, {k: index[k] for k in sorted(index)})
    print(f"farms {len(index['farms'])}, {PLANNER_TYPE} {len(index[PLANNER_TYPE])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
