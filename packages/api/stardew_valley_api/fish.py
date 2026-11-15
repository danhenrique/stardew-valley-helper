"""Fish catch data as typed output (spec: fish design). Pure functions, no I/O."""

import re
from typing import Any, cast

from stardew_valley_db.entities import Item

from .game_data import localized_name, to_plain
from .models import FishCategory, FishOut, FishTool, FishWeather, FishWindowOut, LocalizedTextOut

MINUTES_PER_DAY = 1440
_TIME = re.compile(r"^(\d{2}):(\d{2})( \(\+1d\))?$")
_TOOLS: dict[str, FishTool] = {"rod": "rod", "crabPot": "crab-pot"}
_CATEGORIES: dict[str | None, FishCategory] = {
    None: "regular",
    "night-market": "night-market",
    "legendary": "legendary",
    "legendary-ii": "legendary-ii",
}
_WEATHER = {"any", "sun", "rain"}
_SEASONS = {"spring", "summer", "fall", "winter"}


def parse_time(value: str) -> int:
    """``"HH:MM"`` → minutes since 00:00; the ``" (+1d)"`` suffix adds a day."""
    match = _TIME.match(value)
    if not match:
        raise ValueError(f"Invalid time: {value!r}")
    hours, minutes = int(match[1]), int(match[2])
    if hours > 23 or minutes > 59:
        raise ValueError(f"Invalid time: {value!r}")
    return hours * 60 + minutes + (MINUTES_PER_DAY if match[3] else 0)


def _window(raw: dict[str, Any]) -> FishWindowOut:
    start, end = parse_time(raw["from"]), parse_time(raw["to"])
    if start >= end:
        raise ValueError("Window must end after it starts")
    return FishWindowOut(from_minute=start, to_minute=end)


def fish_out(item: Item) -> FishOut:
    """Typed fish from an imported ``peixes`` item; raises ``ValueError`` on bad data."""
    catch = to_plain(item.catch) if item.catch else None
    if not catch:
        raise ValueError("Missing catch data")
    if item.subtype not in _CATEGORIES:
        raise ValueError(f"Unknown subtype: {item.subtype!r}")
    tool = _TOOLS.get(catch.get("tool"))
    if tool is None:
        raise ValueError(f"Unknown tool: {catch.get('tool')!r}")
    weather = catch.get("weather")
    seasons = catch.get("seasons") or []
    if weather not in _WEATHER or not seasons or not set(seasons) <= _SEASONS:
        raise ValueError("Invalid weather or seasons")
    windows = [_window(w) for w in catch.get("timeWindows") or []]
    if not windows:
        raise ValueError("Missing time windows")
    location = catch.get("location") or {}
    return FishOut(
        id=item.entity_id,
        name=localized_name(item) or LocalizedTextOut(),
        tool=tool,
        category=_CATEGORIES[item.subtype],
        seasons=seasons,
        weather=cast(FishWeather, weather),
        windows=windows,
        location=LocalizedTextOut(en=location.get("en"), pt_br=location.get("ptBr")),
        location_verified=bool(catch.get("locationVerified")),
    )
