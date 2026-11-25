from pathlib import Path

from stardew_valley_db.importer.cli import DEFAULT_DATA_DIR

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_should_use_the_versioned_dataset_when_no_data_dir_is_given():
    assert DEFAULT_DATA_DIR == PROJECT_ROOT / "data"
    assert (DEFAULT_DATA_DIR / "_meta" / "index.json").is_file()


def test_should_have_no_windows_metadata_files_when_the_dataset_is_versioned():
    files = [p for p in DEFAULT_DATA_DIR.rglob("*") if p.is_file()]
    assert files, "dataset directory is missing or empty"
    assert not [p for p in files if ":" in p.name]
