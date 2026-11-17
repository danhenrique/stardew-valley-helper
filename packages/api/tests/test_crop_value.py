from pytest import approx

from stardew_valley_api.crop_value import (
    ArtisanProduct,
    QualityChances,
    QualityPrices,
    gold_per_harvest,
    harvest_days,
    jar_product,
    keg_product,
    quality_chances,
    quality_prices,
    seed_value,
)
from stardew_valley_api.schedule import CropSpec

PARSNIP = CropSpec(["spring"], 4, [1, 1, 1, 1], None)
CAULIFLOWER = CropSpec(["spring"], 12, [1, 2, 4, 4, 1], None)
GREEN_BEAN = CropSpec(["spring"], 10, [1, 1, 1, 3, 4], 3)
NO_PHASES = CropSpec(["spring"], 4, None, None)


def chances_tuple(c: QualityChances) -> tuple[float, float, float, float]:
    return (c.normal, c.silver, c.gold, c.iridium)


def test_should_give_mostly_normal_quality_when_level_0_without_fertilizer():
    assert chances_tuple(quality_chances(0, 0)) == approx((0.9702, 0.0198, 0.01, 0))


def test_should_raise_gold_chance_when_level_10_with_quality_fertilizer():
    assert chances_tuple(quality_chances(10, 2)) == approx((0.0975, 0.2925, 0.61, 0))


def test_should_allow_iridium_when_level_10_with_deluxe_fertilizer():
    assert chances_tuple(quality_chances(10, 3)) == approx((0, 0.11305, 0.48195, 0.405))


def test_should_floor_quality_prices_and_add_extra_at_normal_price_when_pricing_a_harvest():
    # 80·0.9702 + 100·0.0198 + 120·0.01 + 0.2·80
    assert gold_per_harvest(80, 0.2, quality_chances(0, 0)) == approx(96.796)
    # p = 35: silver ⌊43.75⌋ = 43, gold ⌊52.5⌋ = 52, iridium 70
    assert gold_per_harvest(35, 0, QualityChances(0, 0.5, 0.25, 0.25)) == approx(52.0)


def test_should_replant_when_crop_does_not_regrow():
    assert harvest_days(PARSNIP, 1, "none", False) == ([5, 9, 13, 17, 21, 25], False)


def test_should_harvest_every_regrow_days_when_crop_regrows():
    assert harvest_days(GREEN_BEAN, 1, "none", False)[0] == [11, 14, 17, 20, 23, 26]


def test_should_count_day_28_when_window_starts_later():
    assert harvest_days(PARSNIP, 20, "none", False)[0] == [24, 28]


def test_should_shorten_growth_when_using_speed_fertilizer():
    assert harvest_days(PARSNIP, 1, "speed-gro", True)[0] == [4, 7, 10, 13, 16, 19, 22, 25, 28]


def test_should_be_approximate_when_crop_has_no_phases_and_speed_fertilizer():
    assert harvest_days(NO_PHASES, 1, "speed-gro", False)[1] is True


def test_should_return_integer_totals_when_valuing_a_seed():
    v = seed_value(CAULIFLOWER, 175, 0, 1, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature) == (2, 28, False)
    expected = 2 * gold_per_harvest(175, 0, quality_chances(0, 0))
    assert v.gold_total == round(expected)
    assert v.gold_per_day_tenths == round(10 * expected / 28)


def test_should_keep_growth_when_using_quality_fertilizer():
    assert seed_value(PARSNIP, 35, 0, 1, "deluxe", 0, False).harvests == 6


def test_should_flag_will_not_mature_when_no_harvest_fits():
    v = seed_value(CAULIFLOWER, 175, 0, 20, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature, v.gold_total, v.gold_per_day_tenths) == (0, 9, True, 0, 0)


def test_should_not_mature_when_window_is_one_day():
    v = seed_value(PARSNIP, 35, 0, 28, "none", 0, False)
    assert (v.harvests, v.days, v.will_not_mature) == (0, 1, True)


def test_should_keep_harvests_without_gold_when_produce_has_no_price():
    v = seed_value(PARSNIP, None, 0, 1, "none", 0, False)
    assert (v.harvests, v.gold_total, v.gold_per_day_tenths) == (6, None, None)


