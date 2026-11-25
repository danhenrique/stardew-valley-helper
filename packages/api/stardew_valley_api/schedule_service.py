"""Builds a planting schedule from the game data stored in DynamoDB."""

from typing import cast

from fastapi import HTTPException
from stardew_valley_db.entities import Item

from .models import GameDateIn, PlantingIn, ScheduleOut
from .schedule import (
    CropSpec,
    FruitTreeSpec,
    GameDate,
    NotRegrowingError,
    OutOfSeasonError,
    Schedule,
    Season,
    crop_schedule,
    expected_yield,
    fruit_tree_schedule,
    regrow_schedule,
)

NOT_PLANTABLE = "Item is not plantable"
OUT_OF_SEASON = "Seed cannot be planted in this season"
NOT_REGROWING = "Only regrowing crops can start from a harvest date"


def rule_error(message: str, loc: list[str] | None = None) -> HTTPException:
    """422 shaped like FastAPI's validation errors, so the generated client can parse it."""
    where = loc if loc is not None else ["body", "seedId"]
    return HTTPException(status_code=422, detail=[{"loc": where, "msg": message, "type": "value_error"}])


def game_date(value: GameDateIn) -> GameDate:
    return GameDate(value.year, value.season, value.day)


def _load_item(seed_id: str) -> Item:
    try:
        item = Item.get(f"ITEM#{seed_id}", "ITEM")
    except Item.DoesNotExist:
        raise HTTPException(status_code=404, detail="Seed not found") from None
    return item


def crop_spec(item: Item) -> CropSpec:
    """Growth rules of a seed item; the caller checks ``item.crop`` first."""
    assert item.crop is not None
    return CropSpec(
        seasons=cast(list[Season], list(item.crop.seasons)),
        growth_days=int(item.crop.growth_days),
        phases=[int(cast(float, p)) for p in item.crop.phases] if item.crop.phases else None,
        regrow_days=int(item.crop.regrow_days) if item.crop.regrow_days is not None else None,
    )


def schedule_for(planting: PlantingIn, agriculturist: bool, today: GameDateIn) -> Schedule:
    return _schedule_for_item(_load_item(planting.seed_id), planting, agriculturist, today)


def _schedule_for_item(item: Item, planting: PlantingIn, agriculturist: bool, today: GameDateIn) -> Schedule:
    now = game_date(today)
    try:
        if item.crop:
            crop = crop_spec(item)
            if planting.anchor == "harvested":
                assert planting.last_harvest_on is not None
                return regrow_schedule(crop, game_date(planting.last_harvest_on), planting.location, now)
            assert planting.planted_on is not None
            return crop_schedule(
                crop, game_date(planting.planted_on), planting.fertilizer, agriculturist, planting.location, now
            )
        if item.fruit_tree:
            if planting.anchor == "harvested":
                raise NotRegrowingError(NOT_REGROWING)
            assert planting.planted_on is not None
            tree = FruitTreeSpec(
                season=cast(Season, item.fruit_tree.season),
                days_to_mature=int(item.fruit_tree.days_to_mature),
                max_fruit_on_tree=int(item.fruit_tree.max_fruit_on_tree or 3),
            )
            return fruit_tree_schedule(tree, game_date(planting.planted_on), planting.location, now)
    except OutOfSeasonError:
        raise rule_error(OUT_OF_SEASON) from None
    except NotRegrowingError:
        raise rule_error(NOT_REGROWING) from None
    raise rule_error(NOT_PLANTABLE)


def planting_schedule(planting: PlantingIn, agriculturist: bool, today: GameDateIn) -> ScheduleOut:
    """Schedule plus the expected harvest for the planting's quantity (one item read)."""
    item = _load_item(planting.seed_id)
    schedule = _schedule_for_item(item, planting, agriculturist, today)
    extra = float(item.crop.average_extra_yield or 0) if item.crop else 0.0
    return schedule_out(schedule, *expected_yield(schedule, planting.quantity, extra))


def schedule_out(schedule: Schedule, yield_per_harvest: float, expected_total_yield: float | None) -> ScheduleOut:
    def out(date: GameDate | None) -> GameDateIn | None:
        return GameDateIn(year=date.year, season=date.season, day=date.day) if date else None

    return ScheduleOut(
        first_harvest=out(schedule.first_harvest),
        harvests=[GameDateIn(year=d.year, season=d.season, day=d.day) for d in schedule.harvests],
        total_harvests=schedule.total_harvests,
        infinite=schedule.infinite,
        dies_on=out(schedule.dies_on),
        status=schedule.status,
        days_until_next=schedule.days_until_next,
        approximate=schedule.approximate,
        warnings=schedule.warnings,
        yield_per_harvest=yield_per_harvest,
        expected_total_yield=expected_total_yield,
    )
