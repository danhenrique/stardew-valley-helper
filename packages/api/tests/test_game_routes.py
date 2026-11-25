import pytest


def test_should_return_camel_case_entities_when_listing_seeds(client):
    body = client.get("/game/seeds").json()
    seed = next(e for e in body if e["id"] == "test-seed")
    assert seed["type"] == "seeds" and seed["nameVerified"] is False
    assert seed["attributes"]["crop"]["growthDays"] == 8
    assert seed["name"] == {"en": "Test Seed", "ptBr": None}


def test_should_return_404_when_type_is_unknown(client):
    assert client.get("/game/not-a-folder").status_code == 404


def test_should_include_owned_relations_when_getting_item_detail(client):
    body = client.get("/game/seeds/test-seed").json()
    assert body["id"] == "test-seed"
    assert {r["kind"] for r in body["relations"]} == {"Produces"}


def test_should_include_gift_tastes_when_getting_villager_detail(client):
    kinds = {r["kind"] for r in client.get("/game/villagers/test-villager").json()["relations"]}
    assert {"GiftTaste", "MovieTaste"} <= kinds


def test_should_return_404_when_item_is_requested_under_another_type(client):
    assert client.get("/game/fruits/test-seed").status_code == 404


def test_should_return_404_when_entity_does_not_exist(client):
    assert client.get("/game/seeds/missing").status_code == 404


def test_should_return_inverted_relations_when_getting_item_references(client):
    refs = client.get("/game/items/test-fruit/references").json()
    assert {r["kind"] for r in refs} >= {"GiftTaste", "ShopOffer", "Produces", "Member", "Ingredient"}


def test_should_filter_by_sort_key_prefix_when_prefix_is_given(client):
    refs = client.get("/game/items/test-fruit/references", params={"prefix": "GIFT#"}).json()
    assert refs and all(r["attributes"]["gsi2sk"].startswith("GIFT#") for r in refs)


def test_should_list_only_season_crops_and_trees_when_farm_and_season_given(client):
    body = client.get("/plantables", params={"season": "summer", "location": "farm"}).json()
    ids = {p["id"] for p in body}
    assert ids == {"test-summer-seed", "test-sapling"}
    tree = next(p for p in body if p["id"] == "test-sapling")
    assert (tree["kind"], tree["daysToMature"], tree["seasons"]) == ("fruit_tree", 28, ["fall"])


def test_should_list_every_plantable_when_location_is_greenhouse(client):
    ids = {p["id"] for p in client.get("/plantables", params={"season": "summer", "location": "greenhouse"}).json()}
    assert ids == {"test-seed", "test-flat-seed", "test-ghost-seed", "test-summer-seed", "test-sapling"}


def test_should_expose_regrow_days_when_listing_plantables(client):
    seed = next(p for p in client.get("/plantables").json() if p["id"] == "test-seed")
    assert (seed["kind"], seed["growthDays"], seed["regrowDays"]) == ("crop", 8, 4)


def test_should_list_foraging_events_when_type_is_foraging_events(client):
    body = client.get("/game/foraging-events").json()
    event = next(e for e in body if e["id"] == "test-foraging")
    assert event["attributes"]["startDay"] == 8


def test_should_expose_last_planting_day_when_listing_plantables(client):
    body = client.get("/plantables").json()
    seed = next(p for p in body if p["id"] == "test-seed")
    tree = next(p for p in body if p["id"] == "test-sapling")
    assert seed["lastPlantingDay"] == 20
    assert tree["lastPlantingDay"] is None


def test_should_list_reminders_when_type_is_reminders(client):
    reminder = next(r for r in client.get("/game/reminders").json() if r["id"] == "test-reminder")
    assert reminder["attributes"]["trigger"] == {"kind": "weekly", "weekdays": ["fri"]}
    assert reminder["attributes"]["suppressOnFestival"] is True


def test_should_return_localized_names_of_items_categories_and_buildings(client):
    body = client.get("/game/names").json()
    assert body["test-category"] == {"en": "All tests", "ptBr": "Todos os testes"}
    assert body["test-fruit"] == {"en": "Test Fruit", "ptBr": "Fruta Teste"}
    assert body["test-barn"] == {"en": "Test Barn", "ptBr": "Celeiro Teste"}


def test_should_prefer_item_name_when_a_building_shares_the_id(client, monkeypatch):
    from stardew_valley_db.entities import Building

    from stardew_valley_api.routes import game

    real_list_folder = game.list_folder
    shadow = Building.build(entity_id="test-fruit", name={"en": "Shadow"})

    def fake_list_folder(folder):
        return [shadow] if folder == "buildings" else real_list_folder(folder)

    monkeypatch.setattr(game, "list_folder", fake_list_folder)
    assert client.get("/game/names").json()["test-fruit"]["en"] == "Test Fruit"


def _seed_values(client, **params):
    return {v["id"]: v for v in client.get("/plantables/value", params={"season": "spring", **params}).json()}


def test_should_list_only_farm_crops_of_the_season_when_listing_seed_values(client):
    assert set(_seed_values(client)) == {"test-flat-seed", "test-seed", "test-ghost-seed"}


