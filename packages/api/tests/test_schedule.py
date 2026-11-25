import pytest

from stardew_valley_api.schedule import (
    CropSpec,
    FruitTreeSpec,
    GameDate,
    NotRegrowingError,
    OutOfSeasonError,
    crop_schedule,
    effective_growth_days,
    fruit_tree_schedule,
    regrow_schedule,
)


def S(season, day, year=1):
    return GameDate(year, season, day)


STRAWBERRY = CropSpec(["spring"], 8, [1, 1, 2, 2, 2], 4)
CAULIFLOWER = CropSpec(["spring"], 12, [1, 2, 4, 5], None)
COFFEE = CropSpec(["spring", "summer"], 10, [1, 2, 2, 3, 2], 2)
ANCIENT = CropSpec(["spring", "summer", "fall"], 28, None, 7)
GREEN_BEAN = CropSpec(["spring"], 10, [1, 1, 1, 3, 4], 3)


def test_should_round_trip_across_the_year_boundary_when_converting_absolute_days():
    assert S("winter", 28).to_abs() == 112
    assert GameDate.from_abs(113) == S("spring", 1, 2)
    assert GameDate.from_abs(S("fall", 17, 3).to_abs()) == S("fall", 17, 3)


def test_should_reject_invalid_dates_when_building_game_date():
    with pytest.raises(ValueError):
        GameDate(1, "spring", 29)
    with pytest.raises(ValueError):
        GameDate(0, "spring", 1)


def test_should_regrow_until_season_end_when_strawberry_is_planted_on_spring_1():
    s = crop_schedule(STRAWBERRY, S("spring", 1), "none", False, "farm", S("spring", 1))
    assert s.first_harvest == S("spring", 9)
    assert s.harvests == [S("spring", d) for d in (9, 13, 17, 21, 25)]
    assert s.total_harvests == 5
    assert s.dies_on == S("summer", 1)
    assert (s.status, s.days_until_next, s.infinite, s.approximate) == ("growing", 8, False, False)


def test_should_remove_phase_days_when_cauliflower_has_speed_gro_or_agriculturist():
    assert effective_growth_days(CAULIFLOWER, 10) == (10, False)
    assert effective_growth_days(CAULIFLOWER, 20) == (9, False)


def test_should_cut_strawberry_to_four_days_when_hyper_speed_gro_and_agriculturist():
    assert effective_growth_days(STRAWBERRY, 43) == (4, False)


def test_should_cut_green_bean_to_seven_days_when_deluxe_speed_gro():
    assert effective_growth_days(GREEN_BEAN, 25) == (7, False)


def test_should_apply_fertilizer_and_profession_when_computing_crop_schedule():
    s = crop_schedule(CAULIFLOWER, S("spring", 1), "speed-gro", True, "farm", S("spring", 1))
    assert s.first_harvest == S("spring", 10)


def test_should_keep_harvesting_into_summer_when_coffee_spans_two_seasons():
    s = crop_schedule(COFFEE, S("spring", 1), "none", False, "farm", S("spring", 1))
    assert s.harvests[0] == S("spring", 11)
    assert S("summer", 1) in s.harvests
    assert s.harvests[-1] == S("summer", 27)
    assert s.dies_on == S("fall", 1)
    assert s.total_harvests == 23


def test_should_harvest_on_day_28_when_planted_on_last_planting_day():
    s = crop_schedule(CAULIFLOWER, S("spring", 16), "none", False, "farm", S("spring", 16))
    assert s.harvests == [S("spring", 28)]


def test_should_warn_will_not_mature_when_planted_one_day_too_late():
    s = crop_schedule(CAULIFLOWER, S("spring", 17), "none", False, "farm", S("spring", 17))
    assert s.harvests == [] and s.first_harvest is None and s.total_harvests == 0
    assert "will_not_mature" in s.warnings


def test_should_raise_when_planting_out_of_season_on_the_farm():
    with pytest.raises(OutOfSeasonError):
        crop_schedule(STRAWBERRY, S("summer", 1), "none", False, "farm", S("summer", 1))


def test_should_allow_any_season_when_planting_in_the_greenhouse():
    s = crop_schedule(STRAWBERRY, S("winter", 1), "none", False, "greenhouse", S("winter", 1))
    assert s.first_harvest == S("winter", 9) and s.dies_on is None


def test_should_return_ten_harvests_across_the_year_when_ancient_fruit_is_in_greenhouse():
    s = crop_schedule(ANCIENT, S("winter", 1), "none", False, "greenhouse", S("winter", 1))
    assert s.first_harvest == S("spring", 1, 2)
    assert s.infinite and len(s.harvests) == 10 and s.dies_on is None
    assert s.harvests[1] == S("spring", 8, 2)


def test_should_return_single_harvest_when_non_regrowing_crop_is_in_greenhouse():
    s = crop_schedule(CAULIFLOWER, S("winter", 20), "none", False, "ginger-island", S("winter", 20))
    assert s.harvests == [S("spring", 4, 2)] and not s.infinite


def test_should_mark_approximate_when_seed_has_no_phases_and_speed_applies():
    assert effective_growth_days(ANCIENT, 10) == (25, True)
    assert effective_growth_days(ANCIENT, 0) == (28, False)


def test_should_follow_status_transitions_when_today_moves():
    plant = S("spring", 1)
    ready = crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring", 9))
    assert (ready.status, ready.days_until_next) == ("ready", 0)
    regrowing = crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring", 10))
    assert (regrowing.status, regrowing.days_until_next) == ("regrowing", 3)
    finished = crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("spring", 26))
    assert (finished.status, finished.days_until_next) == ("finished", None)
    dead = crop_schedule(STRAWBERRY, plant, "none", False, "farm", S("summer", 1))
    assert (dead.status, dead.days_until_next) == ("dead", None)


