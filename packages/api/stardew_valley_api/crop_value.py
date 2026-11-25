"""Expected gold of a seed over a season window (spec: seed values design). Pure functions, no I/O.

The quality chances follow Stardew Profits (predictions.js), as ported in the MIT-licensed
stardew-valley-scheduler (cropProfit.ts). Growth reuses the game rules of ``schedule.py``.
"""

import math
from dataclasses import dataclass
from typing import Literal, cast

from .schedule import DAYS_PER_SEASON, CropSpec, Fertilizer, effective_growth_days, speed_pct

ValueFertilizer = Literal["none", "basic", "quality", "deluxe", "speed-gro", "deluxe-speed-gro", "hyper-speed-gro"]

QUALITY_RATIO: dict[str, int] = {"basic": 1, "quality": 2, "deluxe": 3}
IRIDIUM_RATIO = 3

CropKind = Literal["fruit", "vegetable", "other"]
ValueMode = Literal["window", "continuous"]

# Keg outputs that are not wine or juice, with the price used when the dataset has none.
KEG_SPECIAL: dict[str, tuple[str, int]] = {
    "hops": ("pale-ale", 300),
    "wheat": ("beer", 200),
    "tea-leaves": ("green-tea", 100),
    # 5 beans make one Coffee (150g): the value is per bean, like every other per-unit price here.
    "coffee-bean": ("coffee", 30),
}


@dataclass(frozen=True)
class QualityChances:
    normal: float
    silver: float
    gold: float
    iridium: float


@dataclass(frozen=True)
class QualityPrices:
    normal: int
    silver: int
    gold: int
    iridium: int


@dataclass(frozen=True)
class ArtisanProduct:
    item: str
    price: int


@dataclass(frozen=True)
class SeedValue:
    harvests: int
    days: int
    gold_total: int | None
    gold_per_day_tenths: int | None
    will_not_mature: bool
    approximate: bool
    prices: QualityPrices | None = None
    jar: ArtisanProduct | None = None
    keg: ArtisanProduct | None = None
    jar_gold_per_day_tenths: int | None = None
    keg_gold_per_day_tenths: int | None = None
    cycle_days: int | None = None


def quality_chances(farming_level: int, ratio: int) -> QualityChances:
    gold = 0.2 * (farming_level / 10) + 0.2 * ratio * ((farming_level + 2) / 12) + 0.01
    silver = min(0.75, gold * 2)
    if ratio >= IRIDIUM_RATIO:
        iridium = gold / 2
        return QualityChances(0, (1 - gold) * (1 - iridium), gold * (1 - iridium), iridium)
    return QualityChances((1 - gold) * (1 - silver), (1 - gold) * silver, gold, 0)


def gold_per_harvest(sell_price: int, extra_yield: float, chances: QualityChances) -> float:
    """Expected gold of one harvest; extra crops are always normal quality."""
    p = sell_price
    return (
        chances.normal * p
        + chances.silver * math.floor(p * 1.25)
        + chances.gold * math.floor(p * 1.5)
        + chances.iridium * p * 2
        + extra_yield * p
    )


