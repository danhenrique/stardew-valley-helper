"""Farm terrain extractor, tested against a hand-made fictitious map (no game content)."""

import importlib.util
import json
import shutil
import sys
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).parent
FIXTURES = ROOT / "fixtures" / "tmx"
SCRIPT = ROOT.parent / "scripts" / "build_farm_maps.py"

_spec = importlib.util.spec_from_file_location("build_farm_maps", SCRIPT)
assert _spec is not None and _spec.loader is not None
farm_maps = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = farm_maps  # dataclasses resolve annotations through sys.modules
_spec.loader.exec_module(farm_maps)


def _grid(codes, width):
    return ["".join(codes[i : i + width]) for i in range(0, len(codes), width)]


def test_farms_table():
    assert farm_maps.FARMS["standard"] == "Farm"
    assert farm_maps.FARMS["beach"] == "Farm_Island"
    assert len(farm_maps.FARMS) == 8


def test_rle_round_trip():
    codes = list("xxxxddbw")
    assert farm_maps.rle(codes) == "4x2d1b1w"
    assert farm_maps.unrle("4x2d1b1w") == codes


def test_rle_empty_and_bad_input():
    assert farm_maps.rle([]) == ""
    assert farm_maps.unrle("") == []
    with pytest.raises(farm_maps.ExtractError):
        farm_maps.unrle("4x2")


def test_read_tmx_structure():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    assert (tmx.width, tmx.height) == (6, 4)
    assert set(tmx.layers) == {"Back", "Buildings", "Paths"}
    assert len(tmx.layers["Back"]) == 24
    assert tmx.tilesets[0].first_gid == 1
    assert tmx.tilesets[0].columns == 4
    assert tmx.tilesets[0].image.name == "tiny-sheet.png"
    assert tmx.tilesets[0].tile_properties[2] == {"Diggable": "T", "Buildable": "f"}
    assert tmx.properties["FarmHouseEntry"] == "8 6"


def test_classify_tiny_map_exercises_all_codes():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    codes = farm_maps.classify(tmx)
    assert _grid(codes, 6) == [
        "xxxxxx",  # impassable Buildings wall
        "xbdcwx",  # warp (free tile), diggable+buildable, diggable only, buildable only, water, void
        "bdfcbf",  # (1,2) is diggable+buildable turned into d by a TileData Buildable=f override;
        # (2,2) is free under a passable Buildings tile
        "xffffx",  # walls at both ends
    ]
    assert set("xwbcdf") == set(codes)


def test_should_block_in_map_warp_tiles_when_the_map_has_a_warp_property():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    tmx.properties.pop("Warp")
    assert farm_maps.classify(tmx)[1 * 6 + 0] == "f"  # the warp tile is free terrain by itself
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    # (0, 1) is in the map; (6, 2), (2, -1) and (-1, 3) are edge warps outside it and are ignored.
    assert farm_maps.warp_tiles(tmx) == {(0, 1)}
    assert farm_maps.classify(tmx)[1 * 6 + 0] == "x"


def test_should_keep_a_warp_tile_blocked_when_a_fixed_object_stands_on_it(tmp_path):
    path = _tmx_with(
        tmp_path, '<property name="PetBowlLocation" value="4 1"/>', '<property name="PetBowlLocation" value="0 1"/>'
    )
    farm = farm_maps._farm(farm_maps.read_tmx(path), "standard", FIXED_SIZES)
    assert {"t": "pet-bowl", "x": 0, "y": 1} in farm["fixed"]
    assert farm_maps.unrle(farm["tiles"])[1 * 6 + 0] == "x"


@pytest.mark.parametrize("value", ["1 1 BusStop 0", "a 1 BusStop 0 0"])
def test_should_fail_when_the_warp_property_is_malformed(tmp_path, value):
    path = _tmx_with(tmp_path, 'value="0 1 BusStop 0 0 6 2', f'value="{value} 6 2')
    with pytest.raises(farm_maps.ExtractError, match="Warp"):
        farm_maps.classify(farm_maps.read_tmx(path))


def test_classify_ignores_paths_layer_and_buildings_tile_properties():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    tmx.layers["Paths"][7] = 2  # a Paths tile must never change the result
    assert farm_maps.classify(tmx)[7] == "b"


