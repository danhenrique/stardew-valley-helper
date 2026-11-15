"""Planting schedule rules (spec §6). Pure functions, no I/O.

Dates are converted to an absolute day number: abs = (year - 1) * 112 + season_index * 28 + day.
"""

from dataclasses import dataclass, field
from typing import Literal, get_args

Season = Literal["spring", "summer", "fall", "winter"]
Fertilizer = Literal["none", "speed-gro", "deluxe-speed-gro", "hyper-speed-gro"]
Location = Literal["farm", "greenhouse", "ginger-island"]
Status = Literal["growing", "ready", "regrowing", "finished", "dead"]

SEASONS: tuple[Season, ...] = get_args(Season)
DAYS_PER_SEASON = 28
DAYS_PER_YEAR = DAYS_PER_SEASON * len(SEASONS)

# Game constants: the dataset has no growth speed values.
FERTILIZER_SPEED_PCT: dict[str, int] = {"none": 0, "speed-gro": 10, "deluxe-speed-gro": 25, "hyper-speed-gro": 33}
AGRICULTURIST_PCT = 10
GREENHOUSE_HARVEST_LIMIT = 10
FRUIT_TREE_HARVEST_LIMIT = 10
MAX_PHASE_PASSES = 3
WILL_NOT_MATURE = "will_not_mature"
APPROXIMATE = "approximate"


class OutOfSeasonError(ValueError):
    """The seed cannot be planted (or harvested) in that season on the farm."""


class NotRegrowingError(ValueError):
    """Only regrowing crops can be scheduled from a known harvest date."""


@dataclass(frozen=True)
class GameDate:
    year: int
    season: Season
    day: int

    def __post_init__(self) -> None:
        if self.year < 1:
            raise ValueError("year must be >= 1")
        if self.season not in SEASONS:
            raise ValueError(f"unknown season {self.season!r}")
        if not 1 <= self.day <= DAYS_PER_SEASON:
            raise ValueError("day must be between 1 and 28")

    def to_abs(self) -> int:
        return (self.year - 1) * DAYS_PER_YEAR + SEASONS.index(self.season) * DAYS_PER_SEASON + self.day

    @classmethod
    def from_abs(cls, abs_day: int) -> GameDate:
        zero_based = abs_day - 1
        year, rest = divmod(zero_based, DAYS_PER_YEAR)
        season_index, day = divmod(rest, DAYS_PER_SEASON)
        return cls(year + 1, SEASONS[season_index], day + 1)


@dataclass(frozen=True)
class CropSpec:
    seasons: list[Season]
    growth_days: int
    phases: list[int] | None
    regrow_days: int | None


@dataclass(frozen=True)
class FruitTreeSpec:
    season: Season
    days_to_mature: int
    max_fruit_on_tree: int


@dataclass
class Schedule:
    first_harvest: GameDate | None
    harvests: list[GameDate]
    total_harvests: int
    infinite: bool
    dies_on: GameDate | None
    status: Status
    days_until_next: int | None
    approximate: bool = False
    warnings: list[str] = field(default_factory=list)


def _season_of(abs_day: int) -> Season:
    return GameDate.from_abs(abs_day).season


