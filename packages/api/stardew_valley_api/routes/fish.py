"""Fish catalog endpoint."""

from stardew_valley_db.entities import Item

from ..fish import fish_out
from ..game_data import list_folder
from ..init import app, logger, tracer
from ..models import FishOut


@app.get("/fish")
@tracer.capture_method
def list_fish() -> list[FishOut]:
    fish: list[FishOut] = []
    for item in list_folder("peixes"):
        if not isinstance(item, Item):
            continue
        try:
            fish.append(fish_out(item))
        except (ValueError, KeyError, TypeError) as error:
            logger.warning("Skipping invalid fish", extra={"fishId": item.entity_id, "reason": str(error)})
    return sorted(fish, key=lambda f: (f.name.pt_br or f.name.en or f.id).casefold())
