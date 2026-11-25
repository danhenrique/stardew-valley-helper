import pytest

from stardew_valley_api.machine_schedule import InvalidMachineInputError, machine_schedule
from stardew_valley_api.schedule import GameDate


def S(season, day, year=1):
    return GameDate(year, season, day)


def run(machine, output, days, started, today, location="farm", quality=None):
    return machine_schedule(machine, output, days, started, location, quality, today)


def test_batch_keg_wine_is_ready_after_seven_days():
    s = run("keg", "wine", 7, S("spring", 1), S("spring", 3))
    assert s.ready_on == S("spring", 8)
    assert s.status == "processing"
    assert s.days_until_next == 5
    s = run("keg", "wine", 7, S("spring", 1), S("spring", 10))
    assert s.status == "ready"
    assert s.days_until_next == 0


def test_continuous_returns_ten_collections_and_is_infinite():
    s = run("tapper", "maple-syrup", 9, S("spring", 1), S("spring", 1))
    assert s.collections[0] == S("spring", 10)
    assert len(s.collections) == 10
    assert s.infinite is True
    assert s.status == "processing"
    assert s.days_until_next == 9
    assert run("tapper", "maple-syrup", 9, S("spring", 1), S("spring", 10)).status == "ready"


def test_bee_house_skips_winter_on_the_farm():
    s = run("bee-house", "honey", 4, S("winter", 20), S("winter", 20))
    assert s.collections[:2] == [S("spring", 1, 2), S("spring", 5, 2)]
    s = run("bee-house", "honey", 4, S("fall", 26), S("fall", 26))
    assert s.collections[0] == S("spring", 1, 2)


def test_bee_house_started_in_winter_on_the_farm_first_collects_on_spring_1():
    # The farm bee house is paused all winter: the count restarts on Spring 1 of the next year.
    s = run("bee-house", "honey", 4, S("winter", 26), S("winter", 26))
    assert s.collections[:2] == [S("spring", 1, 2), S("spring", 5, 2)]
    s = run("bee-house", "honey", 4, S("winter", 1), S("winter", 1))
    assert s.collections[0] == S("spring", 1, 2)
    s = run("bee-house", "honey", 4, S("winter", 20), S("winter", 20))
    assert s.collections[:2] == [S("spring", 1, 2), S("spring", 5, 2)]


def test_bee_house_on_the_farm_never_collects_in_winter():
    for season, day in [("fall", 1), ("fall", 26), ("winter", 1), ("winter", 26), ("summer", 10)]:
        s = run("bee-house", "honey", 4, S(season, day), S(season, day))
        assert all(c.season != "winter" for c in s.collections)


def test_bee_house_on_ginger_island_produces_in_winter():
    s = run("bee-house", "honey", 4, S("winter", 1), S("winter", 1), location="ginger-island")
    assert s.collections[0] == S("winter", 5)
    s = run("bee-house", "honey", 4, S("winter", 26), S("winter", 26), location="ginger-island")
    assert s.collections[:2] == [S("spring", 2, 2), S("spring", 6, 2)]


def test_cask_wine_from_normal():
    s = run("cask", "wine", 56, S("spring", 1), S("spring", 1), quality="normal")
    assert s.milestones == [
        ("silver", S("spring", 15)),
        ("gold", S("summer", 1)),
        ("iridium", S("fall", 1)),
    ]
    assert s.ready_on == S("fall", 1)


def test_cask_wine_from_silver():
    s = run("cask", "wine", 56, S("spring", 1), S("spring", 1), quality="silver")
    assert s.milestones == [("gold", S("spring", 15)), ("iridium", S("summer", 15))]


def test_cask_pale_ale_rounds_up():
    s = run("cask", "pale-ale", 34, S("spring", 1), S("spring", 1), quality="normal")
    assert [d.to_abs() - S("spring", 1).to_abs() for _, d in s.milestones] == [9, 17, 34]
    s = run("cask", "pale-ale", 34, S("spring", 1), S("spring", 1), quality="silver")
    assert [d.to_abs() - S("spring", 1).to_abs() for _, d in s.milestones] == [9, 26]


def test_cask_status():
    s = run("cask", "wine", 56, S("spring", 1), S("spring", 10), quality="normal")
    assert s.status == "aging"
    assert s.days_until_next == 5
    s = run("cask", "wine", 56, S("spring", 1), S("fall", 1), quality="normal")
    assert s.status == "iridium"
    assert s.days_until_next is None
    assert run("cask", "wine", 56, S("spring", 1), S("fall", 5), quality="normal").status == "iridium"


def test_cask_without_start_quality_is_normal():
    s = run("cask", "wine", 56, S("spring", 1), S("spring", 1))
    assert len(s.milestones) == 3


def test_approximate_outputs():
    assert run("keg", "beer", 36, S("spring", 1), S("spring", 1)).approximate is True
    assert run("keg", "wine", 7, S("spring", 1), S("spring", 1)).approximate is False


def test_invalid_inputs():
    with pytest.raises(InvalidMachineInputError, match="Unknown machine"):
        run("nope", "x", 1, S("spring", 1), S("spring", 1))
    with pytest.raises(InvalidMachineInputError, match="Start quality only applies to the cask"):
        run("keg", "wine", 7, S("spring", 1), S("spring", 1), quality="silver")
    with pytest.raises(InvalidMachineInputError, match="Bee house can only be on the farm or Ginger Island"):
        run("bee-house", "honey", 4, S("spring", 1), S("spring", 1), location="greenhouse")


def test_rejects_non_positive_days():
    with pytest.raises(InvalidMachineInputError):
        run("keg", "wine", 0, S("spring", 1), S("spring", 1))


def test_rejects_iridium_start_quality():
    with pytest.raises(InvalidMachineInputError):
        run("cask", "wine", 56, S("spring", 1), S("spring", 1), quality="iridium")


def test_bee_house_location_is_an_allowlist():
    run("bee-house", "honey", 4, S("spring", 1), S("spring", 1), location="ginger-island")
    with pytest.raises(InvalidMachineInputError):
        run("bee-house", "honey", 4, S("spring", 1), S("spring", 1), location="elsewhere")