def quality_prices(sell_price: int) -> QualityPrices:
    # Integer math: floats would floor 1.25 × p or 1.5 × p one gold low for some prices.
    return QualityPrices(sell_price, sell_price * 5 // 4, sell_price * 3 // 2, sell_price * 2)


def _artisan(item: str, price: int, artisan: bool) -> ArtisanProduct:
    # Artisan: +40%, floored; integer math avoids 180 × 1.4 = 251.999…
    return ArtisanProduct(item, price * 14 // 10 if artisan else price)


def jar_product(
    produce_id: str, kind: CropKind, sell_price: int, artisan: bool, dataset_price: int | None = None
) -> ArtisanProduct | None:
    """Jelly from fruit, pickles from vegetables; the dataset price wins over the 2p + 50 formula."""
    if kind == "other":
        return None
    item = "jelly" if kind == "fruit" else "pickles"
    return _artisan(item, dataset_price if dataset_price is not None else 2 * sell_price + 50, artisan)


def keg_product(
    produce_id: str, kind: CropKind, sell_price: int, artisan: bool, dataset_price: int | None = None
) -> ArtisanProduct | None:
    """Wine from fruit, juice from vegetables or a special brew; the dataset price wins over formulas."""
    if produce_id in KEG_SPECIAL:
        item, fallback = KEG_SPECIAL[produce_id]
    elif kind == "fruit":
        item, fallback = "wine", 3 * sell_price
    elif kind == "vegetable":
        item, fallback = "juice", sell_price * 9 // 4
    else:
        return None
    return _artisan(item, dataset_price if dataset_price is not None else fallback, artisan)


def harvest_days(crop: CropSpec, from_day: int, speed: Fertilizer, agriculturist: bool) -> tuple[list[int], bool]:
    """Harvest days (1–28) planting on ``from_day``; single-harvest crops are replanted on harvest day."""
    growth, approximate = effective_growth_days(crop, speed_pct(speed, agriculturist))
    days = []
    day = from_day + growth
    while day <= DAYS_PER_SEASON:
        days.append(day)
        day += crop.regrow_days or growth
    return days, approximate


def _split_fertilizer(fertilizer: ValueFertilizer) -> tuple[int, Fertilizer]:
    """Quality ratio and speed of a fertilizer; one tile holds one fertilizer."""
    ratio = QUALITY_RATIO.get(fertilizer, 0)
    return ratio, cast(Fertilizer, "none" if fertilizer in QUALITY_RATIO else fertilizer)


def _value(
    harvests: int,
    days: int,
    approximate: bool,
    sell_price: int | None,
    extra_yield: float,
    ratio: int,
    farming_level: int,
    produce_id: str | None,
    kind: CropKind,
    artisan: bool,
    artisan_prices: dict[str, int] | None,
    cycle_days: int | None = None,
) -> SeedValue:
    """Gold of ``harvests`` harvests spread over ``days`` days."""
    gold_total = gold_per_day_tenths = None
    if sell_price is not None:
        total = harvests * gold_per_harvest(sell_price, extra_yield, quality_chances(farming_level, ratio))
        gold_total = round(total)
        gold_per_day_tenths = round(10 * total / days)
    prices = jar = keg = None
    jar_per_day = keg_per_day = None
    if sell_price is not None and produce_id is not None:
        prices = quality_prices(sell_price)
        dataset = artisan_prices or {}
        jar = jar_product(produce_id, kind, sell_price, artisan, dataset.get("jarPrice"))
        keg = keg_product(produce_id, kind, sell_price, artisan, dataset.get("kegPrice"))
        units = harvests * (1 + extra_yield)
        jar_per_day = round(10 * units * jar.price / days) if jar else None
        keg_per_day = round(10 * units * keg.price / days) if keg else None
    return SeedValue(
        harvests,
        days,
        gold_total,
        gold_per_day_tenths,
        not harvests,
        approximate,
        prices,
        jar,
        keg,
        jar_per_day,
        keg_per_day,
        cycle_days,
    )


def seed_value(
    crop: CropSpec,
    sell_price: int | None,
    extra_yield: float,
    from_day: int,
    fertilizer: ValueFertilizer,
    farming_level: int,
    agriculturist: bool,
    produce_id: str | None = None,
    kind: CropKind = "other",
    artisan: bool = False,
    artisan_prices: dict[str, int] | None = None,
) -> SeedValue:
    ratio, speed = _split_fertilizer(fertilizer)
    harvests, approximate = harvest_days(crop, from_day, speed, agriculturist)
    days = DAYS_PER_SEASON - from_day + 1
    return _value(
        len(harvests),
        days,
        approximate,
        sell_price,
        extra_yield,
        ratio,
        farming_level,
        produce_id,
        kind,
        artisan,
        artisan_prices,
    )


def continuous_value(
    crop: CropSpec,
    sell_price: int | None,
    extra_yield: float,
    fertilizer: ValueFertilizer,
    farming_level: int,
    agriculturist: bool,
    produce_id: str | None = None,
    kind: CropKind = "other",
    artisan: bool = False,
    artisan_prices: dict[str, int] | None = None,
) -> SeedValue:
    """Steady state of a bed that never dies (greenhouse, Ginger Island): one harvest per cycle.

    Regrowing crops cycle every ``regrowDays`` (speed fertilizers do not touch regrowth, the first growth
    fades out over time); single-harvest crops are replanted, so they cycle every effective growth.
    """
    ratio, speed = _split_fertilizer(fertilizer)
    growth, approximate = effective_growth_days(crop, speed_pct(speed, agriculturist))
    cycle = crop.regrow_days or growth
    return _value(
        1,
        cycle,
        approximate and not crop.regrow_days,
        sell_price,
        extra_yield,
        ratio,
        farming_level,
        produce_id,
        kind,
        artisan,
        artisan_prices,
        cycle,
    )
