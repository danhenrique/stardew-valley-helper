"""API request/response models. JSON fields are camelCase."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from .machine_schedule import MachineKind, MachineStatus, Quality, StartQuality
from .schedule import Fertilizer, Location, Season, Status


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorDetail(CamelModel):
    detail: str


NOT_FOUND_RESPONSE: dict[int | str, dict[str, Any]] = {404: {"model": ErrorDetail, "description": "Not found"}}


class LocalizedTextOut(CamelModel):
    en: str | None = None
    pt_br: str | None = None


class GameEntityOut(CamelModel):
    type: str
    id: str
    name: LocalizedTextOut | None = None
    name_verified: bool | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class RelationOut(CamelModel):
    kind: str
    pk: str
    sk: str
    attributes: dict[str, Any] = Field(default_factory=dict)


class GameEntityDetailOut(GameEntityOut):
    relations: list[RelationOut] = Field(default_factory=list)


FishTool = Literal["rod", "crab-pot"]
FishCategory = Literal["regular", "night-market", "legendary", "legendary-ii"]
FishWeather = Literal["any", "sun", "rain"]


class FishWindowOut(CamelModel):
    from_minute: int
    to_minute: int


class FishOut(CamelModel):
    id: str
    name: LocalizedTextOut
    tool: FishTool
    category: FishCategory
    seasons: list[Season]
    weather: FishWeather
    windows: list[FishWindowOut]
    location: LocalizedTextOut
    location_verified: bool


class PlantableOut(CamelModel):
    id: str
    name: LocalizedTextOut | None = None
    kind: Literal["crop", "fruit_tree"]
    seasons: list[Season]
    growth_days: int | None = None
    regrow_days: int | None = None
    days_to_mature: int | None = None
    last_planting_day: int | None = None


class SeedValueOut(CamelModel):
    """Expected gold of a seed over a season window; money values are integers (tenths for per day)."""

    id: str
    harvests: int
    days: int
    gold_total: int | None = None
    gold_per_day_tenths: int | None = None
    will_not_mature: bool
    approximate: bool


class GameDateIn(CamelModel):
    year: int = Field(ge=1, le=999)
    season: Season
    day: int = Field(ge=1, le=28)


GameDateOut = GameDateIn


Anchor = Literal["planted", "harvested"]


class ProfileIn(CamelModel):
    current_date: GameDateIn
    agriculturist: bool = False
    community_center_restored: bool = False
    key_to_town: bool = False
    boat_repaired: bool = False
    rain_today: bool = False
    artisan: bool = False

    @model_validator(mode="after")
    def _one_profession(self) -> ProfileIn:
        # Agriculturist and Artisan are the two level-10 Tiller professions: only one can be chosen.
        if self.agriculturist and self.artisan:
            raise ValueError("Escolha só uma profissão")
        return self


ProfileOut = ProfileIn


class PlantingIn(CamelModel):
    seed_id: str = Field(min_length=1, max_length=80)
    anchor: Anchor = "planted"
    planted_on: GameDateIn | None = None
    last_harvest_on: GameDateIn | None = None
    fertilizer: Fertilizer = "none"
    location: Location = "farm"
    quantity: int = Field(default=1, ge=1, le=999)
    label: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def _one_anchor_date(self) -> PlantingIn:
        if self.anchor == "planted" and (self.planted_on is None or self.last_harvest_on is not None):
            raise ValueError("anchor 'planted' requires plantedOn only")
        if self.anchor == "harvested":
            if self.last_harvest_on is None or self.planted_on is not None:
                raise ValueError("anchor 'harvested' requires lastHarvestOn only")
            if self.fertilizer != "none":
                raise ValueError("fertilizer does not apply when starting from a harvest")
        return self


class ScheduleOut(CamelModel):
    first_harvest: GameDateOut | None
    harvests: list[GameDateOut]
    total_harvests: int
    infinite: bool
    dies_on: GameDateOut | None
    status: Status
    days_until_next: int | None
    approximate: bool
    warnings: list[str]
    yield_per_harvest: float
    expected_total_yield: float | None


class PlantingOut(PlantingIn):
    id: str
    schedule: ScheduleOut | None
    invalid: bool = False


class SchedulePreviewIn(PlantingIn):
    agriculturist: bool = False
    today: GameDateIn


class MachineOutputOut(CamelModel):
    id: str
    name: LocalizedTextOut | None = None
    days: int
    approximate: bool


class MachineOut(CamelModel):
    id: str
    name: LocalizedTextOut | None = None
    kind: MachineKind
    outputs: list[MachineOutputOut]


class MachineBatchIn(CamelModel):
    machine_id: str = Field(min_length=1, max_length=80)
    output_id: str = Field(min_length=1, max_length=80)
    started_on: GameDateIn
    quantity: int = Field(default=1, ge=1, le=999)
    start_quality: StartQuality | None = None
    location: Location = "farm"
    label: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def _cask_needs_start_quality(self) -> MachineBatchIn:
        if self.machine_id == "cask" and self.start_quality is None:
            raise ValueError("Cask requires startQuality")
        return self


class MilestoneOut(CamelModel):
    quality: Quality
    on: GameDateOut


class MachineScheduleOut(CamelModel):
    ready_on: GameDateOut | None
    collections: list[GameDateOut]
    milestones: list[MilestoneOut]
    infinite: bool
    status: MachineStatus
    days_until_next: int | None
    approximate: bool
    warnings: list[str]


class MachineBatchOut(MachineBatchIn):
    id: str
    schedule: MachineScheduleOut | None
    invalid: bool = False


class MeOut(CamelModel):
    profile: ProfileOut
    plantings: list[PlantingOut]
    machines: list[MachineBatchOut] = []


class MachineSchedulePreviewIn(MachineBatchIn):
    today: GameDateIn
