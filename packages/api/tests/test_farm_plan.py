import pytest
from stardew_valley_db.entities import FarmMap, PlannerObject

from stardew_valley_api.farm_plan import validate_objects
from stardew_valley_api.game_data import entity_key, list_folder
from stardew_valley_api.models import PlanObject


@pytest.fixture
def farm(seeded):
    return FarmMap.get(*entity_key("farms", "standard"))


@pytest.fixture
def catalog(seeded):
    return {str(p.entity_id): p for p in list_folder("planner-objects") if isinstance(p, PlannerObject)}


def objs(*items):
    return [PlanObject(t=t, x=x, y=y) for t, x, y in items]


def test_should_return_none_when_objects_are_valid(farm, catalog):
    assert validate_objects(objs(("farmhouse", 4, 1), ("tilled-soil", 0, 0)), farm, catalog) is None


def test_should_reject_unknown_object(farm, catalog):
    assert validate_objects(objs(("farmhouse", 4, 1), ("foo", 0, 0)), farm, catalog) == "Unknown object: foo"


def test_should_reject_object_whose_footprint_leaves_the_farm(farm, catalog):
    x = int(farm.width) - 6
    result = validate_objects(objs(("farmhouse", 4, 1), ("barn", x, 0)), farm, catalog)
    assert result == f"Object outside the farm: barn at ({x}, 0)"


def test_should_reject_too_many_objects(farm, catalog):
    many = objs(("farmhouse", 4, 1), *[("tilled-soil", 0, 0)] * 8000)
    assert validate_objects(many, farm, catalog) == "Too many objects (max 8000)"


def test_should_reject_missing_fixed_object(farm, catalog):
    assert validate_objects(objs(("tilled-soil", 0, 0)), farm, catalog) == "Missing fixed object: farmhouse"
