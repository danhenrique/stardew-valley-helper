"""Read-only game catalog endpoints."""

from dataclasses import asdict
from typing import Annotated, Any, cast

from fastapi import HTTPException, Query
from stardew_valley_db.entities import BaseModel, GameEntity, Item
from stardew_valley_db.entities.keys import ITEM_FOLDERS

from ..crop_value import CropKind, ValueFertilizer, seed_value
from ..game_data import (
    COMMON_ATTRIBUTES,
    KEY_ATTRIBUTES,
    entity_key,
    folder_of,
    is_known_folder,
    list_folder,
    localized_name,
    plain_attributes,
)
from ..init import app, tracer
from ..models import (
    NOT_FOUND_RESPONSE,
    ArtisanProductOut,
    GameEntityDetailOut,
    GameEntityOut,
    LocalizedTextOut,
    PlantableOut,
    QualityPricesOut,
    RelationOut,
    SeedValueOut,
)
from ..schedule import Location, Season
from ..schedule_service import crop_spec


def _entity_fields(model: GameEntity) -> dict[str, Any]:
    return {
        "type": folder_of(model),
        "id": model.entity_id,
        "name": localized_name(model),
        "name_verified": model.name_verified,
        "attributes": plain_attributes(model, KEY_ATTRIBUTES | COMMON_ATTRIBUTES),
    }


def _relation_out(model: BaseModel) -> RelationOut:
    return RelationOut(
        kind=type(model).__name__,
        pk=model.pk,
        sk=model.sk,
        attributes=plain_attributes(model, {"pk", "sk", "entity_type"}),
    )


def _require_folder(folder: str) -> None:
    if not is_known_folder(folder):
        raise HTTPException(status_code=404, detail="Unknown game data type")


# Items come last so they win when a building or category shares their id.
_NAMED_FOLDERS = ("construcoes", "categorias", *sorted(ITEM_FOLDERS))


# Declared before /game/{type} so "names" is not read as a folder.
@app.get("/game/names")
@tracer.capture_method
def list_game_names() -> dict[str, LocalizedTextOut]:
    names: dict[str, LocalizedTextOut] = {}
    for folder in _NAMED_FOLDERS:
        for model in list_folder(folder):
            name = localized_name(model)
            if name:
                names[model.entity_id] = name
    return names


@app.get("/game/{type}", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def list_game_entities(type: str) -> list[GameEntityOut]:
    _require_folder(type)
    return [GameEntityOut(**_entity_fields(model)) for model in list_folder(type)]


@app.get("/game/{type}/{id}", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def get_game_entity(type: str, id: str) -> GameEntityDetailOut:
    _require_folder(type)
    pk, sk = entity_key(type, id)
    items = list(BaseModel.query(pk))
    main = next((m for m in items if m.sk == sk and isinstance(m, GameEntity)), None)
    if main is None or folder_of(main) != type:
        raise HTTPException(status_code=404, detail="Game entity not found")
    relations = [_relation_out(m) for m in items if m is not main]
    return GameEntityDetailOut(**_entity_fields(main), relations=relations)


@app.get("/game/items/{id}/references")
@tracer.capture_method
def get_item_references(id: str, prefix: Annotated[str | None, Query(max_length=64)] = None) -> list[RelationOut]:
    condition = BaseModel.gsi2sk.startswith(prefix) if prefix else None
    return [_relation_out(m) for m in BaseModel.gsi2_index.query(f"ITEM#{id}", range_key_condition=condition)]


def _plantable(model: Item) -> PlantableOut | None:
    if model.crop:
        regrow = model.crop.regrow_days
        last_planting_day = model.crop.last_planting_day
        return PlantableOut(
            id=model.entity_id,
            name=localized_name(model),
            kind="crop",
            seasons=cast(list[Season], list(model.crop.seasons)),
            growth_days=int(model.crop.growth_days),
            regrow_days=int(regrow) if regrow is not None else None,
            last_planting_day=int(last_planting_day) if last_planting_day is not None else None,
        )
    if model.fruit_tree:
        return PlantableOut(
            id=model.entity_id,
            name=localized_name(model),
            kind="fruit_tree",
            seasons=[cast(Season, model.fruit_tree.season)],
            days_to_mature=int(model.fruit_tree.days_to_mature),
        )
    return None


@app.get("/plantables")
@tracer.capture_method
def list_plantables(season: Season | None = None, location: Location = "farm") -> list[PlantableOut]:
    plantables = []
    for folder in ("sementes", "arvores-frutiferas"):
        for model in list_folder(folder):
            plantable = _plantable(model) if isinstance(model, Item) else None
            if plantable is None:
                continue
            if location == "farm" and season and plantable.kind == "crop" and season not in plantable.seasons:
                continue
            plantables.append(plantable)
    return plantables


CROP_KINDS: dict[str, CropKind] = {"frutas": "fruit", "vegetais": "vegetable"}


def _sell_prices(produce_ids: set[str]) -> dict[str, tuple[int, CropKind]]:
    """Sell price and crop kind of each produce item that exists and has a price (one batch read)."""
    keys = [(f"ITEM#{produce}", "ITEM") for produce in sorted(produce_ids)]
    return {
        item.entity_id: (int(item.sell_price), CROP_KINDS.get(str(item.item_type), "other"))
        for item in Item.batch_get(keys)
        if isinstance(item, Item) and item.sell_price is not None
    }


@app.get("/plantables/value")
@tracer.capture_method
def list_seed_values(
    season: Season,
    from_day: Annotated[int, Query(alias="fromDay", ge=1, le=28)] = 1,
    fertilizer: ValueFertilizer = "none",
    farming_level: Annotated[int, Query(alias="farmingLevel", ge=0, le=10)] = 0,
    agriculturist: bool = False,
    artisan: bool = False,
) -> list[SeedValueOut]:
    seeds = [
        model
        for model in list_folder("sementes")
        if isinstance(model, Item) and model.crop and season in model.crop.seasons
    ]
    prices = _sell_prices({str(seed.crop.produce) for seed in seeds if seed.crop and seed.crop.produce})
    values = []
    for seed in seeds:
        assert seed.crop is not None
        produce = str(seed.crop.produce) if seed.crop.produce else None
        price, kind = prices.get(produce, (None, "other")) if produce else (None, "other")
        value = seed_value(
            crop_spec(seed),
            price,
            float(seed.crop.average_extra_yield or 0),
            from_day,
            fertilizer,
            farming_level,
            agriculturist,
            produce_id=produce,
            kind=kind,
            artisan=artisan,
        )
        values.append(
            SeedValueOut(
                id=seed.entity_id,
                harvests=value.harvests,
                days=value.days,
                gold_total=value.gold_total,
                gold_per_day_tenths=value.gold_per_day_tenths,
                will_not_mature=value.will_not_mature,
                approximate=value.approximate,
                prices=QualityPricesOut(**asdict(value.prices)) if value.prices else None,
                jar=ArtisanProductOut(**asdict(value.jar)) if value.jar else None,
                keg=ArtisanProductOut(**asdict(value.keg)) if value.keg else None,
                jar_gold_per_day_tenths=value.jar_gold_per_day_tenths,
                keg_gold_per_day_tenths=value.keg_gold_per_day_tenths,
            )
        )
    return values
