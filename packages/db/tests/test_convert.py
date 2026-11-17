import json
from pathlib import Path

import pytest

from stardew_valley_db.entities import (
    Achievement,
    Animal,
    Building,
    Bundle,
    BundleRequirement,
    Category,
    Collection,
    Festival,
    ForagingEvent,
    GameMeta,
    GiftTaste,
    Ingredient,
    Item,
    Member,
    Movie,
    MovieTaste,
    Perfection,
    Recipe,
    Reminder,
    Shop,
    ShopOffer,
    UniversalGifts,
    Villager,
)
from stardew_valley_db.importer.convert import convert_dataset
from stardew_valley_db.importer.load import ImportValidationError, load_dataset

FIXTURES = Path(__file__).parent / "fixtures" / "data"


@pytest.fixture(scope="module")
def result():
    return convert_dataset(load_dataset(FIXTURES))


def by_key(result, pk, sk):
    matches = [m for m in result.models if (m.pk, m.sk) == (pk, sk)]
    assert len(matches) == 1, f"{pk} {sk}: {len(matches)} matches"
    return matches[0]


def of_type(result, cls):
    return [m for m in result.models if type(m) is cls]


def write(path: Path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content if isinstance(content, str) else json.dumps(content))


def test_should_raise_when_type_does_not_match_folder(tmp_path):
    write(tmp_path / "frutas" / "x.json", {"id": "x", "type": "vegetais"})
    with pytest.raises(ImportValidationError) as error:
        load_dataset(tmp_path)
    assert error.value.path.as_posix().endswith("frutas/x.json")


def test_should_raise_when_file_is_not_json(tmp_path):
    write(tmp_path / "frutas" / "x.json", "{not json")
    with pytest.raises(ImportValidationError):
        load_dataset(tmp_path)


def test_should_raise_when_id_is_missing(tmp_path):
    write(tmp_path / "frutas" / "x.json", {"type": "frutas"})
    with pytest.raises(ImportValidationError):
        load_dataset(tmp_path)


def test_should_skip_index_pending_translations_and_readme_when_loading():
    dataset = load_dataset(FIXTURES)
    meta_ids = {doc["id"] for doc in dataset["_meta"]}
    assert meta_ids == {"enums", "locales"}
    assert "README" not in dataset


def test_should_create_item_with_crop_and_produces_when_converting_seed(result):
    seed = by_key(result, "ITEM#test-seed", "ITEM")
    assert isinstance(seed, Item) and seed.item_type == "sementes"
    assert (seed.crop.growth_days, seed.crop.regrow_days, list(seed.crop.phases)) == (8, 4, [1, 1, 2, 2, 2])
    assert by_key(result, "ITEM#test-seed", "PRODUCES#ITEM#test-fruit").via == "crop"


def test_should_keep_item_without_crop_when_converting_acorn_like_seed(result):
    assert by_key(result, "ITEM#test-acorn", "ITEM").crop is None


def test_should_create_fruit_tree_produces_with_days_when_converting_sapling(result):
    sapling = by_key(result, "ITEM#test-sapling", "ITEM")
    assert sapling.fruit_tree.days_to_mature == 28
    rel = by_key(result, "ITEM#test-sapling", "PRODUCES#ITEM#test-fruit")
    assert (rel.via, rel.days) == ("fruit_tree", 28)


def test_should_use_ptbr_and_fallback_null_when_converting_names(result):
    assert by_key(result, "ITEM#test-fruit", "ITEM").name.pt_br == "Fruta Teste"
    assert by_key(result, "ITEM#test-seed", "ITEM").name.pt_br is None


def test_should_rename_nested_ptbr_keys_when_converting_maps(result):
    keg = by_key(result, "ITEM#test-keg", "ITEM")
    assert keg.processing[0]["label"] == {"en": "Wine", "ptBr": "Vinho"}
    assert keg.machine_category == "artisan"


def test_should_create_recipe_and_ingredients_when_converting_cooking_recipe(result):
    recipe = by_key(result, "ITEM#test-dish", "RECIPE#cooking")
    assert isinstance(recipe, Recipe) and len(recipe.ingredients) == 2
    assert by_key(result, "ITEM#test-dish", "INGREDIENT#cooking#ITEM#test-fruit").qty == 2
    assert not [m for m in of_type(result, Ingredient) if "test-category" in m.sk]


def test_should_create_ingredient_per_option_when_recipe_has_any_of(result):
    keys = {m.sk for m in of_type(result, Ingredient) if m.pk == "ITEM#test-keg"}
    assert keys == {
        "INGREDIENT#crafting#ITEM#test-wood",
        "INGREDIENT#crafting#ITEM#test-fruit",
        "INGREDIENT#crafting#ITEM#test-veg",
    }


def test_should_create_machine_produces_when_converting_processing(result):
    rel = by_key(result, "ITEM#test-keg", "PRODUCES#ITEM#test-wine")
    assert (rel.via, rel.days) == ("machine", 7)


def test_should_create_gift_tastes_for_items_categories_and_plain_strings_when_converting_villager(result):
    assert isinstance(by_key(result, "VILLAGER#test-villager", "VILLAGER"), Villager)
    by_key(result, "VILLAGER#test-villager", "GIFT#loves#ITEM#test-fruit")
    liked = by_key(result, "VILLAGER#test-villager", "GIFT#likes#CATEGORY#test-category")
    assert list(liked.except_ids) == ["test-veg"]
    assert isinstance(by_key(result, "VILLAGER#test-villager", "GIFT#dislikesOrHates#ITEM#test-veg"), GiftTaste)


