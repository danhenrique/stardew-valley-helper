import json
from pathlib import Path

import pytest

from stardew_valley_db.importer import cli, migrate
from stardew_valley_db.importer.legacy import LEGACY_FOLDERS

from .conftest import count_items

FIXTURES = Path(__file__).parent / "fixtures" / "data"
NEW_TO_OLD = {new: old for old, new in LEGACY_FOLDERS.items()}


def _models():
    return migrate.load_models(FIXTURES)


def _import() -> None:
    assert cli.main(["--data-dir", str(FIXTURES)]) == 0


def _rewrite_to_old_types() -> None:
    """Simulate the table before the migration: every game record still has its Portuguese TYPE#."""
    from stardew_valley_db.entities import BaseModel

    with BaseModel.batch_write() as batch:
        for record in BaseModel.scan():
            folder = (record.gsi1pk or "").removeprefix("TYPE#")
            if folder in NEW_TO_OLD:
                record.gsi1pk = f"TYPE#{NEW_TO_OLD[folder]}"
                batch.save(record)


def _add_planting(player_id: str = "p1", planting_id: str = "1") -> None:
    from stardew_valley_db.entities import Planting

    Planting(pk=f"PLAYER#{player_id}", sk=f"PLANTING#{planting_id}", seed_id="test-seed", created_at="now").save()


def _add_stale_perfection() -> None:
    from stardew_valley_db.entities import Perfection

    # As in the table before the migration: the renamed id still carries its Portuguese type.
    record = Perfection.build(entity_id="perfeicao", categories=[])
    record.gsi1pk = "TYPE#perfeicao"
    record.save()


def test_should_pass_validation_when_imported(table):
    _add_planting()
    snapshot = migrate.user_counts()
    _import()
    assert migrate.validate(_models(), snapshot) == []


def test_should_fail_validation_when_old_types_remain_before_import(table):
    _import()
    _rewrite_to_old_types()
    snapshot = migrate.user_counts()
    problems = migrate.validate(_models(), snapshot)
    assert problems
    assert any("sementes" in problem for problem in problems)


def test_should_fail_validation_when_table_is_empty(table):
    assert migrate.validate(_models(), migrate.user_counts())


def test_should_fail_validation_when_a_key_is_missing(table):
    from stardew_valley_db.entities import BaseModel

    snapshot = migrate.user_counts()
    _import()
    BaseModel.get("ITEM#test-seed", "ITEM").delete()
    problems = migrate.validate(_models(), snapshot)
    assert any("ITEM#test-seed" in problem for problem in problems)


def test_should_fail_validation_when_content_changed(table):
    from stardew_valley_db.entities import Item

    snapshot = migrate.user_counts()
    _import()
    record = Item.get("ITEM#test-seed", "ITEM")
    record.sell_price = 999_999
    record.save()
    problems = migrate.validate(_models(), snapshot)
    assert any("ITEM#test-seed" in problem for problem in problems)


def test_should_fail_validation_when_user_count_changes(table):
    snapshot = migrate.user_counts()
    _import()
    _add_planting("x", "y")
    problems = migrate.validate(_models(), snapshot)
    assert any("PLANTING" in problem for problem in problems)


def test_should_fail_validation_when_dataset_is_empty(table):
    assert migrate.validate([], migrate.user_counts())


def test_should_compare_content_when_numbers_are_formatted_differently():
    assert migrate.same_content({"n": {"N": "1.0"}, "s": {"S": "a"}}, {"n": {"N": "1"}, "s": {"S": "a"}})
    assert not migrate.same_content({"n": {"N": "1"}}, {"n": {"N": "2"}})
    assert not migrate.same_content({"n": {"N": "1"}}, {"n": {"N": "1"}, "extra": {"S": "x"}})


def test_should_count_player_records_by_kind_when_snapshotting(table):
    _import()
    _add_planting("p1", "1")
    _add_planting("p1", "2")
    _add_planting("p2", "3")
    assert migrate.user_counts() == {"PLANTING": 3}


