"""Machine schedule rules (spec §4). Pure functions, no I/O."""

import math
from dataclasses import dataclass, replace
from fractions import Fraction
from typing import Literal

from stardew_valley_api.schedule import GameDate, Location

MachineKind = Literal["batch", "continuous", "aging"]
Quality = Literal["normal", "silver", "gold", "iridium"]
StartQuality = Literal["normal", "silver", "gold"]
MachineStatus = Literal["processing", "ready", "aging", "iridium"]

MACHINE_KINDS: dict[str, MachineKind] = {
    "keg": "batch",
    "preserves-jar": "batch",
    "oil-maker": "batch",
    "tapper": "continuous",
    "heavy-tapper": "continuous",
    "crystalarium": "continuous",
    "bee-house": "continuous",
    "cask": "aging",
}
# Outputs whose processing time depends on the item (dataset gives an average).
APPROXIMATE_OUTPUTS: frozenset[tuple[str, str]] = frozenset(
    {("keg", "beer"), ("keg", "pale-ale"), ("oil-maker", "oil")}
)
QUALITY_FRACTION: dict[Quality, Fraction] = {
    "normal": Fraction(0),
    "silver": Fraction(1, 4),
    "gold": Fraction(1, 2),
    "iridium": Fraction(1),
}
COLLECTION_LIMIT = 10


class InvalidMachineInputError(ValueError):
    """The machine, output or option combination is not valid."""


@dataclass(frozen=True)
class MachineSchedule:
    ready_on: GameDate | None
    collections: list[GameDate]
    milestones: list[tuple[Quality, GameDate]]
    infinite: bool
    status: MachineStatus
    days_until_next: int | None
    approximate: bool
    warnings: list[str]


def batch_schedule(days: int, started_on: GameDate, today: GameDate) -> MachineSchedule:
    ready_abs = started_on.to_abs() + days
    left = max(0, ready_abs - today.to_abs())
    return MachineSchedule(
        ready_on=GameDate.from_abs(ready_abs),
        collections=[],
        milestones=[],
        infinite=False,
        status="ready" if left == 0 else "processing",
        days_until_next=left,
        approximate=False,
        warnings=[],
    )


def _next_collection(prev_abs: int, days: int, pauses_in_winter: bool) -> int:
    """The collection after `prev_abs`. A paused machine (farm bee house) sits idle all winter:
    started or collected in winter, or due in winter, it next collects on Spring 1 of the next year."""
    if pauses_in_winter:
        prev = GameDate.from_abs(prev_abs)
        if prev.season == "winter":
            return GameDate(prev.year + 1, "spring", 1).to_abs()
    nxt = prev_abs + days
    if pauses_in_winter and GameDate.from_abs(nxt).season == "winter":
        nxt = GameDate(GameDate.from_abs(nxt).year + 1, "spring", 1).to_abs()
    return nxt


def continuous_schedule(days: int, started_on: GameDate, today: GameDate, *, pauses_in_winter: bool) -> MachineSchedule:
    today_abs = today.to_abs()
    current = started_on.to_abs()
    collections: list[int] = []
    while len(collections) < COLLECTION_LIMIT:
        current = _next_collection(current, days, pauses_in_winter)
        if current >= today_abs:
            collections.append(current)
    left = collections[0] - today_abs
    return MachineSchedule(
        ready_on=GameDate.from_abs(collections[0]),
        collections=[GameDate.from_abs(a) for a in collections],
        milestones=[],
        infinite=True,
        status="ready" if left == 0 else "processing",
        days_until_next=left,
        approximate=False,
        warnings=[],
    )


def aging_schedule(
    total_days: int, start_quality: StartQuality, started_on: GameDate, today: GameDate
) -> MachineSchedule:
    start_abs = started_on.to_abs()
    today_abs = today.to_abs()
    base = QUALITY_FRACTION[start_quality]
    milestones: list[tuple[Quality, GameDate]] = []
    for quality, fraction in QUALITY_FRACTION.items():
        if fraction > base:
            offset = math.ceil(total_days * (fraction - base))
            milestones.append((quality, GameDate.from_abs(start_abs + offset)))
    upcoming = [d.to_abs() - today_abs for _, d in milestones if d.to_abs() > today_abs]
    iridium = milestones[-1][1]
    reached = today_abs >= iridium.to_abs()
    return MachineSchedule(
        ready_on=iridium,
        collections=[],
        milestones=milestones,
        infinite=False,
        status="iridium" if reached else "aging",
        days_until_next=None if reached else min(upcoming),
        approximate=False,
        warnings=[],
    )


def machine_schedule(
    machine_id: str,
    output_id: str,
    days: int,
    started_on: GameDate,
    location: Location,
    start_quality: StartQuality | None,
    today: GameDate,
) -> MachineSchedule:
    kind = MACHINE_KINDS.get(machine_id)
    if kind is None:
        raise InvalidMachineInputError("Unknown machine")
    if start_quality is not None and kind != "aging":
        raise InvalidMachineInputError("Start quality only applies to the cask")
    if start_quality == "iridium":
        raise InvalidMachineInputError("Start quality cannot be iridium")
    if days < 1:
        raise InvalidMachineInputError("Days must be at least 1")
    if machine_id == "bee-house" and location not in ("farm", "ginger-island"):
        raise InvalidMachineInputError("Bee house can only be on the farm or Ginger Island")
    if kind == "batch":
        result = batch_schedule(days, started_on, today)
    elif kind == "continuous":
        pauses = machine_id == "bee-house" and location == "farm"
        result = continuous_schedule(days, started_on, today, pauses_in_winter=pauses)
    else:
        result = aging_schedule(days, start_quality or "normal", started_on, today)
    approximate = (machine_id, output_id) in APPROXIMATE_OUTPUTS
    return replace(result, approximate=approximate)
