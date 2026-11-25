import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import sync_icons  # noqa: E402


def make_source(root: Path, files: list[str]) -> Path:
    source = root / "source"
    for rel in files:
        path = source / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        # The content is the source path, so tests can tell which file won.
        path.write_bytes(rel.encode())
    return source


def make_index(root: Path, index: dict[str, list[str]]) -> Path:
    path = root / "index.json"
    path.write_text(json.dumps(index))
    return path


def make_overrides(root: Path, overrides: dict[str, str] | None = None) -> Path:
    path = root / "overrides.json"
    path.write_text(json.dumps(overrides or {}))
    return path


def make_extra(root: Path, ids: list[str]) -> Path:
    extra = root / "extra"
    extra.mkdir()
    for i in ids:
        (extra / f"{i}.png").write_bytes(f"extra/{i}".encode())
    return extra


def run(tmp_path: Path, files, index, overrides=None, extra=None):
    dest = tmp_path / "dest"
    report = sync_icons.sync(
        make_source(tmp_path, files),
        make_index(tmp_path, index),
        make_overrides(tmp_path, overrides),
        dest,
        tmp_path / "manifest.json",
        make_extra(tmp_path, extra) if extra is not None else None,
    )
    return dest, report


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Aged_Roe", "aged-roe"),
        ("CamelCase", "camel-case"),
        ("Joja Cola", "joja-cola"),
        ("Maple_Seed's", "maple-seed-s"),
        ("abigail", "abigail"),
    ],
)
def test_should_return_kebab_case_when_normalizing_a_file_name(name, expected):
    assert sync_icons.normalize(name) == expected


def test_should_copy_to_the_id_when_the_name_matches_normalized_or_squashed(tmp_path):
    dest, _ = run(
        tmp_path,
        ["gifts/Aged_Roe.png", "seeds/WildHorseradish.png"],
        {"fruits": ["aged-roe"], "forage": ["wild-horseradish"]},
    )
    assert (dest / "aged-roe.png").read_bytes() == b"gifts/Aged_Roe.png"
    assert (dest / "wild-horseradish.png").read_bytes() == b"seeds/WildHorseradish.png"


def test_should_pick_by_folder_order_when_an_id_is_in_several_folders(tmp_path):
    dest, _ = run(
        tmp_path,
        ["museum/X.png", "gifts/X.png", "perfection/shipped/X.png"],
        {"minerals": ["x"]},
    )
    assert (dest / "x.png").read_bytes() == b"gifts/X.png"
    assert not (dest / "ui").exists() or not any((dest / "ui").iterdir())


def test_should_use_the_override_when_one_exists_for_the_id(tmp_path):
    dest, _ = run(
        tmp_path,
        ["fruitTrees/saplings/Apple.png", "gifts/Apple_Sapling.png"],
        {"seeds": ["apple-sapling"]},
        {"apple-sapling": "fruitTrees/saplings/Apple.png"},
    )
    assert (dest / "apple-sapling.png").read_bytes() == b"fruitTrees/saplings/Apple.png"


def test_should_copy_to_ui_when_unmatched_or_not_png(tmp_path):
    dest, report = run(
        tmp_path,
        ["ui/calendar.png", "event/festival.gif"],
        {"festivals": ["festival"]},
    )
    assert (dest / "ui" / "calendar.png").read_bytes() == b"ui/calendar.png"
    assert (dest / "ui" / "festival.gif").read_bytes() == b"event/festival.gif"
    assert not (dest / "festival.png").exists()
    assert sorted(report.ui_files) == ["ui/calendar.png", "ui/festival.gif"]


def test_should_prefix_the_other_folder_when_ui_names_clash(tmp_path):
    dest, _ = run(tmp_path, ["ui/star.png", "addTask/star.png"], {})
    assert (dest / "ui" / "star.png").read_bytes() == b"ui/star.png"
    assert (dest / "ui" / "add-task-star.png").read_bytes() == b"addTask/star.png"


def test_should_write_manifest_and_notice_when_syncing(tmp_path):
    dest, _ = run(
        tmp_path,
        ["villagers/abigail.png", "fish/Albacore.png"],
        {"villagers": ["abigail"], "fish": ["albacore", "carp"]},
    )
    manifest = (tmp_path / "manifest.json").read_text()
    assert json.loads(manifest) == ["abigail", "albacore"]
    assert manifest.endswith("\n")
    assert "ConcernedApe" in (dest / "NOTICE.txt").read_text()
    assert not (dest / "manifest.json").exists()


def test_should_report_missing_ids_when_no_image_exists(tmp_path):
    _, report = run(tmp_path, [], {"achievements": ["first-steps"], "_counts": 3})
    assert report.missing == {"achievements": ["first-steps"]}


def test_should_clear_dest_and_be_deterministic_when_run_twice(tmp_path):
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "old.png").write_bytes(b"stale")
    files = ["villagers/abigail.png", "ui/calendar.png", "addTask/calendar.png"]
    source = make_source(tmp_path, files)
    index = make_index(tmp_path, {"villagers": ["abigail"]})
    overrides = make_overrides(tmp_path)

    def snapshot():
        return {
            str(p.relative_to(dest)): p.read_bytes()
            for p in sorted(dest.rglob("*"))
            if p.is_file()
        }

    manifest = tmp_path / "manifest.json"
    sync_icons.sync(source, index, overrides, dest, manifest)
    first = snapshot()
    sync_icons.sync(source, index, overrides, dest, manifest)
    assert "old.png" not in first
    assert snapshot() == first