def test_fixed_objects_from_map_property_override():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    objs = farm_maps.fixed_objects(tmx, "standard")
    assert {"t": "farmhouse", "x": 3, "y": 3} in objs  # entry (8, 6) -> top-left (3, 3)
    assert {"t": "pet-bowl", "x": 4, "y": 1} in objs


def test_fixed_objects_defaults():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    objs = farm_maps.fixed_objects(tmx, "standard")
    assert {"t": "greenhouse", "x": 25, "y": 10} in objs
    assert {"t": "shipping-bin", "x": 71, "y": 14} in objs
    assert [o["t"] for o in objs] == ["farmhouse", "greenhouse", "shipping-bin", "pet-bowl"]


@pytest.mark.parametrize(
    ("farm_id", "farmhouse", "greenhouse", "bin_", "bowl"),
    [
        ("standard", (59, 12), (25, 10), (71, 14), (53, 7)),
        ("four-corners", (59, 12), (36, 29), (71, 14), (49, 40)),
        ("beach", (59, 12), (14, 14), (71, 14), (78, 21)),
        ("meadowlands", (76, 16), (37, 19), (88, 18), (91, 14)),
    ],
)
def test_fixed_object_defaults_per_farm(farm_id, farmhouse, greenhouse, bin_, bowl):
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    tmx.properties.clear()
    if farm_id == "meadowlands":  # the real map carries these as properties
        tmx.properties.update(
            FarmHouseEntry="81 19", GreenhouseLocation="37 19", ShippingBinLocation="88 18", PetBowlLocation="91 14"
        )
    elif farm_id in ("four-corners", "beach"):
        tmx.properties["PetBowlLocation"] = f"{bowl[0]} {bowl[1]}"
    got = {o["t"]: (o["x"], o["y"]) for o in farm_maps.fixed_objects(tmx, farm_id)}
    assert got == {"farmhouse": farmhouse, "greenhouse": greenhouse, "shipping-bin": bin_, "pet-bowl": bowl}


FIXED_SIZES = {"farmhouse": (2, 2), "greenhouse": (1, 1), "shipping-bin": (1, 1), "pet-bowl": (1, 1)}


def test_fixed_footprints_turn_free_tiles_buildable():
    codes = list("".join(["ffff", "fwdf", "fbff"]))
    fixed = [{"t": "farmhouse", "x": 1, "y": 1}, {"t": "pet-bowl", "x": 3, "y": 2}]
    got = farm_maps.clear_fixed_footprints(codes, 4, 3, fixed, FIXED_SIZES)
    # Only `f` under a footprint changes; water, diggable and buildable keep their codes.
    assert _grid(got, 4) == ["ffff", "fwdf", "fbcc"]
    assert codes == list("".join(["ffff", "fwdf", "fbff"]))  # the input is not modified


def test_fixed_footprints_are_clamped_to_the_map():
    got = farm_maps.clear_fixed_footprints(list("ffff"), 2, 2, [{"t": "farmhouse", "x": 1, "y": 1}], FIXED_SIZES)
    assert _grid(got, 2) == ["ff", "fc"]


def test_fixed_footprint_without_a_size_fails():
    with pytest.raises(farm_maps.ExtractError, match="greenhouse"):
        farm_maps.clear_fixed_footprints(list("f"), 1, 1, [{"t": "greenhouse", "x": 0, "y": 0}], {})


def test_fixed_sizes_come_from_buildings_json():
    buildings = {"Farmhouse": {"Size": {"X": 9, "Y": 5}}, "Pet Bowl": {"Size": {"X": 2, "Y": 2}}, "Barn": BARN}
    assert farm_maps.fixed_sizes(buildings) == {"farmhouse": (9, 5), "pet-bowl": (2, 2)}


def test_unknown_farm_id_fails():
    tmx = farm_maps.read_tmx(FIXTURES / "tiny.tmx")
    with pytest.raises(farm_maps.ExtractError, match="nowhere"):
        farm_maps.fixed_objects(tmx, "nowhere")


def _tmx_with(tmp_path, old, new):
    text = (FIXTURES / "tiny.tmx").read_text(encoding="utf-8")
    assert old in text
    path = tmp_path / "bad.tmx"
    path.write_text(text.replace(old, new), encoding="utf-8")
    return path


def test_unknown_tile_property_fails_loudly(tmp_path):
    bad = _tmx_with(tmp_path, '<property name="Water" value="T"/>', '<property name="Mystery" value="T"/>')
    with pytest.raises(farm_maps.ExtractError, match="Mystery"):
        farm_maps.classify(farm_maps.read_tmx(bad))