def test_should_value_flat_seed_when_planting_on_day_1(client):
    # harvests on days 13 and 25; 2 × 80.796 = 161.592
    assert _seed_values(client)["test-flat-seed"] == {
        "id": "test-flat-seed",
        "harvests": 2,
        "days": 28,
        "goldTotal": 162,
        "goldPerDayTenths": 58,
        "willNotMature": False,
        "approximate": False,
        "prices": {"normal": 80, "silver": 100, "gold": 120, "iridium": 160},
        # 2 harvests × 210 / 28 days; 2 × 180 / 28
        "jar": {"item": "pickles", "price": 210},
        "keg": {"item": "juice", "price": 180},
        "jarGoldPerDayTenths": 150,
        "kegGoldPerDayTenths": 129,
        "cycleDays": None,
    }


def test_should_count_regrowth_and_extra_yield_when_seed_regrows(client):
    # days 9, 13, 17, 21, 25; 120·0.9702 + 150·0.0198 + 180·0.01 + 0.02·120 = 123.594 per harvest
    seed = _seed_values(client)["test-seed"]
    assert (seed["harvests"], seed["goldTotal"], seed["goldPerDayTenths"]) == (5, 618, 221)


def test_should_make_jelly_and_wine_when_produce_is_a_fruit(client):
    seed = _seed_values(client)["test-seed"]
    assert seed["jar"] == {"item": "jelly", "price": 290}
    assert seed["keg"] == {"item": "wine", "price": 360}
    assert seed["prices"]["iridium"] == 240


def test_should_use_the_dataset_artisan_prices_when_the_produce_has_them(client, monkeypatch):
    import stardew_valley_api.routes.game as game

    real = game._sell_prices

    def patched(ids):
        return {k: (p, kind, {"kegPrice": 999, "jarPrice": 555}) for k, (p, kind, _) in real(ids).items()}

    monkeypatch.setattr(game, "_sell_prices", patched)
    seed = _seed_values(client)["test-seed"]
    assert (seed["jar"]["price"], seed["keg"]["price"]) == (555, 999)


def test_should_raise_jar_and_keg_values_when_artisan(client):
    seed = _seed_values(client, artisan="true")["test-flat-seed"]
    assert (seed["jar"]["price"], seed["keg"]["price"]) == (294, 252)
    assert seed["goldTotal"] == 162


def test_should_have_no_value_when_produce_item_is_missing(client):
    ghost = _seed_values(client)["test-ghost-seed"]
    assert (ghost["harvests"], ghost["goldTotal"], ghost["goldPerDayTenths"]) == (6, None, None)
    assert (ghost["prices"], ghost["jar"], ghost["keg"]) == (None, None, None)


def test_should_use_from_day_and_fertilizer_when_given(client):
    flat = _seed_values(client, fromDay=20, fertilizer="deluxe", farmingLevel=10)["test-flat-seed"]
    assert (flat["days"], flat["willNotMature"]) == (9, True)


@pytest.mark.parametrize(
    "params",
    [
        {"season": "spring", "fromDay": 0},
        {"season": "spring", "fromDay": 29},
        {"season": "spring", "farmingLevel": 11},
        {"season": "spring", "fertilizer": "tree"},
        {"season": "spring", "location": "mine"},
        {"location": "farm", "mode": "continuous"},
        {"location": "greenhouse", "mode": "forever"},
    ],
)
def test_should_reject_invalid_query_when_listing_seed_values(client, params):
    assert client.get("/plantables/value", params=params).status_code == 422


def _values(client, **params):
    return {v["id"]: v for v in client.get("/plantables/value", params=params).json()}


def test_should_list_crops_of_every_season_when_farm_has_no_season(client):
    values = _values(client)
    assert set(values) == {"test-flat-seed", "test-seed", "test-ghost-seed", "test-summer-seed"}
    assert values["test-flat-seed"]["goldTotal"] == 162
    assert values["test-flat-seed"]["cycleDays"] is None


@pytest.mark.parametrize("location", ["greenhouse", "ginger-island"])
def test_should_value_every_crop_in_a_28_day_window_when_greenhouse_or_island(client, location):
    values = _values(client, location=location, season="summer", fromDay=20, mode="window")
    assert set(values) == {"test-flat-seed", "test-seed", "test-ghost-seed", "test-summer-seed"}
    assert (values["test-flat-seed"]["days"], values["test-flat-seed"]["goldTotal"]) == (28, 162)


def test_should_value_one_cycle_when_greenhouse_is_continuous(client):
    values = _values(client, location="greenhouse", mode="continuous")
    flat, regrowing = values["test-flat-seed"], values["test-seed"]
    # 80.796 every 12 days; 123.594 every 4 days
    assert (flat["cycleDays"], flat["goldTotal"], flat["goldPerDayTenths"]) == (12, 81, 67)
    assert (regrowing["cycleDays"], regrowing["goldPerDayTenths"]) == (4, 309)


def test_lists_seeds_by_english_type(client):
    response = client.get("/game/seeds")
    assert response.status_code == 200
    body = response.json()
    assert body and all(item["type"] == "seeds" for item in body)


def test_portuguese_type_is_unknown(client):
    assert client.get("/game/sementes").status_code == 404