def test_should_list_only_stale_game_records_when_finding_orphans(table):
    _import()
    _add_stale_perfection()
    _add_planting()
    orphans = migrate.find_orphans(_models())
    assert orphans == [("PERFECTION#perfeicao", "PERFECTION")]
    assert not any(pk.startswith("META#") for pk, _ in orphans)


def test_should_ignore_unknown_prefixes_when_finding_orphans(table):
    from stardew_valley_db.entities import BaseModel

    _import()
    BaseModel._get_connection().put_item("USER#u1", "PROFILE")
    assert migrate.find_orphans(_models()) == []


def test_should_refuse_and_delete_nothing_when_a_key_is_a_user_key(table):
    _import()
    _add_stale_perfection()
    _add_planting()
    before = count_items()
    with pytest.raises(ValueError) as error:
        migrate.delete_orphans([("PERFECTION#perfeicao", "PERFECTION"), ("PLAYER#p1", "PLANTING#1")])
    assert "1 player key" in str(error.value)
    assert "PLAYER#" not in str(error.value)
    assert "p1" not in str(error.value)
    assert count_items() == before


def test_should_delete_given_keys_when_none_is_a_user_key(table):
    _import()
    _add_stale_perfection()
    before = count_items()
    assert migrate.delete_orphans([("PERFECTION#perfeicao", "PERFECTION")]) == 1
    assert count_items() == before - 1


def test_should_write_user_counts_when_running_snapshot(table, tmp_path):
    _add_planting()
    out = tmp_path / "snapshot.json"
    assert migrate.main(["snapshot", "--out", str(out)]) == 0
    assert json.loads(out.read_text()) == {"PLANTING": 1}


def test_should_exit_1_until_imported_when_running_validate(table, tmp_path):
    out = tmp_path / "snapshot.json"
    assert migrate.main(["snapshot", "--out", str(out)]) == 0
    args = ["validate", "--user-snapshot", str(out), "--data-dir", str(FIXTURES)]
    assert migrate.main(args) == 1
    _import()
    assert migrate.main(args) == 0


def test_should_delete_nothing_when_cleanup_runs_without_apply(table):
    _import()
    _add_stale_perfection()
    _add_planting()
    before = count_items()
    assert migrate.main(["cleanup", "--data-dir", str(FIXTURES)]) == 0
    assert count_items() == before


def _snapshot(tmp_path: Path) -> Path:
    out = tmp_path / "snapshot.json"
    assert migrate.main(["snapshot", "--out", str(out)]) == 0
    return out


def _apply(snapshot: Path) -> int:
    return migrate.main(["cleanup", "--apply", "--user-snapshot", str(snapshot), "--data-dir", str(FIXTURES)])


def test_should_delete_orphans_when_cleanup_runs_with_apply_and_validation_passes(table, tmp_path):
    from stardew_valley_db.entities import BaseModel

    _add_planting()
    _add_stale_perfection()
    snapshot = _snapshot(tmp_path)
    _import()
    before = count_items()
    assert _apply(snapshot) == 0
    assert count_items() == before - 1
    assert BaseModel.count("PERFECTION#perfeicao") == 0
    assert BaseModel.count("PLAYER#p1") == 1


def test_should_refuse_cleanup_apply_when_dataset_is_not_imported(table, tmp_path):
    _add_stale_perfection()
    snapshot = _snapshot(tmp_path)
    before = count_items()
    assert _apply(snapshot) == 1
    assert count_items() == before


def test_should_refuse_cleanup_apply_when_old_types_remain(table, tmp_path):
    _import()
    _rewrite_to_old_types()
    _add_stale_perfection()
    snapshot = _snapshot(tmp_path)
    before = count_items()
    assert _apply(snapshot) == 1
    assert count_items() == before


def test_should_refuse_cleanup_apply_when_user_count_changed(table, tmp_path):
    _add_stale_perfection()
    snapshot = _snapshot(tmp_path)
    _import()
    _add_planting("x", "y")
    before = count_items()
    assert _apply(snapshot) == 1
    assert count_items() == before


def test_should_refuse_cleanup_apply_when_user_snapshot_is_missing(table):
    _import()
    _add_stale_perfection()
    before = count_items()
    assert migrate.main(["cleanup", "--apply", "--data-dir", str(FIXTURES)]) == 1
    assert count_items() == before
