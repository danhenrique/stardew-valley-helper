from stardew_valley_db.entities import (
    BundleRequirement,
    GiftTaste,
    Ingredient,
    Member,
    MovieTaste,
    Produces,
    Recipe,
    ShopOffer,
)


def test_should_link_villager_and_item_when_building_gift_taste():
    gift = GiftTaste.build(
        owner_pk="VILLAGER#test-villager", tier="loves", target_kind="ITEM", target_id="test-item", except_ids=None
    )
    assert (gift.pk, gift.sk) == ("VILLAGER#test-villager", "GIFT#loves#ITEM#test-item")
    assert (gift.gsi2pk, gift.gsi2sk) == ("ITEM#test-item", "GIFT#loves#VILLAGER#test-villager")
    assert gift.serialize()["entityType"] == {"S": "GiftTaste"}


def test_should_invert_to_category_and_keep_exceptions_when_universal_gift_targets_category():
    gift = GiftTaste.build(
        owner_pk="UNIVERSAL_GIFTS", tier="likes", target_kind="CATEGORY", target_id="cooking", except_ids=["bread"]
    )
    assert gift.sk == "GIFT#likes#CATEGORY#cooking"
    assert (gift.gsi2pk, gift.gsi2sk) == ("CATEGORY#cooking", "GIFT#likes#UNIVERSAL")
    assert gift.serialize()["except"] == {"L": [{"S": "bread"}]}


def test_should_link_villager_and_movie_when_building_movie_taste():
    taste = MovieTaste.build(villager_id="test-villager", level="loved", target_kind="MOVIE", target_id="test-movie")
    assert (taste.pk, taste.sk) == ("VILLAGER#test-villager", "MOVIE_TASTE#loved#MOVIE#test-movie")
    assert (taste.gsi2pk, taste.gsi2sk) == ("MOVIE#test-movie", "MOVIE_TASTE#loved#VILLAGER#test-villager")


def test_should_use_two_digit_index_and_camel_case_when_building_shop_offer():
    offer = ShopOffer.build("test-shop", "test-item", 3, price=100, price_by_year={"year1": 1, "year2plus": 2})
    assert (offer.pk, offer.sk) == ("SHOP#test-shop", "OFFER#ITEM#test-item#03")
    assert (offer.gsi2pk, offer.gsi2sk) == ("ITEM#test-item", "OFFER#SHOP#test-shop#03")
    assert "priceByYear" in offer.serialize()


def test_should_store_recipe_under_result_item_when_building_recipe():
    recipe = Recipe.build("test-dish", "cooking", ingredients=[{"item": "test-item", "qty": 1}])
    assert (recipe.pk, recipe.sk, recipe.gsi2pk) == ("ITEM#test-dish", "RECIPE#cooking", None)


def test_should_invert_to_ingredient_when_building_ingredient():
    ingredient = Ingredient.build("test-dish", "cooking", "test-item", 2)
    assert (ingredient.pk, ingredient.sk) == ("ITEM#test-dish", "INGREDIENT#cooking#ITEM#test-item")
    assert (ingredient.gsi2pk, ingredient.gsi2sk) == ("ITEM#test-item", "USED_IN#ITEM#test-dish")
    assert ingredient.serialize()["recipeKind"] == {"S": "cooking"}


def test_should_invert_to_product_when_building_produces():
    rel = Produces.build("test-seed", "test-fruit", via="crop", days=None)
    assert (rel.pk, rel.sk) == ("ITEM#test-seed", "PRODUCES#ITEM#test-fruit")
    assert (rel.gsi2pk, rel.gsi2sk) == ("ITEM#test-fruit", "PRODUCED_BY#ITEM#test-seed")


def test_should_invert_to_item_when_building_member():
    member = Member.build("COLLECTION", "test-collection", "test-item")
    assert (member.pk, member.sk) == ("COLLECTION#test-collection", "MEMBER#ITEM#test-item")
    assert (member.gsi2pk, member.gsi2sk) == ("ITEM#test-item", "MEMBER_OF#COLLECTION#test-collection")


def test_should_invert_to_item_when_bundle_requires_item():
    req = BundleRequirement.build("test-bundle", 1, "test-item", qty=5, seasons=["spring"])
    assert (req.pk, req.sk) == ("BUNDLE#test-bundle", "REQUIRES#01#ITEM#test-item")
    assert (req.gsi2pk, req.gsi2sk) == ("ITEM#test-item", "IN_BUNDLE#test-bundle")


def test_should_have_no_inverted_key_when_bundle_requires_gold():
    req = BundleRequirement.build("test-bundle", 0, None, gold=2500)
    assert req.sk == "REQUIRES#00#GOLD" and req.gsi2pk is None
