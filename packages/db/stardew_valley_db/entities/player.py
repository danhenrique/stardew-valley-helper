"""Player data (spec §5.3). The player id is the opaque Cognito identity sub."""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Self

from pynamodb.attributes import BooleanAttribute, MapAttribute, NumberAttribute, UnicodeAttribute
from ulid import ULID

from .base import BaseModel

PROFILE_SK = "PROFILE"
PLANTING_PREFIX = "PLANTING#"
MACHINE_PREFIX = "MACHINE#"
FARMPLAN_PREFIX = "FARMPLAN#"


def player_pk(player_id: str) -> str:
    return f"PLAYER#{player_id}"


def _now() -> str:
    return datetime.now(UTC).isoformat()


class GameDateAttribute(MapAttribute):
    year = NumberAttribute()
    season = UnicodeAttribute()
    day = NumberAttribute()


class PlayerProfile(BaseModel, discriminator="PlayerProfile"):
    agriculturist = BooleanAttribute(default=False)
    artisan = BooleanAttribute(default=False)
    community_center_restored = BooleanAttribute(default=False, attr_name="communityCenterRestored")
    key_to_town = BooleanAttribute(default=False, attr_name="keyToTown")
    boat_repaired = BooleanAttribute(default=False, attr_name="boatRepaired")
    rain_today = BooleanAttribute(default=False, attr_name="rainToday")
    current_date = GameDateAttribute(attr_name="currentDate")
    updated_at = UnicodeAttribute(null=True, attr_name="updatedAt")

    @classmethod
    def get_or_default(cls, player_id: str) -> PlayerProfile:
        try:
            return cls.get(player_pk(player_id), PROFILE_SK)
        except cls.DoesNotExist:
            return cls(
                pk=player_pk(player_id),
                sk=PROFILE_SK,
                agriculturist=False,
                artisan=False,
                community_center_restored=False,
                key_to_town=False,
                boat_repaired=False,
                rain_today=False,
                current_date=GameDateAttribute(year=1, season="spring", day=1),
            )


class Planting(BaseModel, discriminator="Planting"):
    seed_id = UnicodeAttribute(attr_name="seedId")
    anchor = UnicodeAttribute(default="planted")
    planted_on = GameDateAttribute(null=True, attr_name="plantedOn")
    last_harvest_on = GameDateAttribute(null=True, attr_name="lastHarvestOn")
    fertilizer = UnicodeAttribute(default="none")
    location = UnicodeAttribute(default="farm")
    quantity = NumberAttribute(default=1)
    label = UnicodeAttribute(null=True)
    created_at = UnicodeAttribute(attr_name="createdAt")

    @property
    def planting_id(self) -> str:
        return self.sk.removeprefix(PLANTING_PREFIX)

    @classmethod
    def new(cls, player_id: str, **fields: Any) -> Self:
        fields.setdefault("anchor", "planted")
        return cls(
            pk=player_pk(player_id),
            sk=f"{PLANTING_PREFIX}{ULID()}",
            created_at=_now(),
            **fields,
        )

    @classmethod
    def key(cls, player_id: str, planting_id: str) -> tuple[str, str]:
        return player_pk(player_id), f"{PLANTING_PREFIX}{planting_id}"

    @staticmethod
    def list_for_player(player_id: str) -> tuple[PlayerProfile | None, list[Planting]]:
        profile: PlayerProfile | None = None
        plantings: list[Planting] = []
        for item in BaseModel.query(player_pk(player_id)):
            if isinstance(item, PlayerProfile):
                profile = item
            elif isinstance(item, Planting):
                plantings.append(item)
        return profile, plantings


class MachineBatch(BaseModel, discriminator="MachineBatch"):
    machine_id = UnicodeAttribute(attr_name="machineId")
    output_id = UnicodeAttribute(attr_name="outputId")
    started_on = GameDateAttribute(attr_name="startedOn")
    quantity = NumberAttribute(default=1)
    start_quality = UnicodeAttribute(null=True, attr_name="startQuality")
    location = UnicodeAttribute(default="farm")
    label = UnicodeAttribute(null=True)
    created_at = UnicodeAttribute(attr_name="createdAt")

    @property
    def machine_batch_id(self) -> str:
        return self.sk.removeprefix(MACHINE_PREFIX)

    @classmethod
    def new(cls, player_id: str, **fields: Any) -> Self:
        return cls(
            pk=player_pk(player_id),
            sk=f"{MACHINE_PREFIX}{ULID()}",
            created_at=_now(),
            **fields,
        )

    @classmethod
    def key(cls, player_id: str, machine_batch_id: str) -> tuple[str, str]:
        return player_pk(player_id), f"{MACHINE_PREFIX}{machine_batch_id}"


class FarmPlan(BaseModel, discriminator="FarmPlan"):
    name = UnicodeAttribute()
    farm_id = UnicodeAttribute(attr_name="farmId")
    objects_json = UnicodeAttribute(attr_name="objectsJson")
    version = NumberAttribute(default=1)
    created_at = UnicodeAttribute(attr_name="createdAt")
    updated_at = UnicodeAttribute(attr_name="updatedAt")

    @property
    def farm_plan_id(self) -> str:
        return self.sk.removeprefix(FARMPLAN_PREFIX)

    @classmethod
    def new(cls, player_id: str, **fields: Any) -> Self:
        now = _now()
        fields.setdefault("version", 1)
        return cls(
            pk=player_pk(player_id),
            sk=f"{FARMPLAN_PREFIX}{ULID()}",
            created_at=now,
            updated_at=now,
            **fields,
        )

    @classmethod
    def key(cls, player_id: str, plan_id: str) -> tuple[str, str]:
        return player_pk(player_id), f"{FARMPLAN_PREFIX}{plan_id}"

    @staticmethod
    def list_for_player(player_id: str) -> list[FarmPlan]:
        return [
            item
            for item in BaseModel.query(player_pk(player_id), BaseModel.sk.startswith(FARMPLAN_PREFIX))
            if isinstance(item, FarmPlan)
        ]


@dataclass
class PlayerRecords:
    profile: PlayerProfile | None
    plantings: list[Planting] = field(default_factory=list)
    machines: list[MachineBatch] = field(default_factory=list)


def player_records(player_id: str) -> PlayerRecords:
    """Profile, plantings and machine batches of a player in a single query."""
    records = PlayerRecords(profile=None)
    for item in BaseModel.query(player_pk(player_id)):
        if isinstance(item, PlayerProfile):
            records.profile = item
        elif isinstance(item, Planting):
            records.plantings.append(item)
        elif isinstance(item, MachineBatch):
            records.machines.append(item)
    return records