def test_unknown_value_of_used_property_fails_loudly(tmp_path):
    bad = _tmx_with(tmp_path, '<property name="Water" value="T"/>', '<property name="Water" value="maybe"/>')
    with pytest.raises(farm_maps.ExtractError, match="Water"):
        farm_maps.classify(farm_maps.read_tmx(bad))


def test_unknown_override_property_fails_loudly(tmp_path):
    bad = _tmx_with(
        tmp_path,
        '<property name="Buildable" value="f"/></properties>\n  </object>',
        '<property name="Odd" value="1"/></properties>\n  </object>',
    )
    with pytest.raises(farm_maps.ExtractError, match="Odd"):
        farm_maps.classify(farm_maps.read_tmx(bad))


def test_non_csv_encoding_fails(tmp_path):
    bad = _tmx_with(tmp_path, 'encoding="csv">\n1,1', 'encoding="base64">\n1,1')
    with pytest.raises(farm_maps.ExtractError, match="encoding"):
        farm_maps.read_tmx(bad)


# ---------------------------------------------------------------- backgrounds, catalog, main

BARN = {
    "Size": {"X": 7, "Y": 4},
    "HumanDoor": {"X": 1, "Y": 3},
    "AnimalDoor": {"X": 5, "Y": 3, "Width": 1, "Height": 1},
}
NO_DOOR = {"HumanDoor": {"X": -1, "Y": -1}, "AnimalDoor": {"X": -1, "Y": -1, "Width": 0, "Height": 0}}


