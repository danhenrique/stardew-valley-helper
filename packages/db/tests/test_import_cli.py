import shutil
from pathlib import Path

from stardew_valley_db.importer.cli import main

from .conftest import count_items

FIXTURES = Path(__file__).parent / "fixtures" / "data"


def test_should_write_all_models_when_importing_fixtures(table):
    assert main(["--data-dir", str(FIXTURES)]) == 0
    assert count_items() > 26


def test_should_not_duplicate_items_when_importing_twice(table):
    assert main(["--data-dir", str(FIXTURES)]) == 0
    first = count_items()
    assert main(["--data-dir", str(FIXTURES)]) == 0
    assert count_items() == first


def test_should_write_nothing_when_one_file_is_invalid(table, tmp_path):
    data = tmp_path / "data"
    shutil.copytree(FIXTURES, data)
    (data / "frutas" / "broken.json").write_text("{not json")
    assert main(["--data-dir", str(data)]) == 1
    assert count_items() == 0


def test_should_write_nothing_when_dry_run(table):
    assert main(["--data-dir", str(FIXTURES), "--dry-run"]) == 0
    assert count_items() == 0


def test_should_import_cask_produces_relations(table):
    from stardew_valley_db.entities import BaseModel

    assert main(["--data-dir", str(FIXTURES)]) == 0
    assert BaseModel.get("ITEM#cask", "PRODUCES#ITEM#wine")
    assert BaseModel.count("ITEM#bee-house", BaseModel.sk == "PRODUCES#ITEM#wine") == 0
