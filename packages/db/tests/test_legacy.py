from pathlib import Path

from stardew_valley_db.entities.game import GameEntity
from stardew_valley_db.entities.keys import ITEM_FOLDERS
from stardew_valley_db.importer.legacy import LEGACY_FOLDERS


def _subclasses(cls):
    for sub in cls.__subclasses__():
        yield sub
        yield from _subclasses(sub)


def test_legacy_map_covers_every_folder_constant():
    folders = {sub.FOLDER for sub in _subclasses(GameEntity) if getattr(sub, "FOLDER", None)}
    folders |= set(ITEM_FOLDERS)
    assert folders <= set(LEGACY_FOLDERS.values())
    assert not folders & set(LEGACY_FOLDERS)


def test_fixture_folders_are_english():
    root = Path(__file__).parent / "fixtures" / "data"
    folders = {p.name for p in root.iterdir() if p.is_dir() and p.name != "_meta"}
    assert folders <= set(LEGACY_FOLDERS.values())
