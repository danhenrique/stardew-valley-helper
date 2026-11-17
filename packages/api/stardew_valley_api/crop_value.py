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

# Keg outputs with a fixed price, whatever the crop price (the dataset has no price for them).
KEG_SPECIAL: dict[str, tuple[str, int]] = {"hops": ("pale-ale", 300), "wheat": ("beer", 200)}
# Crops whose jar/keg products could not be checked against an official source: no comparison.
ARTISAN_UNVERIFIED = frozenset({"tea-leaves", "unmilled-rice"})
ARTISAN_BONUS = 1.4


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
    return QualityPrices(sell_price, math.floor(sell_price * 1.25), math.floor(sell_price * 1.5), sell_price * 2)


def _artisan(item: str, price: int, artisan: bool) -> ArtisanProduct:
    return ArtisanProduct(item, math.floor(price * ARTISAN_BONUS) if artisan else price)


def jar_product(produce_id: str, kind: CropKind, sell_price: int, artisan: bool) -> ArtisanProduct | None:
    """Jelly from fruit, pickles from vegetables; artisan goods are always normal quality."""
    if produce_id in ARTISAN_UNVERIFIED or produce_id in KEG_SPECIAL or kind == "other":
        return None
    return _artisan("jelly" if kind == "fruit" else "pickles", 2 * sell_price + 50, artisan)


def keg_product(produce_id: str, kind: CropKind, sell_price: int, artisan: bool) -> ArtisanProduct | None:
    """Wine from fruit, juice from vegetables, or a fixed-price brew (hops, wheat)."""
    if produce_id in KEG_SPECIAL:
        item, price = KEG_SPECIAL[produce_id]
        return _artisan(item, price, artisan)
    if produce_id in ARTISAN_UNVERIFIED or kind == "other":
        return None
    if kind == "fruit":
        return _artisan("wine", 3 * sell_price, artisan)
    return _artisan("juice", math.floor(2.25 * sell_price), artisan)


def harvest_days(crop: CropSpec, from_day: int, speed: Fertilizer, agriculturist: bool) -> tuple[list[int], bool]:
    """Harvest days (1–28) planting on ``from_day``; single-harvest crops are replanted on harvest day."""
    growth, approximate = effective_growth_days(crop, speed_pct(speed, agriculturist))
    days = []
    day = from_day + growth
    while day <= DAYS_PER_SEASON:
        days.append(day)
        day += crop.regrow_days or growth
    return days, approximate


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
) -> SeedValue:
    ratio = QUALITY_RATIO.get(fertilizer, 0)
    speed = cast(Fertilizer, "none" if fertilizer in QUALITY_RATIO else fertilizer)
    harvests, approximate = harvest_days(crop, from_day, speed, agriculturist)
    days = DAYS_PER_SEASON - from_day + 1
    gold_total = gold_per_day_tenths = None
    if sell_price is not None:
        total = len(harvests) * gold_per_harvest(sell_price, extra_yield, quality_chances(farming_level, ratio))
        gold_total = round(total)
        gold_per_day_tenths = round(10 * total / days)
    prices = jar = keg = None
    jar_per_day = keg_per_day = None
    if sell_price is not None and produce_id is not None:
        prices = quality_prices(sell_price)
        jar = jar_product(produce_id, kind, sell_price, artisan)
        keg = keg_product(produce_id, kind, sell_price, artisan)
        units = len(harvests) * (1 + extra_yield)
        jar_per_day = round(10 * units * jar.price / days) if jar else None
        keg_per_day = round(10 * units * keg.price / days) if keg else None
    return SeedValue(
        len(harvests),
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
    )