def test_should_create_movie_tastes_when_converting_villager(result):
    assert isinstance(by_key(result, "VILLAGER#test-villager", "MOVIE_TASTE#loved#MOVIE#test-movie"), MovieTaste)
    by_key(result, "VILLAGER#test-villager", "MOVIE_TASTE#liked#ITEM#test-snack")


def test_should_create_universal_gifts_when_converting_presentes(result):
    gifts = by_key(result, "UNIVERSAL_GIFTS", "UNIVERSAL_GIFTS")
    assert isinstance(gifts, UniversalGifts) and gifts.description.pt_br == "Aplica-se à maioria."
    rel = by_key(result, "UNIVERSAL_GIFTS", "GIFT#likes#CATEGORY#test-category")
    assert rel.gsi2sk == "GIFT#likes#UNIVERSAL"


def test_should_keep_offer_order_and_fields_when_converting_shop(result):
    assert isinstance(by_key(result, "SHOP#test-shop", "SHOP"), Shop)
    assert by_key(result, "SHOP#test-shop", "OFFER#ITEM#test-seed#00").season == "spring"
    assert by_key(result, "SHOP#test-shop", "OFFER#ITEM#test-seed#01").recipe is True
    fruit_offer = by_key(result, "SHOP#test-shop", "OFFER#ITEM#test-fruit#02")
    assert fruit_offer.price_by_year.as_dict() == {"year1": 50, "year2plus": 75}
    assert fruit_offer.currency.as_dict() == {"qiGems": 2}


def test_should_create_offer_and_diff_when_sold_at_has_no_shop_offer(result):
    offer = by_key(result, "SHOP#other-shop", "OFFER#ITEM#test-seed#00")
    assert isinstance(offer, ShopOffer) and offer.price == 120
    assert "soldAt without shop offer: test-seed @ other-shop" in result.diffs
    assert not [d for d in result.diffs if "@ test-shop" in d]


def test_should_report_gift_mirror_mismatch_when_item_lists_unknown_villager(result):
    assert "gift mismatch: test-fruit loves ghost-villager" in result.diffs
    assert not [d for d in result.diffs if "test-fruit loves test-villager" in d]


def test_should_create_members_when_converting_category_and_collection(result):
    assert isinstance(by_key(result, "CATEGORY#test-category", "CATEGORY"), Category)
    assert isinstance(by_key(result, "CATEGORY#test-category", "MEMBER#ITEM#test-veg"), Member)
    assert isinstance(by_key(result, "COLLECTION#test-museum", "COLLECTION"), Collection)
    by_key(result, "COLLECTION#test-museum", "MEMBER#ITEM#test-artifact")
    by_key(result, "COLLECTION#test-museum", "MEMBER#ITEM#test-mineral")


def test_should_create_item_and_gold_requirements_when_converting_bundle(result):
    bundle = by_key(result, "BUNDLE#test-bundle", "BUNDLE")
    assert isinstance(bundle, Bundle) and bundle.gsi1sk == "pantry#test-bundle"
    assert bundle.room.as_dict()["name"] == {"en": "Pantry", "ptBr": "Copa"}
    item_req = by_key(result, "BUNDLE#test-bundle", "REQUIRES#00#ITEM#test-fruit")
    assert isinstance(item_req, BundleRequirement) and item_req.qty == 5
    assert by_key(result, "BUNDLE#test-bundle", "REQUIRES#01#GOLD").gold == 2500


def test_should_convert_remaining_entity_types_when_converting_dataset(result):
    assert isinstance(by_key(result, "FESTIVAL#test-festival", "FESTIVAL"), Festival)
    assert isinstance(by_key(result, "FORAGING_EVENT#test-foraging", "FORAGING_EVENT"), ForagingEvent)
    assert by_key(result, "ACHIEVEMENT#test-achievement", "ACHIEVEMENT").gsi1sk == "007"
    assert isinstance(by_key(result, "MOVIE#test-movie", "MOVIE"), Movie)
    building = by_key(result, "BUILDING#test-barn", "BUILDING")
    assert isinstance(building, Building) and (building.price, building.build_days) == (6000, 3)
    assert isinstance(by_key(result, "ANIMAL#test-cow", "ANIMAL"), Animal)
    assert by_key(result, "MONSTER_GOAL#test-goal", "MONSTER_GOAL").kills_required == 10
    assert isinstance(by_key(result, "PERFECTION#test-perfection", "PERFECTION"), Perfection)
    assert by_key(result, "ITEM#test-snack", "ITEM").item_type == "lanches-cinema"


def test_should_store_meta_with_ptbr_keys_when_converting_meta(result):
    enums = by_key(result, "META#enums", "META")
    assert isinstance(enums, GameMeta) and enums.payload.as_dict()["seasons"]["ptBr"] == {"spring": "Primavera"}
    by_key(result, "META#locales", "META")


def test_should_produce_unique_keys_when_converting_dataset(result):
    keys = [(m.pk, m.sk) for m in result.models]
    assert len(keys) == len(set(keys))


def test_should_not_create_achievement_when_type_is_not_present():
    # Guard against importing the same entity class twice by mistake.
    assert of_type(convert_dataset({}), Achievement) == []


def test_should_convert_reminders_when_folder_is_lembretes(result):
    reminder = by_key(result, "REMINDER#test-reminder", "REMINDER")
    assert isinstance(reminder, Reminder)
    assert reminder.suppress_on_festival is True and reminder.trigger.as_dict()["weekdays"] == ["fri"]


def test_should_store_access_text_when_converting_shop(result):
    shop = by_key(result, "SHOP#test-shop", "SHOP")
    assert shop.access.as_dict() == {"en": "Requires the Rusty Key", "ptBr": "Requer Chave Enferrujada"}