def test_should_keep_the_own_id_when_an_override_reuses_its_file(tmp_path):
    dest, _ = run(
        tmp_path,
        ["costMaterials/Copper_Hoe.png"],
        {"tools": ["copper-hoe", "tool-upgrade-copper"]},
        {"tool-upgrade-copper": "costMaterials/Copper_Hoe.png"},
    )
    assert (dest / "copper-hoe.png").read_bytes() == b"costMaterials/Copper_Hoe.png"
    assert (dest / "tool-upgrade-copper.png").read_bytes() == b"costMaterials/Copper_Hoe.png"


def test_should_reject_the_override_when_it_is_not_a_png(tmp_path):
    with pytest.raises(ValueError, match="festival"):
        run(
            tmp_path,
            ["event/festival.gif"],
            {"festivals": ["egg-festival"]},
            {"egg-festival": "event/festival.gif"},
        )


def test_should_report_the_file_when_an_override_replaces_it(tmp_path):
    _, report = run(
        tmp_path,
        ["fruitTrees/saplings/Apple.png", "gifts/Apple_Sapling.png"],
        {"seeds": ["apple-sapling"]},
        {"apple-sapling": "fruitTrees/saplings/Apple.png"},
    )
    assert report.replaced == ["gifts/Apple_Sapling.png"]


def test_should_keep_every_other_copy_in_variants_when_an_id_is_in_several_folders(tmp_path):
    dest, report = run(
        tmp_path,
        ["museum/X.png", "gifts/X.png", "perfection/shipped/X.png", "fruitTrees/X.png"],
        {"minerals": ["x"]},
    )
    assert (dest / "x.png").read_bytes() == b"gifts/X.png"
    assert (dest / "variants" / "museum" / "x.png").read_bytes() == b"museum/X.png"
    assert (
        dest / "variants" / "perfection" / "shipped" / "x.png"
    ).read_bytes() == b"perfection/shipped/X.png"
    assert (dest / "variants" / "fruit-trees" / "x.png").read_bytes() == b"fruitTrees/X.png"
    assert sorted(report.variant_files) == [
        "variants/fruit-trees/x.png",
        "variants/museum/x.png",
        "variants/perfection/shipped/x.png",
    ]


def test_should_copy_every_source_file_when_syncing(tmp_path):
    files = [
        "gifts/X.png",
        "museum/X.png",
        "ui/calendar.png",
        "event/festival.gif",
        "costMaterials/Copper_Hoe.png",
        "fruitTrees/saplings/Apple.png",
    ]
    dest, _ = run(
        tmp_path,
        files,
        {"minerals": ["x"], "tools": ["copper-hoe", "apple-sapling"]},
        {"apple-sapling": "fruitTrees/saplings/Apple.png"},
    )
    copied = {p.read_bytes() for p in dest.rglob("*") if p.is_file() and p.name != "NOTICE.txt"}
    assert copied == {f.encode() for f in files}


def test_should_count_each_source_file_once_when_an_override_reuses_it(tmp_path):
    _, report = run(
        tmp_path,
        ["costMaterials/Copper_Hoe.png", "ui/calendar.png", "gifts/X.png", "museum/X.png"],
        {"tools": ["copper-hoe", "tool-upgrade-copper"], "minerals": ["x"]},
        {"tool-upgrade-copper": "costMaterials/Copper_Hoe.png"},
    )
    assert report.sources_copied == 4


def test_should_use_the_extra_sprite_when_one_exists_for_the_id(tmp_path):
    dest, report = run(
        tmp_path,
        ["seeds/Carrot_Seeds.png"],
        {"seeds": ["carrot-seeds", "pineapple-seeds"]},
        extra=["carrot-seeds", "pineapple-seeds"],
    )
    assert (dest / "carrot-seeds.png").read_bytes() == b"extra/carrot-seeds"
    assert (dest / "pineapple-seeds.png").read_bytes() == b"extra/pineapple-seeds"
    # The source copy the extra sprite replaced is kept, not dropped.
    assert (dest / "variants/seeds/carrot-seeds.png").read_bytes() == b"seeds/Carrot_Seeds.png"
    assert "seeds" not in report.missing


def test_should_list_extra_sprites_in_the_manifest_when_syncing(tmp_path):
    run(tmp_path, [], {"seeds": ["pine-cone"]}, extra=["pine-cone"])
    assert json.loads((tmp_path / "manifest.json").read_text()) == ["pine-cone"]


def test_should_reject_the_extra_sprite_when_its_id_is_unknown(tmp_path):
    with pytest.raises(ValueError, match="unknown id"):
        run(tmp_path, [], {"seeds": ["pine-cone"]}, extra=["pine-cones"])


def test_should_give_joja_wallpaper_and_marlons_number_a_sprite_when_reading_overrides():
    overrides = json.loads((sync_icons.SCRIPT_DIR / "icon-overrides.json").read_text())
    assert overrides["wallpaper-joja"] == "costMaterials/Wallpaper_022_Icon.png"
    assert overrides["marlons-phone-number"] == "shops/adventurersGuild.png"


def test_should_cover_every_item_without_a_scheduler_sprite_when_reading_extra_icons():
    extra = {p.stem for p in (sync_icons.SCRIPT_DIR / "extra-icons").glob("*.png")}
    assert extra >= {
        "big-stone-chest",
        "broccoli-seeds",
        "carrot-seeds",
        "pine-cone",
        "pineapple-seeds",
        "powdermelon-seeds",
        "rare-seed",
        "rarecrow-6",
        "stone-cairn",
        "strawberry-seeds",
        "summer-squash-seeds",
        "taro-tuber",
    }