def _write(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")


def _item(data_dir: Path, folder: str, item_id: str, en: str = "Thing", pt: str = "Coisa") -> None:
    _write(data_dir / folder / f"{item_id}.json", {"id": item_id, "type": folder, "name": {"en": en, "pt-BR": pt}})


def test_render_background_size(tmp_path):
    out = tmp_path / "tiny.webp"
    farm_maps.render_background(farm_maps.read_tmx(FIXTURES / "tiny.tmx"), out)
    with Image.open(out) as image:
        assert image.format == "WEBP"
        assert image.size == (6 * 16, 4 * 16)


def test_render_background_draws_back_then_buildings(tmp_path):
    out = tmp_path / "tiny.webp"
    farm_maps.render_background(farm_maps.read_tmx(FIXTURES / "tiny.tmx"), out)
    with Image.open(FIXTURES / "tiny-sheet.png") as sheet, Image.open(out) as image:
        rgb = image.convert("RGB")
        # (0, 0) has Buildings gid 6 on top of Back gid 1: the Buildings tile wins
        assert rgb.getpixel((8, 8)) == sheet.convert("RGB").getpixel((1 * 16 + 8, 1 * 16 + 8))
        # (1, 1) only has Back gid 2
        assert rgb.getpixel((16 + 8, 16 + 8)) == sheet.convert("RGB").getpixel((1 * 16 + 8, 8))


def test_catalog_building_uses_buildings_json(tmp_path):
    _item(tmp_path, "buildings", "barn", "Barn", "Celeiro")
    catalog = {o["id"]: o for o in farm_maps.planner_catalog({"Barn": BARN}, tmp_path)}
    barn = catalog["barn"]
    assert (
        barn
        | {
            "id": "barn",
            "type": "planner-objects",
            "item": "barn",
            "category": "building",
            "size": {"w": 7, "h": 4},
            "placement": "buildable",
            "humanDoor": {"x": 1, "y": 3},
            "animalDoor": {"x": 5, "y": 3, "w": 1, "h": 1},
            "paint": False,
            "removable": True,
        }
        == barn
    )
    assert barn["name"] == {"en": "Barn", "pt-BR": "Celeiro"}


def test_catalog_fixed_buildings_are_not_removable(tmp_path):
    _item(tmp_path, "buildings", "shipping-bin")
    buildings = {
        "Farmhouse": {"Size": {"X": 9, "Y": 5}, "HumanDoor": {"X": 5, "Y": 2}, "AnimalDoor": NO_DOOR["AnimalDoor"]},
        "Greenhouse": {"Size": {"X": 7, "Y": 6}, **NO_DOOR},
        "Shipping Bin": {"Size": {"X": 2, "Y": 1}, **NO_DOOR},
        "Pet Bowl": {"Size": {"X": 2, "Y": 2}, **NO_DOOR},
    }
    catalog = {o["id"]: o for o in farm_maps.planner_catalog(buildings, tmp_path)}
    for fixed in ("farmhouse", "greenhouse", "shipping-bin", "pet-bowl"):
        assert catalog[fixed]["removable"] is False
        assert catalog[fixed]["category"] == "building"
    assert catalog["farmhouse"]["humanDoor"] == {"x": 5, "y": 2}
    assert "animalDoor" not in catalog["farmhouse"]
    assert "item" not in catalog["farmhouse"] and catalog["farmhouse"]["name"]["en"] == "Farmhouse"
    assert catalog["shipping-bin"]["item"] == "shipping-bin"
    assert catalog["shipping-bin"]["placement"] == "any"
    assert catalog["pet-bowl"]["placement"] == "any"
    assert catalog["greenhouse"]["placement"] == "buildable"


def test_catalog_planting_machine_and_decoration(tmp_path, capsys):
    for i in ("sprinkler", "quality-sprinkler", "iridium-sprinkler", "keg", "tapper", "pressure-nozzle", "heater"):
        _item(tmp_path, "machines", i)
    for i in ("scarecrow", "chest", "wood-fence", "gate", "wood-floor", "gravel-path", "torch"):
        _item(tmp_path, "craftables", i)
    _item(tmp_path, "furniture", "rarecrow-3")
    _item(tmp_path, "furniture", "crystal-path")
    _item(tmp_path, "fruit-trees", "apple-sapling")
    catalog = {o["id"]: o for o in farm_maps.planner_catalog({}, tmp_path)}

    assert (
        catalog["tilled-soil"]
        | {
            "name": {"en": "Tilled Soil", "pt-BR": "Terra arada"},
            "icon": None,
            "category": "planting",
            "placement": "diggable",
            "size": {"w": 1, "h": 1},
            "paint": True,
        }
        == catalog["tilled-soil"]
    )
    assert catalog["sprinkler"]["range"] == {"shape": "diamond", "radius": 1}
    assert catalog["quality-sprinkler"]["range"] == {"shape": "square", "radius": 1}
    assert catalog["iridium-sprinkler"]["range"] == {"shape": "square", "radius": 2}
    assert catalog["scarecrow"]["range"] == {"shape": "circle", "radius": 8}
    assert catalog["rarecrow-3"]["range"] == {"shape": "circle", "radius": 8}
    assert {catalog[i]["category"] for i in ("sprinkler", "scarecrow", "rarecrow-3", "apple-sapling")} == {"planting"}
    assert catalog["apple-sapling"]["placement"] == "diggable"
    assert catalog["keg"]["category"] == catalog["chest"]["category"] == "machine"
    assert catalog["keg"]["placement"] == "any"
    for i in ("wood-fence", "wood-floor", "gravel-path", "crystal-path"):
        assert (catalog[i]["category"], catalog[i]["paint"]) == ("decoration", True)
    assert (catalog["gate"]["category"], catalog["gate"]["paint"]) == ("decoration", False)
    assert "torch" not in catalog
    assert "tapper" not in catalog and "pressure-nozzle" not in catalog  # tree-only machine, attachment
    assert catalog["heater"]["category"] == "machine"
    assert all(o["size"] == {"w": 1, "h": 1} for o in catalog.values())
    assert all(o.get("item") == o["id"] for o in catalog.values() if o["id"] != "tilled-soil")
    out = capsys.readouterr().out
    assert "deluxe-scarecrow" in out and "stone-fence" in out  # listed but missing: warned, never invented
    assert "deluxe-scarecrow" not in catalog


def test_catalog_skips_building_without_data_file(tmp_path, capsys):
    catalog = farm_maps.planner_catalog({"Barn": BARN}, tmp_path)
    assert "barn" not in {o["id"] for o in catalog}
    assert "barn" in capsys.readouterr().out


FIXED_NAMES = ("Farmhouse", "Greenhouse", "Shipping Bin", "Pet Bowl")


def _content_dir(tmp_path: Path, maps: list[str]) -> Path:
    content = tmp_path / "content"
    (content / "Maps").mkdir(parents=True)
    shutil.copy(FIXTURES / "tiny-sheet.png", content / "Maps" / "tiny-sheet.png")
    for name in maps:
        shutil.copy(FIXTURES / "tiny.tmx", content / "Maps" / f"{name}.tmx")
    buildings = {"Barn": BARN} | {name: {"Size": {"X": 1, "Y": 1}, **NO_DOOR} for name in FIXED_NAMES}
    _write(content / "Data" / "Buildings.json", buildings)
    return content


def _data_dir(tmp_path: Path) -> Path:
    data = tmp_path / "data"
    _item(data, "buildings", "barn", "Barn", "Celeiro")
    _write(data / "_meta" / "index.json", {"buildings": ["barn"]})
    return data


def test_main_writes_nothing_when_a_map_is_missing(tmp_path):
    content = _content_dir(tmp_path, list(farm_maps.FARMS.values())[:7])
    data, farms = _data_dir(tmp_path), tmp_path / "farms"
    farms.mkdir()
    assert farm_maps.main([str(content), str(data), str(farms)]) == 1
    assert not (data / "farms").exists()
    assert not (data / "planner-objects").exists()
    assert list(farms.iterdir()) == []
    assert json.loads((data / "_meta" / "index.json").read_text()) == {"buildings": ["barn"]}


def test_main_writes_farms_catalog_backgrounds_and_index(tmp_path):
    content = _content_dir(tmp_path, list(farm_maps.FARMS.values()))
    data, farms = _data_dir(tmp_path), tmp_path / "farms"
    farms.mkdir()
    (farms / "NOTICE.txt").write_text("notice")
    assert farm_maps.main([str(content), str(data), str(farms)]) == 0

    assert sorted(p.name for p in farms.iterdir()) == sorted([*(f"{f}.webp" for f in farm_maps.FARMS), "NOTICE.txt"])
    standard = json.loads((data / "farms" / "standard.json").read_text())
    assert standard["type"] == "farms"
    assert standard["name"] == {"en": "Standard Farm", "pt-BR": "Fazenda Padrão"}
    assert standard["nameVerified"] is True
    assert (standard["width"], standard["height"]) == (6, 4)
    assert len(farm_maps.unrle(standard["tiles"])) == 24
    # The tiny map's farmhouse (entry 8 6, top-left 3 3) stands on a free tile, which becomes buildable.
    assert farm_maps.unrle(standard["tiles"])[3 * 6 + 3] == "c"
    assert [o["t"] for o in standard["fixed"]] == ["farmhouse", "greenhouse", "shipping-bin", "pet-bowl"]
    index = json.loads((data / "_meta" / "index.json").read_text())
    assert index["buildings"] == ["barn"]
    assert index["farms"] == sorted(farm_maps.FARMS)
    assert "barn" in index["planner-objects"] and "tilled-soil" in index["planner-objects"]
    assert sorted(p.stem for p in (data / "planner-objects").glob("*.json")) == index["planner-objects"]


DATA = ROOT.parent / "data"
ALLOWED = {"buildable": set("bc"), "diggable": set("db"), "any": set("fbcd")}


def _fixed_errors(farm: dict, catalog: dict) -> list[str]:
    """Error rules of the website's rules.ts (outside, blocked or wrong tile, overlap) for the fixed objects."""
    tiles = farm_maps.unrle(farm["tiles"])
    width, height = farm["width"], farm["height"]
    errors, taken = [], {}
    for obj in farm["fixed"]:
        object_def = catalog[obj["t"]]
        w, h = object_def["size"]["w"], object_def["size"]["h"]
        if obj["x"] < 0 or obj["y"] < 0 or obj["x"] + w > width or obj["y"] + h > height:
            errors.append(f"{obj['t']} outside")
            continue
        for y in range(obj["y"], obj["y"] + h):
            for x in range(obj["x"], obj["x"] + w):
                if tiles[y * width + x] not in ALLOWED[object_def["placement"]]:
                    errors.append(f"{obj['t']} on {tiles[y * width + x]!r} at ({x}, {y})")
                if (x, y) in taken:
                    errors.append(f"{obj['t']} overlaps {taken[(x, y)]} at ({x}, {y})")
                taken[(x, y)] = obj["t"]
    return errors


@pytest.mark.parametrize("farm_id", sorted(farm_maps.FARMS))
def test_committed_farm_starts_without_fixed_object_errors(farm_id):
    farm = json.loads((DATA / "farms" / f"{farm_id}.json").read_text(encoding="utf-8"))
    catalog = {
        t: json.loads((DATA / "planner-objects" / f"{t}.json").read_text(encoding="utf-8"))
        for t in {o["t"] for o in farm["fixed"]}
    }
    assert _fixed_errors(farm, catalog) == []