def _next_season_start(abs_day: int) -> int:
    """Absolute day of day 1 of the season after the one containing abs_day."""
    return ((abs_day - 1) // DAYS_PER_SEASON + 1) * DAYS_PER_SEASON + 1


def _ceil_pct(total: int, pct: int) -> int:
    return -(-total * pct // 100)


def effective_growth_days(crop: CropSpec, speed_pct: int) -> tuple[int, bool]:
    """Days from planting to first harvest, replicating the game's phase reduction."""
    if speed_pct <= 0:
        return (sum(crop.phases) if crop.phases else crop.growth_days), False
    if not crop.phases:
        return crop.growth_days - _ceil_pct(crop.growth_days, speed_pct), True
    phases = list(crop.phases)
    days_to_remove = _ceil_pct(sum(phases), speed_pct)
    passes = 0
    while days_to_remove > 0 and passes < MAX_PHASE_PASSES:
        for index, length in enumerate(phases):
            if (index == 0 and length > 1) or (index > 0 and length > 0):
                phases[index] -= 1
                days_to_remove -= 1
            if days_to_remove <= 0:
                break
        passes += 1
    return sum(phases), False


def speed_pct(fertilizer: Fertilizer, agriculturist: bool) -> int:
    return FERTILIZER_SPEED_PCT[fertilizer] + (AGRICULTURIST_PCT if agriculturist else 0)


def _death_abs(seasons: list[Season], from_abs: int, location: Location) -> int | None:
    """Day 1 of the first following season the crop cannot live in (farm only)."""
    if location != "farm" or set(SEASONS) <= set(seasons):
        return None
    start = _next_season_start(from_abs)
    while _season_of(start) in seasons:
        start += DAYS_PER_SEASON
    return start


def _check_season(crop: CropSpec, date: GameDate, location: Location) -> None:
    if location == "farm" and date.season not in crop.seasons:
        raise OutOfSeasonError(f"{date.season} is not a growing season for this crop")


def _status(
    first: int | None, harvests: list[int], death: int | None, today: int, open_ended: bool
) -> tuple[Status, int | None]:
    if death is not None and today >= death:
        return "dead", None
    if first is None:
        return "growing", None
    if today < first:
        return "growing", first - today
    if today in harvests:
        return "ready", 0
    upcoming = [h for h in harvests if h > today]
    if upcoming:
        return "regrowing", upcoming[0] - today
    return ("regrowing", None) if open_ended else ("finished", None)


def _regrowths(start: int, regrow_days: int, death: int | None, limit: int) -> list[int]:
    """start, start + regrow, … — before death, or `limit` items when there is no death."""
    days = []
    day = start
    while (death is None and len(days) < limit) or (death is not None and day < death):
        days.append(day)
        day += regrow_days
    return days


def _open_ended_harvests(first: int, regrow_days: int, today: int, limit: int) -> list[int]:
    """The next `limit` harvests of an endless regrowth series, from today (or the first harvest)."""
    periods_elapsed = 0 if today <= first else -(-(today - first) // regrow_days)
    start = first + periods_elapsed * regrow_days
    return [start + k * regrow_days for k in range(limit)]


def _to_dates(days: list[int]) -> list[GameDate]:
    return [GameDate.from_abs(day) for day in days]


def _maybe_date(day: int | None) -> GameDate | None:
    return GameDate.from_abs(day) if day is not None else None


def crop_schedule(
    crop: CropSpec,
    planted_on: GameDate,
    fertilizer: Fertilizer,
    agriculturist: bool,
    location: Location,
    today: GameDate,
) -> Schedule:
    _check_season(crop, planted_on, location)
    growth, approximate = effective_growth_days(crop, speed_pct(fertilizer, agriculturist))
    first = planted_on.to_abs() + growth
    death = _death_abs(crop.seasons, planted_on.to_abs(), location)
    warnings = [APPROXIMATE] if approximate else []
    now = today.to_abs()

    if death is not None and first >= death:
        status, days = _status(None, [], death, now, False)
        return Schedule(None, [], 0, False, _maybe_date(death), status, days, approximate, [*warnings, WILL_NOT_MATURE])

    open_ended = death is None and crop.regrow_days is not None
    if open_ended:
        assert crop.regrow_days is not None
        harvests = _open_ended_harvests(first, crop.regrow_days, now, GREENHOUSE_HARVEST_LIMIT)
        total = len(harvests)
    elif crop.regrow_days is not None:
        harvests = _regrowths(first, crop.regrow_days, death, GREENHOUSE_HARVEST_LIMIT)
        total = len(harvests)
    else:
        harvests = [first]
        total = 1

    # A single-harvest crop is gone once harvested: it never "dies" at the season change.
    status_death = death if crop.regrow_days is not None else None
    status, days = _status(first, harvests, status_death, now, open_ended)
    return Schedule(
        GameDate.from_abs(first),
        _to_dates(harvests),
        total,
        open_ended,
        _maybe_date(death),
        status,
        days,
        approximate,
        warnings,
    )


def regrow_schedule(crop: CropSpec, last_harvest_on: GameDate, location: Location, today: GameDate) -> Schedule:
    """Next regrowth harvests when only the date of one harvest is known (spec §6)."""
    if crop.regrow_days is None:
        raise NotRegrowingError("Only regrowing crops can start from a harvest date")
    _check_season(crop, last_harvest_on, location)
    known = last_harvest_on.to_abs()
    death = _death_abs(crop.seasons, known, location)
    now = today.to_abs()
    open_ended = death is None
    if open_ended:
        upcoming = _open_ended_harvests(known + crop.regrow_days, crop.regrow_days, now, GREENHOUSE_HARVEST_LIMIT)
        harvests = [known, *upcoming]
    else:
        harvests = _regrowths(known, crop.regrow_days, death, GREENHOUSE_HARVEST_LIMIT)
    status, days = _status(known, harvests, death, now, open_ended)
    return Schedule(
        last_harvest_on,
        _to_dates(harvests),
        len(harvests) - 1,
        open_ended,
        _maybe_date(death),
        status,
        days,
    )


def fruit_tree_schedule(tree: FruitTreeSpec, planted_on: GameDate, location: Location, today: GameDate) -> Schedule:
    mature = planted_on.to_abs() + tree.days_to_mature
    now = today.to_abs()

    def fruits_on(day: int) -> bool:
        return location != "farm" or _season_of(day) == tree.season

    first = mature
    while not fruits_on(first):
        first = _next_season_start(first)
    day = max(first, now)
    harvests: list[int] = []
    while len(harvests) < FRUIT_TREE_HARVEST_LIMIT:
        if fruits_on(day):
            harvests.append(day)
            day += 1
        else:
            day = _next_season_start(day)
    status, days = _status(first, harvests, None, now, True)
    return Schedule(GameDate.from_abs(first), _to_dates(harvests), len(harvests), True, None, status, days)


def expected_yield(schedule: Schedule, quantity: int, average_extra_yield: float) -> tuple[float, float | None]:
    """(per harvest, whole schedule) for `quantity` plants; open-ended series have no total."""
    per_harvest = round(quantity * (1 + average_extra_yield), 1)
    total = None if schedule.infinite else round(per_harvest * schedule.total_harvests, 1)
    return per_harvest, total
