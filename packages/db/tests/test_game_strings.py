"""Official pt-BR names read from the unpacked game content (scripts/game_strings.py)."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "game_strings.py"
_spec = importlib.util.spec_from_file_location("game_strings", SCRIPT)
assert _spec and _spec.loader
game_strings = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = game_strings
_spec.loader.exec_module(game_strings)


def _ref(sheet: str, key: str) -> str:
    return f"[LocalizedText Strings\\{sheet}:{key}]"


def _write(root: Path, rel: str, data) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8-sig")


def _pair(root: Path, rel: str, en, pt) -> None:
    _write(root, f"{rel}.json", en)
    _write(root, f"{rel}.pt-BR.json", pt)


@pytest.fixture
def content(tmp_path: Path) -> Path:
    root = tmp_path / "Content"
    _write(
        root,
        "Data/Objects.json",
        {
            "833": {"Name": "Pineapple Seeds", "DisplayName": _ref("Objects", "PineappleSeeds_Name")},
            "688": {"Name": "Warp Totem: Beach", "DisplayName": _ref("Objects", "WarpTotemBeach_Name")},
            "160": {"Name": "Angler", "DisplayName": _ref("Objects", "Angler_Name")},
            "9": {"Name": "Shared", "DisplayName": _ref("Objects", "Shared_Name")},
        },
    )
    _pair(
        root,
        "Strings/Objects",
        {
            "PineappleSeeds_Name": "Pineapple Seeds",
            "WarpTotemBeach_Name": "Warp Totem: Beach",
            "Angler_Name": "Angler",
            "Shared_Name": "Shared",
            "SmokedFish_CollectionsTabName": "Smoked Fish",
        },
        {
            "PineappleSeeds_Name": "Sementes de Abacaxi",
            "WarpTotemBeach_Name": "Totem de Teletransporte: Praia",
            "Angler_Name": "Tamboril",
            "Shared_Name": "Objeto",
            "SmokedFish_CollectionsTabName": "Peixe Defumado",
        },
    )
    _write(
        root,
        "Data/BigCraftables.json",
        {
            "105": {"Name": "Tapper", "DisplayName": _ref("BigCraftables", "Tapper_Name")},
            "9": {"Name": "Shared", "DisplayName": _ref("BigCraftables", "Shared_Name")},
        },
    )
    _pair(
        root,
        "Strings/BigCraftables",
        {"Tapper_Name": "Tapper", "Shared_Name": "Shared"},
        {"Tapper_Name": "Torneirinha", "Shared_Name": "Máquina"},
    )
    _write(root, "Data/Furniture.json", {"1": "Stone Cairn/decor/1 1/1 1/1/100/-1/" + _ref("Furniture", "StoneCairn")})
    _pair(root, "Strings/Furniture", {"StoneCairn": "Stone Cairn"}, {"StoneCairn": "Moledro"})
    _pair(root, "Strings/NPCNames", {"Abigail": "Abigail", "Dwarf": "Dwarf"}, {"Abigail": "Abigail", "Dwarf": "Anão"})
    _pair(
        root,
        "Data/Achievements",
        {"0": "Greenhorn (15k)^Earn 15,000g^true^-1^18"},
        {"0": "Dedo Verde (15 mil)^Ganhe 15.000 ouros.^true^-1^18"},
    )
    _pair(
        root,
        "Data/Bundles",
        {
            "Pantry/0": "Spring Crops/O 465 20/24 1 0/0///Spring Crops",
            "Vault/23": "2,500g/O 220 3/-1 2500 2500/4///2,500g",
        },
        {
            "Pantry/0": "Spring Crops/O 465 20/24 1 0/0///Plantações de Primavera",
            "Vault/23": "2,500g/O 220 3/-1 2500 2500/4///2.500 ouros",
        },
    )
    _pair(
        root,
        "Strings/BundleNames",
        {"Forest": "Forest", "Home Cook's": "Home Cook's", "Children's": "Children's"},
        {"Forest": "da Floresta", "Home Cook's": "Comida Caseira", "Children's": "das Crianças"},
    )
    _pair(
        root,
        "Strings/UI",
        {"JunimoNote_BundleName": "{0} Bundle", "Billboard_NightMarket": "Night Market"},
        {"JunimoNote_BundleName": "Conjunto {0}", "Billboard_NightMarket": "Mercado Noturno"},
    )
    _pair(root, "Data/Festivals/FestivalDates", {"spring13": "Egg Festival"}, {"spring13": "Festival do Ovo"})
    _write(
        root,
        "Data/PassiveFestivals.json",
        {
            "NightMarket": {"DisplayName": _ref("UI", "Billboard_NightMarket")},
            "TroutDerby": {"DisplayName": ""},
        },
    )
    _pair(root, "Strings/1_6_Strings", {"TroutDerby": "Trout Derby"}, {"TroutDerby": "Competição de Truta"})
    _pair(
        root,
        "Strings/StringsFromCSFiles",
        {"MapPage.cs.11081": "Blacksmith", "MovieTheater_Map": "Movie Theater", "Utility.cs.1": "Fish Shop"},
        {"MapPage.cs.11081": "Ferreiro", "MovieTheater_Map": "Cinema", "Utility.cs.1": "Loja errada"},
    )
    _pair(
        root,
        "Strings/WorldMap",
        {"GingerIsland_West_QiWalnutRoom": "Qi's Walnut Room"},
        {"GingerIsland_West_QiWalnutRoom": "Sala de Nozes de Qi"},
    )
    return root


@pytest.fixture
def strings(content: Path):
    return game_strings.GameStrings(content)


def test_should_return_the_item_name_when_the_display_name_matches(strings):
    assert strings.name("seeds", "Pineapple Seeds") == "Sementes de Abacaxi"


def test_should_match_ignoring_punctuation_and_case_when_looking_up_an_item(strings):
    assert strings.name("misc-items", "warp totem beach") == "Totem de Teletransporte: Praia"


def test_should_use_the_collections_tab_name_when_an_item_is_named_by_its_ingredient(strings):
    assert strings.name("artisan-goods", "Smoked Fish") == "Peixe Defumado"


def test_should_read_furniture_names_when_the_data_is_a_slash_separated_string(strings):
    assert strings.name("furniture", "Stone Cairn") == "Moledro"


@pytest.mark.parametrize(
    ("folder", "expected"),
    [("machines", "Máquina"), ("craftables", "Máquina"), ("misc-items", "Objeto")],
)
def test_should_prefer_the_folder_sheet_when_several_sheets_have_the_name(strings, folder, expected):
    assert strings.name(folder, "Shared") == expected


def test_should_return_the_villager_name_when_the_folder_is_villagers(strings):
    assert strings.name("villagers", "Dwarf") == "Anão"


def test_should_return_the_achievement_name_when_the_folder_is_achievements(strings):
    assert strings.name("achievements", "Greenhorn (15k)") == "Dedo Verde (15 mil)"


@pytest.mark.parametrize(
    ("en", "expected"),
    [("Egg Festival", "Festival do Ovo"), ("Night Market", "Mercado Noturno"), ("Trout Derby", "Competição de Truta")],
)
def test_should_return_the_festival_name_when_the_folder_is_festivals(strings, en, expected):
    assert strings.name("festivals", en) == expected


def test_should_use_only_map_names_when_the_folder_is_shops(strings):
    assert strings.name("shops", "Blacksmith") == "Ferreiro"
    assert strings.name("shops", "Qi's Walnut Room") == "Sala de Nozes de Qi"
    assert strings.name("shops", "Movie Theater") == "Cinema"
    assert strings.name("shops", "Fish Shop") is None


@pytest.mark.parametrize(
    ("folder", "en"),
    [("seeds", "Unknown Seeds"), ("villagers", "Pineapple Seeds"), ("reminders", "Gather forage")],
)
def test_should_return_none_when_the_game_has_no_such_name(strings, folder, en):
    assert strings.name(folder, en) is None


@pytest.mark.parametrize(
    ("en", "expected"),
    [
        ("Spring Crops Bundle", ("Spring Crops Bundle", "Conjunto Plantações de Primavera")),
        ("2,500g", ("2,500g Bundle", "Conjunto 2.500 ouros")),
        ("Forest", ("Forest Bundle", "Conjunto da Floresta")),
        ("Homestead", ("Home Cook's Bundle", "Conjunto Comida Caseira")),
        ("Child's", ("Children's Bundle", "Conjunto das Crianças")),
    ],
)
def test_should_return_the_official_bundle_name_in_both_locales_when_the_bundle_exists(strings, en, expected):
    assert strings.bundle(en) == expected


def test_should_return_none_when_the_bundle_does_not_exist(strings):
    assert strings.bundle("Unknown Bundle") is None


def test_should_fail_when_the_content_folder_does_not_exist(tmp_path):
    with pytest.raises(FileNotFoundError):
        game_strings.GameStrings(tmp_path / "missing")