def test_should_be_finished_after_harvest_when_crop_does_not_regrow_in_greenhouse():
    s = crop_schedule(CAULIFLOWER, S("spring", 1), "none", False, "greenhouse", S("summer", 1))
    assert s.status == "finished"


def test_should_list_next_regrowths_when_starting_from_a_known_harvest():
    s = regrow_schedule(STRAWBERRY, S("spring", 13), "farm", S("spring", 14))
    assert s.harvests == [S("spring", d) for d in (13, 17, 21, 25)]
    assert s.first_harvest == S("spring", 13)
    assert s.total_harvests == 3
    assert s.dies_on == S("summer", 1)
    assert (s.status, s.days_until_next) == ("regrowing", 3)


def test_should_be_ready_when_today_is_the_known_harvest_day():
    s = regrow_schedule(STRAWBERRY, S("spring", 13), "farm", S("spring", 13))
    assert (s.status, s.days_until_next) == ("ready", 0)


def test_should_raise_when_starting_from_harvest_with_non_regrowing_crop():
    with pytest.raises(NotRegrowingError):
        regrow_schedule(CAULIFLOWER, S("spring", 20), "farm", S("spring", 20))


def test_should_raise_when_known_harvest_is_out_of_season_on_the_farm():
    with pytest.raises(OutOfSeasonError):
        regrow_schedule(STRAWBERRY, S("summer", 3), "farm", S("summer", 3))


def test_should_be_infinite_across_the_year_when_known_harvest_is_in_greenhouse():
    s = regrow_schedule(ANCIENT, S("winter", 20), "greenhouse", S("winter", 20))
    assert s.infinite
    assert s.harvests[1] == S("winter", 27)
    assert s.harvests[2] == S("spring", 6, 2)
    assert len(s.harvests) == 11  # the known harvest + 10 upcoming


def test_should_mature_and_fruit_in_season_when_fruit_tree_is_on_the_farm():
    tree = FruitTreeSpec("fall", 28, 3)
    s = fruit_tree_schedule(tree, S("summer", 1), "farm", S("summer", 1))
    assert s.first_harvest == S("fall", 1)
    assert s.harvests[:2] == [S("fall", 1), S("fall", 2)]
    assert s.infinite and len(s.harvests) == 10 and s.status == "growing"


def test_should_wait_for_next_season_when_fruit_tree_matures_off_season_on_the_farm():
    s = fruit_tree_schedule(FruitTreeSpec("fall", 28, 3), S("spring", 1), "farm", S("spring", 1))
    assert s.first_harvest == S("fall", 1)


def test_should_fruit_right_after_maturity_when_fruit_tree_is_in_greenhouse():
    s = fruit_tree_schedule(FruitTreeSpec("fall", 28, 3), S("spring", 1), "greenhouse", S("spring", 1))
    assert s.first_harvest == S("summer", 1)
    assert s.harvests[1] == S("summer", 2)


def test_should_match_dataset_last_planting_day_when_seed_has_phases_and_one_season():
    from pathlib import Path

    from stardew_valley_db.importer.cli import DEFAULT_DATA_DIR
    from stardew_valley_db.importer.load import load_dataset

    if not Path(DEFAULT_DATA_DIR).is_dir():
        pytest.skip("game dataset not available")
    seeds = [d for d in load_dataset(Path(DEFAULT_DATA_DIR))["seeds"] if d.get("crop")]
    checked = 0
    for seed in seeds:
        crop = seed["crop"]
        if not crop.get("phases") or len(crop["seasons"]) != 1 or crop.get("lastPlantingDay") is None:
            continue
        spec = CropSpec(crop["seasons"], crop["growthDays"], crop["phases"], crop.get("regrowDays"))
        assert 28 - effective_growth_days(spec, 0)[0] == crop["lastPlantingDay"], seed["id"]
        checked += 1
    assert checked >= 20


def test_should_be_finished_not_dead_when_single_harvest_crop_was_harvested_before_season_end():
    s = crop_schedule(CAULIFLOWER, S("spring", 1), "none", False, "farm", S("summer", 1))
    assert (s.status, s.days_until_next) == ("finished", None)
    assert s.dies_on == S("summer", 1)


def test_should_be_dead_when_single_harvest_crop_never_matured_and_season_ended():
    s = crop_schedule(CAULIFLOWER, S("spring", 17), "none", False, "farm", S("summer", 1))
    assert s.status == "dead"


def test_should_multiply_harvests_by_quantity_and_extra_yield_when_schedule_is_finite():
    from stardew_valley_api.schedule import expected_yield

    s = crop_schedule(STRAWBERRY, S("spring", 1), "none", False, "farm", S("spring", 1))
    assert expected_yield(s, quantity=20, average_extra_yield=0.02) == (20.4, 102.0)


def test_should_return_only_per_harvest_yield_when_schedule_is_infinite():
    from stardew_valley_api.schedule import expected_yield

    s = crop_schedule(ANCIENT, S("spring", 1), "none", False, "greenhouse", S("spring", 1))
    assert expected_yield(s, quantity=3, average_extra_yield=0) == (3.0, None)


def test_should_yield_nothing_when_crop_will_not_mature():
    from stardew_valley_api.schedule import expected_yield

    s = crop_schedule(CAULIFLOWER, S("spring", 17), "none", False, "farm", S("spring", 17))
    assert expected_yield(s, quantity=10, average_extra_yield=0) == (10.0, 0.0)
