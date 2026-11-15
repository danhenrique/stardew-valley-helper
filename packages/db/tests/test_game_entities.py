from stardew_valley_db.entities import (
    Achievement,
    Animal,
    Building,
    Bundle,
    Category,
    Collection,
    CropAttribute,
    Festival,
    ForagingEvent,
    FruitTreeAttribute,
    GameMeta,
    Item,
    LocalizedText,
    MonsterGoal,
    Movie,
    Perfection,
    Reminder,
    Shop,
    UniversalGifts,
    Villager,
)
from stardew_valley_db.entities.keys import ITEM_FOLDERS, SEASON_INDEX, entity_pk, type_gsi1pk

NAME = LocalizedText(en="Test", pt_br="Teste")


def test_should_build_keys_and_list_item_folders_when_using_key_helpers():
    assert entity_pk("ITEM", "x") == "ITEM#x"
    assert type_gsi1pk("frutas") == "TYPE#frutas"
    assert SEASON_INDEX == {"spring": 0, "summer": 1, "fall": 2, "winter": 3}
    assert "sementes" in ITEM_FOLDERS and "personagens" not in ITEM_FOLDERS
    assert len(ITEM_FOLDERS) == 29


def test_should_set_item_keys_and_camel_case_attributes_when_building_seed():
    item = Item.build(
        entity_id="test-seed",
        item_type="sementes",
        name=LocalizedText(en="Test Seed", pt_br=None),
        name_verified=False,
        crop=CropAttribute(
            seasons=["spring"],
            growth_days=8,
            phases=[1, 1, 2, 2, 2],
            regrow_days=4,
            last_planting_day=20,
            average_extra_yield=0.02,
            produce="test-fruit",
        ),
    )
    data = item.serialize()
    assert data["pk"] == {"S": "ITEM#test-seed"} and data["sk"] == {"S": "ITEM"}
    assert data["gsi1pk"] == {"S": "TYPE#sementes"} and data["gsi1sk"] == {"S": "test-seed"}
    assert data["entityType"] == {"S": "Item"}
    assert "growthDays" in data["crop"]["M"] and "regrowDays" in data["crop"]["M"]
    assert "itemType" in data and "nameVerified" in data and "entityId" in data
    assert data["name"]["M"] == {"en": {"S": "Test Seed"}}  # null ptBr is not stored


def test_should_serialize_fruit_tree_in_camel_case_when_building_sapling():
    item = Item.build(
        entity_id="test-sapling",
        item_type="arvores-frutiferas",
        name=NAME,
        name_verified=True,
        fruit_tree=FruitTreeAttribute(
            fruit="test-fruit", season="fall", days_to_mature=28, fruits_per_day=1, max_fruit_on_tree=3
        ),
    )
    tree = item.serialize()["fruitTree"]["M"]
    assert {"daysToMature", "maxFruitOnTree", "fruitsPerDay"} <= set(tree)


def test_should_set_pk_sk_and_type_index_when_building_simple_entities():
    cases = [
        (
            Villager.build(entity_id="v", name=NAME, name_verified=True, marriageable=True),
            "VILLAGER#v",
            "VILLAGER",
            "TYPE#personagens",
        ),
        (Shop.build(entity_id="s", name=NAME, name_verified=True), "SHOP#s", "SHOP", "TYPE#lojas"),
        (
            Building.build(entity_id="b", name=NAME, name_verified=True, price=100),
            "BUILDING#b",
            "BUILDING",
            "TYPE#construcoes",
        ),
        (
            Animal.build(entity_id="a", name=NAME, name_verified=True, housing="coop"),
            "ANIMAL#a",
            "ANIMAL",
            "TYPE#animais",
        ),
        (Category.build(entity_id="c", name=NAME, name_verified=False), "CATEGORY#c", "CATEGORY", "TYPE#categorias"),
        (Movie.build(entity_id="m", name=NAME, name_verified=True), "MOVIE#m", "MOVIE", "TYPE#filmes"),
        (
            MonsterGoal.build(entity_id="g", name=NAME, name_verified=True, kills_required=10),
            "MONSTER_GOAL#g",
            "MONSTER_GOAL",
            "TYPE#metas-monstros",
        ),
        (
            Collection.build(entity_id="col", name=NAME, name_verified=False),
            "COLLECTION#col",
            "COLLECTION",
            "TYPE#colecoes",
        ),
        (
            Perfection.build(entity_id="p", name=NAME, name_verified=False, categories=[]),
            "PERFECTION#p",
            "PERFECTION",
            "TYPE#perfeicao",
        ),
    ]
    for model, pk, sk, gsi1pk in cases:
        assert (model.pk, model.sk, model.gsi1pk) == (pk, sk, gsi1pk), type(model).__name__


def test_should_sort_by_season_and_day_when_building_festival():
    festival = Festival.build(
        entity_id="f", name=NAME, name_verified=True, season="summer", start_day=9, end_day=9, shops_closed=True
    )
    assert festival.gsi1sk == "1#09"
    assert "startDay" in festival.serialize() and "shopsClosed" in festival.serialize()


def test_should_sort_by_season_and_day_when_building_foraging_event():
    event = ForagingEvent.build(
        entity_id="test-foraging",
        name=NAME,
        name_verified=True,
        season="fall",
        start_day=8,
        end_day=11,
        item="test-fruit",
    )
    assert event.gsi1sk == "2#08"
    assert event.gsi1pk == "TYPE#eventos-coleta"
    assert "startDay" in event.serialize() and "endDay" in event.serialize()


def test_should_zero_pad_order_when_building_achievement():
    achievement = Achievement.build(entity_id="a", name=NAME, name_verified=True, description=NAME, order=7)
    assert achievement.gsi1sk == "007"


def test_should_group_by_room_when_building_bundle():
    bundle = Bundle.build(
        entity_id="b",
        name=NAME,
        name_verified=True,
        room={"id": "pantry", "name": {"en": "Pantry", "ptBr": "Copa"}},
        quality="gold",
        remixed=False,
        slots_required=3,
    )
    assert bundle.gsi1sk == "pantry#b"
    assert "slotsRequired" in bundle.serialize()


def test_should_use_fixed_keys_when_building_universal_gifts_and_meta():
    gifts = UniversalGifts.build(description=NAME, tier_labels={"loves": {"en": "Loved", "ptBr": "Adorados"}})
    assert (gifts.pk, gifts.sk, gifts.gsi1pk) == ("UNIVERSAL_GIFTS", "UNIVERSAL_GIFTS", None)
    meta = GameMeta.build(entity_id="enums", payload={"seasons": {}})
    assert (meta.pk, meta.sk) == ("META#enums", "META")


def test_should_index_by_order_when_building_reminder():
    reminder = Reminder.build(
        entity_id="test-reminder",
        name=NAME,
        name_verified=False,
        trigger={"kind": "weekly", "weekdays": ["fri"]},
        order=3,
    )
    assert reminder.gsi1pk == "TYPE#lembretes" and reminder.gsi1sk == "03"
    assert "trigger" in reminder.serialize()
