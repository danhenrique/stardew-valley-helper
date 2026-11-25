"""Core game entities (spec §5.1). Each `build` fills pk/sk/gsi1 keys."""

from typing import Any, Self

from pynamodb.attributes import (
    BooleanAttribute,
    ListAttribute,
    MapAttribute,
    NumberAttribute,
    UnicodeAttribute,
)

from .attributes import CropAttribute, FruitTreeAttribute, LocalizedText
from .base import BaseModel
from .keys import SEASON_INDEX, entity_pk, type_gsi1pk


class GameEntity(BaseModel):
    """Common fields of every imported game record. Not stored on its own."""

    PREFIX: str = ""
    SK: str = ""
    FOLDER: str | None = None

    entity_id = UnicodeAttribute(attr_name="entityId")
    name = LocalizedText(null=True)
    name_verified = BooleanAttribute(null=True, attr_name="nameVerified")

    def _gsi1sk(self) -> str:
        return self.entity_id

    def _folder(self) -> str | None:
        return self.FOLDER

    @classmethod
    def build(cls, **fields: Any) -> Self:
        model = cls(**fields)
        model.pk = entity_pk(cls.PREFIX, model.entity_id)
        model.sk = cls.SK
        folder = model._folder()
        if folder:
            model.gsi1pk = type_gsi1pk(folder)
            model.gsi1sk = model._gsi1sk()
        return model


class Item(GameEntity, discriminator="Item"):
    PREFIX, SK = "ITEM", "ITEM"

    item_type = UnicodeAttribute(attr_name="itemType")
    subtype = UnicodeAttribute(null=True)
    tags = ListAttribute(of=UnicodeAttribute, null=True)
    sell_price = NumberAttribute(null=True, attr_name="sellPrice")
    museum_donation = BooleanAttribute(null=True, attr_name="museumDonation")
    artisan = MapAttribute(null=True)
    average_forage_value = NumberAttribute(null=True, attr_name="averageForageValue")
    crop = CropAttribute(null=True)
    fruit_tree = FruitTreeAttribute(null=True, attr_name="fruitTree")
    catch = MapAttribute(null=True)
    processing = ListAttribute(null=True)
    machine_category = UnicodeAttribute(null=True, attr_name="machineCategory")

    def _folder(self) -> str | None:
        return self.item_type


class Villager(GameEntity, discriminator="Villager"):
    PREFIX, SK, FOLDER = "VILLAGER", "VILLAGER", "villagers"

    birthday = MapAttribute(null=True)
    marriageable = BooleanAttribute(null=True)


class Shop(GameEntity, discriminator="Shop"):
    PREFIX, SK, FOLDER = "SHOP", "SHOP", "shops"

    schedule = MapAttribute(null=True)
    schedule_text = MapAttribute(null=True, attr_name="scheduleText")
    schedule_text_verified = BooleanAttribute(null=True, attr_name="scheduleTextVerified")
    access = MapAttribute(null=True)


class Building(GameEntity, discriminator="Building"):
    PREFIX, SK, FOLDER = "BUILDING", "BUILDING", "buildings"

    category = UnicodeAttribute(null=True)
    price = NumberAttribute(null=True)
    build_days = NumberAttribute(null=True, attr_name="buildDays")
    built_by = UnicodeAttribute(null=True, attr_name="builtBy")
    upgrade_from = UnicodeAttribute(null=True, attr_name="upgradeFrom")
    materials = ListAttribute(null=True)


class FarmMap(GameEntity, discriminator="FarmMap"):
    PREFIX, SK, FOLDER = "FARM", "FARM", "farms"

    width = NumberAttribute()
    height = NumberAttribute()
    tiles = UnicodeAttribute()
    fixed = ListAttribute(of=MapAttribute)


class PlannerObject(GameEntity, discriminator="PlannerObject"):
    PREFIX, SK, FOLDER = "PLANNER_OBJECT", "PLANNER_OBJECT", "planner-objects"

    item = UnicodeAttribute(null=True)
    category = UnicodeAttribute()
    placement = UnicodeAttribute()
    size = MapAttribute()
    range = MapAttribute(null=True)
    human_door = MapAttribute(null=True, attr_name="humanDoor")
    animal_door = MapAttribute(null=True, attr_name="animalDoor")
    paint = BooleanAttribute()
    removable = BooleanAttribute()
    icon = UnicodeAttribute(null=True)


