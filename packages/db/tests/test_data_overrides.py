"""Hand-made overrides applied on top of the generated dataset (scripts/data_overrides.py)."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "data_overrides.py"
_spec = importlib.util.spec_from_file_location("data_overrides", SCRIPT)
assert _spec and _spec.loader
overrides = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = overrides
_spec.loader.exec_module(overrides)

LEAD = ("id", "type", "subtype", "name", "nameVerified", "description", "tags")


def _write(root: Path, folder: str, entity_id: str, doc: dict) -> None:
    path = root / folder / f"{entity_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")


def test_should_add_the_entity_when_the_generator_does_not_produce_it(tmp_path):
    _write(tmp_path, "shops", "dwarf", {"id": "dwarf", "type": "shops", "name": {"en": "Dwarf"}})
    entities: dict = {}

    overrides.apply_overrides(entities, overrides.load_overrides(tmp_path), LEAD)

    assert entities == {("shops", "dwarf"): {"id": "dwarf", "type": "shops", "name": {"en": "Dwarf"}}}


def test_should_merge_fields_when_the_entity_is_generated(tmp_path):
    _write(
        tmp_path,
        "shops",
        "sewers",
        {"id": "sewers", "type": "shops", "name": {"pt-BR": "Krobus (Esgoto)"}, "access": {"en": "Rusty Key"}},
    )
    generated = {
        "id": "sewers",
        "type": "shops",
        "name": {"en": "Sewers", "pt-BR": "Esgoto"},
        "nameVerified": False,
        "offers": [{"item": "void-egg"}],
    }
    entities = {("shops", "sewers"): generated}

    overrides.apply_overrides(entities, overrides.load_overrides(tmp_path), LEAD)

    merged = entities[("shops", "sewers")]
    assert merged["name"] == {"en": "Sewers", "pt-BR": "Krobus (Esgoto)"}
    assert merged["access"] == {"en": "Rusty Key"}
    assert merged["offers"] == [{"item": "void-egg"}]
    # New keys go right after the leading keys, so files keep their hand-written layout.
    assert list(merged) == ["id", "type", "name", "nameVerified", "access", "offers"]


def test_should_replace_lists_when_merging_fields():
    base = {"id": "a", "type": "shops", "offers": [{"item": "x"}, {"item": "y"}]}

    merged = overrides.overlay(base, {"offers": [{"item": "z"}]}, LEAD)

    assert merged["offers"] == [{"item": "z"}]


def test_should_reject_the_override_when_its_id_does_not_match_its_path(tmp_path):
    _write(tmp_path, "shops", "dwarf", {"id": "other", "type": "shops"})

    with pytest.raises(overrides.OverrideError, match="dwarf"):
        overrides.load_overrides(tmp_path)


def test_should_return_nothing_when_the_folder_is_missing(tmp_path):
    assert overrides.load_overrides(tmp_path / "missing") == {}
