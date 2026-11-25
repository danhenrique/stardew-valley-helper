"""Pure validation of a farm plan against its farm and the planner catalog."""

import json

from stardew_valley_db.entities import FarmMap, PlannerObject

from .game_data import to_plain
from .models import PlanObject

MAX_OBJECTS = 8000
MAX_PLANS = 20


def encode_objects(objects: list[PlanObject]) -> str:
    return json.dumps([[o.t, o.x, o.y] for o in objects], separators=(",", ":"))


def decode_objects(objects_json: str) -> list[PlanObject]:
    return [PlanObject(t=t, x=x, y=y) for t, x, y in json.loads(objects_json)]


def fixed_objects(farm: FarmMap) -> list[PlanObject]:
    return [PlanObject(t=f["t"], x=int(f["x"]), y=int(f["y"])) for f in to_plain(farm.fixed)]


def validate_objects(objects: list[PlanObject], farm: FarmMap, catalog: dict[str, PlannerObject]) -> str | None:
    """Error message, or None when the plan is valid. Collisions are not checked."""
    if len(objects) > MAX_OBJECTS:
        return f"Too many objects (max {MAX_OBJECTS})"
    width, height = int(farm.width), int(farm.height)
    for obj in objects:
        entry = catalog.get(obj.t)
        if entry is None:
            return f"Unknown object: {obj.t}"
        size = to_plain(entry.size)
        if obj.x + int(size["w"]) > width or obj.y + int(size["h"]) > height:
            return f"Object outside the farm: {obj.t} at ({obj.x}, {obj.y})"
    present = {o.t for o in objects}
    for fixed in fixed_objects(farm):
        if fixed.t not in present:
            return f"Missing fixed object: {fixed.t}"
    return None
