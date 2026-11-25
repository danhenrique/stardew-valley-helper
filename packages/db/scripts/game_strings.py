"""Official pt-BR names read from the unpacked game content (`Content/`, e.g. `.tmp/Content-unpacked`).

Each English sheet (`Strings/Objects.json`) has a pt-BR twin with the same keys
(`Strings/Objects.pt-BR.json`), so a name is translated through its key, never through its text:
the same English text can mean different things ("Angler" is a fish and a profession).

`GameStrings.name(folder, en)` looks a name up in the sheets that fit the dataset folder (items,
villagers, achievements, festivals or map places); `bundle(en)` builds a bundle's full name in both
locales with the game's own "{0} Bundle" pattern. Both return None when the game has no such name,
or when the fitting sheets disagree on its translation.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

PT = "pt-BR"
LOCALIZED_TEXT = re.compile(r"\[LocalizedText Strings\\(\w+):([^\]]+)\]")

# Item data files, each with the DisplayName (or the slash-separated string) that names its sheet.
ITEM_SHEETS = ["Objects", "BigCraftables", "Furniture", "Tools", "Weapons", "Boots", "hats", "Trinkets"]
# Folders whose items are big craftables first (a "Tapper" machine before any other "Tapper").
CRAFTABLE_FOLDERS = {"machines", "craftables"}
# Map labels for shops and other places (MapPage.cs.* in StringsFromCSFiles, and WorldMap).
PLACE_KEY = re.compile(r"^(MapPage\.cs\.\d+|MovieTheater_Map)$")
# Items named after their ingredient ("Smoked {0}") keep their generic name for the collections tab.
COLLECTIONS_NAME = "_CollectionsTabName"
# The scheduler names two remixed bundles differently from the game (same items).
BUNDLE_ALIASES = {"Homestead": "Home Cook's", "Child's": "Children's"}
BUNDLE_SUFFIX = " Bundle"


def normalize(text: str) -> str:
    """Compare names ignoring case and punctuation: ``Warp Totem: Beach`` == ``warp totem beach``."""
    return re.sub(r"[^a-z0-9]+", "", text.casefold())


class _Names:
    """English -> pt-BR names; a name the sources translate in different ways is ambiguous."""

    def __init__(self) -> None:
        self._found: dict[str, set[str]] = {}

    def add(self, en: str | None, pt: str | None) -> None:
        if en and pt:
            self._found.setdefault(normalize(en), set()).add(pt)

    def get(self, en: str) -> str | None:
        found = self._found.get(normalize(en), set())
        return next(iter(found)) if len(found) == 1 else None


class GameStrings:
    def __init__(self, content: Path) -> None:
        if not content.is_dir():
            raise FileNotFoundError(f"game content folder not found: {content}")
        self._root = content
        self._sheets: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
        self._items = {sheet: self._item_names(sheet) for sheet in ITEM_SHEETS}
        self._villagers = self._sheet_names("NPCNames")
        self._achievements = self._data_names("Data/Achievements", lambda v: v.split("^")[0])
        self._festivals = self._festival_names()
        self._places = self._place_names()
        self._bundle_parts = self._data_names("Data/Bundles", lambda v: v.split("/")[0], lambda v: v.split("/")[-1])
        bundle_en, bundle_pt = self._sheet("BundleNames")
        for key, en in bundle_en.items():
            self._bundle_parts.add(en, bundle_pt.get(key))
        ui_en, ui_pt = self._sheet("UI")
        self._bundle_format = (ui_en.get("JunimoNote_BundleName"), ui_pt.get("JunimoNote_BundleName"))

    # ------------------------------------------------------------------ public

    def name(self, folder: str, en: str) -> str | None:
        """Official pt-BR name of `en` in the dataset folder `folder`, or None."""
        if folder == "villagers":
            return self._villagers.get(en)
        if folder == "achievements":
            return self._achievements.get(en)
        if folder == "festivals":
            return self._festivals.get(en)
        if folder == "shops":
            return self._places.get(en)
        if folder in {"reminders", "foraging-events", "bundles"}:
            return None  # app texts, or names with their own builder (bundle())
        order = ITEM_SHEETS
        if folder in CRAFTABLE_FOLDERS:
            order = ["BigCraftables"] + [s for s in ITEM_SHEETS if s != "BigCraftables"]
        for sheet in order:
            pt = self._items[sheet].get(en)
            if pt:
                return pt
        return None

    def bundle(self, en: str) -> tuple[str, str] | None:
        """(en, pt-BR) full name of a bundle, e.g. ("Forest Bundle", "Conjunto da Floresta"), or None."""
        part = en.removesuffix(BUNDLE_SUFFIX)
        part = BUNDLE_ALIASES.get(part, part)
        pt_part = self._bundle_parts.get(part)
        en_format, pt_format = self._bundle_format
        if not (pt_part and en_format and pt_format):
            return None
        return en_format.format(part), pt_format.format(pt_part)

    # ----------------------------------------------------------------- loading

    def _load(self, rel: str) -> Any:
        path = self._root / rel
        if not path.is_file():
            return {}
        return json.loads(path.read_text(encoding="utf-8-sig"))

    def _sheet(self, sheet: str) -> tuple[dict[str, Any], dict[str, Any]]:
        """(en, pt-BR) string tables of `Strings/<sheet>`."""
        if sheet not in self._sheets:
            en, pt = self._load(f"Strings/{sheet}.json"), self._load(f"Strings/{sheet}.{PT}.json")
            self._sheets[sheet] = (en if isinstance(en, dict) else {}, pt if isinstance(pt, dict) else {})
        return self._sheets[sheet]

    def _text(self, ref: str) -> tuple[str | None, str | None]:
        """(en, pt-BR) text of a ``[LocalizedText Strings\\Sheet:Key]`` reference."""
        m = LOCALIZED_TEXT.search(ref or "")
        if not m:
            return None, None
        en, pt = self._sheet(m.group(1))
        return en.get(m.group(2)), pt.get(m.group(2))

    def _item_names(self, sheet: str) -> _Names:
        names = _Names()
        data = self._load(f"Data/{sheet}.json")
        for value in data.values() if isinstance(data, dict) else []:
            if isinstance(value, dict):
                internal, ref = value.get("Name"), value.get("DisplayName") or ""
            elif isinstance(value, str):
                internal, ref = value.split("/")[0], value
            else:
                continue
            en, pt = self._text(ref)
            names.add(en, pt)
            names.add(internal, pt)
        sheet_en, sheet_pt = self._sheet(sheet)
        for key, value in sheet_en.items():
            if key.endswith(COLLECTIONS_NAME) and isinstance(value, str):
                names.add(value, sheet_pt.get(key))
        return names

    def _sheet_names(self, sheet: str) -> _Names:
        names = _Names()
        en, pt = self._sheet(sheet)
        for key, value in en.items():
            if isinstance(value, str):
                names.add(value, pt.get(key))
        return names

    def _data_names(self, rel: str, en_part, pt_part=None) -> _Names:
        """Names inside a `Data/<file>` and its pt-BR twin, keyed alike (achievements, bundles)."""
        names = _Names()
        en, pt = self._load(f"{rel}.json"), self._load(f"{rel}.{PT}.json")
        for key, value in en.items():
            if isinstance(value, str) and isinstance(pt.get(key), str):
                names.add(en_part(value), (pt_part or en_part)(pt[key]))
        return names

    def _festival_names(self) -> _Names:
        names = self._data_names("Data/Festivals/FestivalDates", lambda v: v)
        passive = self._load("Data/PassiveFestivals.json")
        sixteen_en, sixteen_pt = self._sheet("1_6_Strings")
        for fid, value in passive.items():
            en, pt = self._text(value.get("DisplayName") or "")
            if not en:  # no DisplayName: the 1.6 strings name it by its id
                en, pt = sixteen_en.get(fid), sixteen_pt.get(fid)
            names.add(en, pt)
        return names

    def _place_names(self) -> _Names:
        names = _Names()
        cs_en, cs_pt = self._sheet("StringsFromCSFiles")
        for key, value in cs_en.items():
            if PLACE_KEY.match(key) and isinstance(value, str):
                names.add(value, cs_pt.get(key))
        map_en, map_pt = self._sheet("WorldMap")
        for key, value in map_en.items():
            if isinstance(value, str):
                names.add(value, map_pt.get(key))
        return names