class Animal(GameEntity, discriminator="Animal"):
    PREFIX, SK, FOLDER = "ANIMAL", "ANIMAL", "animals"

    housing = UnicodeAttribute(null=True)
    purchase = MapAttribute(null=True)


class Festival(GameEntity, discriminator="Festival"):
    PREFIX, SK, FOLDER = "FESTIVAL", "FESTIVAL", "festivals"

    season = UnicodeAttribute()
    start_day = NumberAttribute(attr_name="startDay")
    end_day = NumberAttribute(attr_name="endDay")
    shops_closed = BooleanAttribute(null=True, attr_name="shopsClosed")

    def _gsi1sk(self) -> str:
        return f"{SEASON_INDEX[self.season]}#{int(self.start_day):02d}"


class ForagingEvent(GameEntity, discriminator="ForagingEvent"):
    PREFIX, SK, FOLDER = "FORAGING_EVENT", "FORAGING_EVENT", "foraging-events"

    season = UnicodeAttribute()
    start_day = NumberAttribute(attr_name="startDay")
    end_day = NumberAttribute(attr_name="endDay")
    item = UnicodeAttribute(null=True)

    def _gsi1sk(self) -> str:
        return f"{SEASON_INDEX[self.season]}#{int(self.start_day):02d}"


class Reminder(GameEntity, discriminator="Reminder"):
    PREFIX, SK, FOLDER = "REMINDER", "REMINDER", "reminders"

    detail = LocalizedText(null=True)
    trigger = MapAttribute(null=True)
    night_market_daily = BooleanAttribute(null=True, attr_name="nightMarketDaily")
    suppress_on_festival = BooleanAttribute(null=True, attr_name="suppressOnFestival")
    order = NumberAttribute(null=True)

    def _gsi1sk(self) -> str:
        return f"{int(self.order or 0):02d}"


class Bundle(GameEntity, discriminator="Bundle"):
    PREFIX, SK, FOLDER = "BUNDLE", "BUNDLE", "bundles"

    room = MapAttribute(null=True)
    quality = UnicodeAttribute(null=True)
    remixed = BooleanAttribute(null=True)
    slots_required = NumberAttribute(null=True, attr_name="slotsRequired")

    def _gsi1sk(self) -> str:
        room_id = self.room.as_dict().get("id") if self.room else ""
        return f"{room_id}#{self.entity_id}"


class Category(GameEntity, discriminator="Category"):
    PREFIX, SK, FOLDER = "CATEGORY", "CATEGORY", "categories"

    note = UnicodeAttribute(null=True)


class Movie(GameEntity, discriminator="Movie"):
    PREFIX, SK, FOLDER = "MOVIE", "MOVIE", "movies"


class Achievement(GameEntity, discriminator="Achievement"):
    PREFIX, SK, FOLDER = "ACHIEVEMENT", "ACHIEVEMENT", "achievements"

    description = LocalizedText(null=True)
    order = NumberAttribute(null=True)

    def _gsi1sk(self) -> str:
        return f"{int(self.order or 0):03d}"


class MonsterGoal(GameEntity, discriminator="MonsterGoal"):
    PREFIX, SK, FOLDER = "MONSTER_GOAL", "MONSTER_GOAL", "monster-goals"

    kills_required = NumberAttribute(null=True, attr_name="killsRequired")
    location = UnicodeAttribute(null=True)
    reward = UnicodeAttribute(null=True)


class Collection(GameEntity, discriminator="Collection"):
    PREFIX, SK, FOLDER = "COLLECTION", "COLLECTION", "collections"


class Perfection(GameEntity, discriminator="Perfection"):
    PREFIX, SK, FOLDER = "PERFECTION", "PERFECTION", "perfection"

    categories = ListAttribute(null=True)


class UniversalGifts(BaseModel, discriminator="UniversalGifts"):
    description = LocalizedText(null=True)
    tier_labels = MapAttribute(null=True, attr_name="tierLabels")

    @classmethod
    def build(cls, **fields: Any) -> Self:
        return cls(pk="UNIVERSAL_GIFTS", sk="UNIVERSAL_GIFTS", **fields)


class GameMeta(BaseModel, discriminator="GameMeta"):
    entity_id = UnicodeAttribute(attr_name="entityId")
    payload = MapAttribute()

    @classmethod
    def build(cls, **fields: Any) -> Self:
        model = cls(**fields)
        model.pk = entity_pk("META", model.entity_id)
        model.sk = "META"
        return model