def test_should_floor_silver_and_gold_and_double_iridium_when_pricing_qualities():
    assert quality_prices(750) == QualityPrices(750, 937, 1125, 1500)


def test_should_make_jelly_from_fruit_in_the_jar():
    assert jar_product("starfruit", "fruit", 750, False) == ArtisanProduct("jelly", 1550)


def test_should_raise_artisan_goods_by_40_percent_when_artisan():
    assert jar_product("starfruit", "fruit", 750, True) == ArtisanProduct("jelly", 2170)
    assert keg_product("hops", "vegetable", 25, True) == ArtisanProduct("pale-ale", 420)


def test_should_make_wine_from_fruit_in_the_keg():
    assert keg_product("starfruit", "fruit", 750, False) == ArtisanProduct("wine", 2250)


def test_should_make_juice_and_pickles_from_vegetables():
    assert keg_product("cauliflower", "vegetable", 175, False) == ArtisanProduct("juice", 393)
    assert jar_product("cauliflower", "vegetable", 175, False) == ArtisanProduct("pickles", 400)


def test_should_make_pale_ale_from_hops_and_beer_from_wheat():
    assert keg_product("hops", "vegetable", 25, False) == ArtisanProduct("pale-ale", 300)
    assert keg_product("wheat", "vegetable", 25, False) == ArtisanProduct("beer", 200)


def test_should_have_no_product_when_crop_is_not_fruit_nor_vegetable():
    assert jar_product("tulip", "other", 30, False) is None
    assert keg_product("tulip", "other", 30, False) is None


def test_should_make_pickles_from_hops_and_wheat_in_the_jar():
    assert jar_product("hops", "vegetable", 25, False) == ArtisanProduct("pickles", 100)
    assert jar_product("wheat", "vegetable", 25, False) == ArtisanProduct("pickles", 100)


def test_should_make_green_tea_from_tea_leaves_and_juice_from_rice():
    assert keg_product("tea-leaves", "vegetable", 50, False, dataset_price=100) == ArtisanProduct("green-tea", 100)
    assert keg_product("unmilled-rice", "vegetable", 30, False) == ArtisanProduct("juice", 67)


def test_should_prefer_the_dataset_price_over_the_formula():
    assert keg_product("starfruit", "fruit", 750, False, dataset_price=2000) == ArtisanProduct("wine", 2000)
    assert jar_product("starfruit", "fruit", 750, True, dataset_price=1000) == ArtisanProduct("jelly", 1400)


def test_should_count_extra_yield_when_valuing_jar_and_keg_per_day():
    v = seed_value(CAULIFLOWER, 750, 0.2, 1, "none", 0, False, produce_id="starfruit", kind="fruit")
    assert v.harvests == 2
    assert v.prices == QualityPrices(750, 937, 1125, 1500)
    assert v.jar == ArtisanProduct("jelly", 1550)
    assert v.keg == ArtisanProduct("wine", 2250)
    assert v.jar_gold_per_day_tenths == round(10 * 2 * 1.2 * 1550 / 28)
    assert v.keg_gold_per_day_tenths == round(10 * 2 * 1.2 * 2250 / 28)


def test_should_leave_comparison_empty_when_produce_has_no_price():
    v = seed_value(PARSNIP, None, 0, 1, "none", 0, False, produce_id="parsnip", kind="vegetable")
    assert (v.prices, v.jar, v.keg, v.jar_gold_per_day_tenths, v.keg_gold_per_day_tenths) == (
        None,
        None,
        None,
        None,
        None,
    )


def test_should_give_zero_per_day_when_the_seed_does_not_mature():
    v = seed_value(CAULIFLOWER, 175, 0, 20, "none", 0, False, produce_id="cauliflower", kind="vegetable")
    assert (v.jar_gold_per_day_tenths, v.keg_gold_per_day_tenths) == (0, 0)


def test_should_brew_coffee_from_coffee_beans_at_the_price_per_bean():
    assert keg_product("coffee-bean", "other", 15, False, dataset_price=30) == ArtisanProduct("coffee", 30)
    assert jar_product("coffee-bean", "other", 15, False) is None
