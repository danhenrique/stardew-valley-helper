from stardew_valley_db.entities import GameDateAttribute, PlayerProfile

SPRING_1 = {"year": 1, "season": "spring", "day": 1}
VALID = {"seedId": "test-seed", "plantedOn": SPRING_1, "fertilizer": "none", "location": "farm", "quantity": 2}


def create_as(client_as, sub, body=VALID):
    response = client_as(sub).post("/me/plantings", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_should_return_default_profile_and_no_plantings_when_player_is_new(client_as):
    body = client_as("p1").get("/me").json()
    assert body["profile"] == {
        "currentDate": SPRING_1,
        "agriculturist": False,
        "communityCenterRestored": False,
        "keyToTown": False,
        "boatRepaired": False,
        "rainToday": False,
        "artisan": False,
    }
    assert body["plantings"] == []


def test_should_return_schedule_when_creating_planting(client_as):
    response = client_as("p1").post("/me/plantings", json=VALID)
    assert response.status_code == 201
    body = response.json()
    assert body["schedule"]["firstHarvest"] == {"year": 1, "season": "spring", "day": 9}
    assert body["anchor"] == "planted" and body["quantity"] == 2
    assert client_as("p1").get("/me").json()["plantings"][0]["id"] == body["id"]


def test_should_return_next_regrowths_when_creating_planting_from_known_harvest(client_as):
    body = {
        "seedId": "test-seed",
        "anchor": "harvested",
        "lastHarvestOn": {"year": 1, "season": "spring", "day": 13},
        "fertilizer": "none",
        "location": "farm",
        "quantity": 1,
    }
    response = client_as("p1").post("/me/plantings", json=body)
    assert response.status_code == 201, response.text
    assert response.json()["schedule"]["harvests"][1] == {"year": 1, "season": "spring", "day": 17}
    assert response.json()["plantedOn"] is None


def test_should_return_422_when_harvest_anchor_uses_non_regrowing_crop(client_as):
    body = {
        **VALID,
        "seedId": "test-flat-seed",
        "anchor": "harvested",
        "plantedOn": None,
        "lastHarvestOn": {"year": 1, "season": "spring", "day": 20},
    }
    assert client_as("p1").post("/me/plantings", json=body).status_code == 422


def test_should_return_422_when_harvest_anchor_uses_fruit_tree(client_as):
    body = {
        **VALID,
        "seedId": "test-sapling",
        "anchor": "harvested",
        "plantedOn": None,
        "lastHarvestOn": {"year": 1, "season": "fall", "day": 2},
    }
    assert client_as("p1").post("/me/plantings", json=body).status_code == 422


def test_should_return_422_when_both_dates_are_sent(client_as):
    body = {**VALID, "anchor": "planted", "lastHarvestOn": SPRING_1}
    assert client_as("p1").post("/me/plantings", json=body).status_code == 422


def test_should_return_422_when_harvest_anchor_has_fertilizer(client_as):
    body = {**VALID, "anchor": "harvested", "plantedOn": None, "lastHarvestOn": SPRING_1, "fertilizer": "speed-gro"}
    assert client_as("p1").post("/me/plantings", json=body).status_code == 422


def test_should_return_422_when_planting_out_of_season_on_farm(client_as):
    body = {**VALID, "plantedOn": {"year": 1, "season": "summer", "day": 1}}
    response = client_as("p1").post("/me/plantings", json=body)
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Seed cannot be planted in this season"


def test_should_return_404_when_seed_does_not_exist(client_as):
    assert client_as("p1").post("/me/plantings", json={**VALID, "seedId": "missing"}).status_code == 404


def test_should_return_422_when_item_is_not_plantable(client_as):
    response = client_as("p1").post("/me/plantings", json={**VALID, "seedId": "test-acorn"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["msg"] == "Item is not plantable"


def test_should_return_422_when_day_is_29(client_as):
    body = {**VALID, "plantedOn": {"year": 1, "season": "spring", "day": 29}}
    assert client_as("p1").post("/me/plantings", json=body).status_code == 422


def test_should_return_404_and_keep_planting_when_other_player_updates_or_deletes_it(client_as):
    planting_id = create_as(client_as, "p1")
    assert client_as("p2").delete(f"/me/plantings/{planting_id}").status_code == 404
    assert client_as("p2").put(f"/me/plantings/{planting_id}", json=VALID).status_code == 404
    assert len(client_as("p1").get("/me").json()["plantings"]) == 1
    assert client_as("p2").get("/me").json()["plantings"] == []


def test_should_update_planting_when_owner_edits_it(client_as):
    planting_id = create_as(client_as, "p1")
    response = client_as("p1").put(f"/me/plantings/{planting_id}", json={**VALID, "quantity": 7})
    assert response.status_code == 200 and response.json()["quantity"] == 7
    assert client_as("p1").get("/me").json()["plantings"][0]["quantity"] == 7


def test_should_remove_planting_when_owner_deletes_it(client_as):
    planting_id = create_as(client_as, "p1")
    assert client_as("p1").delete(f"/me/plantings/{planting_id}").status_code == 204
    assert client_as("p1").get("/me").json()["plantings"] == []


def test_should_recompute_status_when_profile_date_changes(client_as):
    create_as(client_as, "p1")
    profile = {
        "currentDate": {"year": 1, "season": "spring", "day": 9},
        "agriculturist": False,
        "communityCenterRestored": False,
        "keyToTown": False,
        "boatRepaired": False,
        "rainToday": False,
        "artisan": False,
    }
    assert client_as("p1").put("/me/profile", json=profile).json() == profile
    planting = client_as("p1").get("/me").json()["plantings"][0]
    assert planting["schedule"]["status"] == "ready"


def test_should_apply_profile_agriculturist_when_computing_planting_schedule(client_as):
    client_as("p1").put("/me/profile", json={"currentDate": SPRING_1, "agriculturist": True})
    body = {**VALID, "seedId": "test-flat-seed", "fertilizer": "speed-gro"}
    assert client_as("p1").post("/me/plantings", json=body).json()["schedule"]["firstHarvest"]["day"] == 10


def test_should_return_schedule_without_saving_when_previewing(client_as):
    body = {**VALID, "agriculturist": False, "today": SPRING_1}
    response = client_as("p1").post("/schedule", json=body)
    assert response.status_code == 200
    assert response.json()["totalHarvests"] == 5
    assert client_as("p1").get("/me").json()["plantings"] == []


def test_should_return_403_when_request_has_no_identity(client, monkeypatch):
    monkeypatch.delenv("LOCAL_DEV", raising=False)
    assert client.get("/me").status_code == 403


def test_should_return_detail_list_when_harvest_anchor_uses_non_regrowing_crop(client_as):
    body = {
        **VALID,
        "seedId": "test-flat-seed",
        "anchor": "harvested",
        "plantedOn": None,
        "lastHarvestOn": {"year": 1, "season": "spring", "day": 20},
    }
    detail = client_as("p1").post("/me/plantings", json=body).json()["detail"]
    assert detail[0]["msg"] == "Only regrowing crops can start from a harvest date"


def test_should_return_string_detail_when_planting_is_not_found(client_as):
    response = client_as("p1").delete("/me/plantings/missing")
    assert response.status_code == 404 and response.json() == {"detail": "Planting not found"}


def test_should_declare_404_error_model_in_openapi_when_route_can_miss(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path, method in [
        ("/me/plantings", "post"),
        ("/me/plantings/{planting_id}", "put"),
        ("/me/plantings/{planting_id}", "delete"),
        ("/schedule", "post"),
        ("/game/{type}/{id}", "get"),
    ]:
        response = paths[path][method]["responses"]["404"]
        assert response["content"]["application/json"]["schema"]["$ref"].endswith("/ErrorDetail"), (path, method)


def test_should_accept_999_and_reject_1000_when_validating_quantity(client_as):
    assert client_as("p1").post("/me/plantings", json={**VALID, "quantity": 999}).status_code == 201
    assert client_as("p1").post("/me/plantings", json={**VALID, "quantity": 1000}).status_code == 422
    assert client_as("p1").post("/me/plantings", json={**VALID, "quantity": 0}).status_code == 422


def test_should_return_expected_yield_when_creating_planting(client_as):
    schedule = client_as("p1").post("/me/plantings", json={**VALID, "quantity": 20}).json()["schedule"]
    assert schedule["yieldPerHarvest"] == 20.4
    assert schedule["expectedTotalYield"] == 102.0


def test_should_round_trip_progress_flags_when_updating_profile(client_as):
    profile = {
        "currentDate": SPRING_1,
        "agriculturist": False,
        "communityCenterRestored": True,
        "keyToTown": True,
        "boatRepaired": False,
        "rainToday": False,
        "artisan": False,
    }
    assert client_as("p1").put("/me/profile", json=profile).json() == profile
    assert client_as("p1").get("/me").json()["profile"] == profile


def test_should_return_false_flags_when_stored_profile_predates_them(client_as):
    profile = PlayerProfile.get_or_default("p1")
    profile.current_date = GameDateAttribute(year=1, season="spring", day=1)
    raw = profile.serialize()
    for key in ("communityCenterRestored", "keyToTown", "boatRepaired"):
        del raw[key]
    pk, sk = raw.pop("pk")["S"], raw.pop("sk")["S"]
    PlayerProfile._get_connection().put_item(pk, sk, attributes=raw)
    flags = client_as("p1").get("/me").json()["profile"]
    assert [flags[k] for k in ("communityCenterRestored", "keyToTown", "boatRepaired")] == [False] * 3


def test_should_keep_rain_when_profile_date_does_not_change(client_as):
    body = {"currentDate": SPRING_1, "rainToday": True}
    client_as("p1").put("/me/profile", json=body)
    assert client_as("p1").put("/me/profile", json=body).json()["rainToday"] is True
    assert client_as("p1").get("/me").json()["profile"]["rainToday"] is True


def test_should_reset_rain_when_profile_date_changes(client_as):
    client_as("p1").put("/me/profile", json={"currentDate": SPRING_1, "rainToday": True})
    next_day = {"currentDate": {"year": 1, "season": "spring", "day": 2}, "rainToday": True}
    assert client_as("p1").put("/me/profile", json=next_day).json()["rainToday"] is False
    assert client_as("p1").get("/me").json()["profile"]["rainToday"] is False


def test_should_read_rain_as_false_when_stored_profile_predates_it(client_as):
    profile = PlayerProfile.get_or_default("p1")
    raw = profile.serialize()
    raw.pop("rainToday", None)
    pk, sk = raw.pop("pk")["S"], raw.pop("sk")["S"]
    PlayerProfile._get_connection().put_item(pk, sk, attributes=raw)
    assert client_as("p1").get("/me").json()["profile"]["rainToday"] is False


def test_should_round_trip_artisan_when_updating_profile(client_as):
    profile = {"currentDate": SPRING_1, "artisan": True}
    assert client_as("p1").put("/me/profile", json=profile).json()["artisan"] is True
    assert client_as("p1").get("/me").json()["profile"]["artisan"] is True


def test_should_return_422_when_both_level_10_professions_are_chosen(client_as):
    response = client_as("p1").put(
        "/me/profile", json={"currentDate": SPRING_1, "agriculturist": True, "artisan": True}
    )
    assert response.status_code == 422
    assert "Escolha só uma profissão" in response.text


def test_should_return_false_artisan_when_stored_profile_predates_it(client_as):
    profile = PlayerProfile.get_or_default("p2")
    raw = profile.serialize()
    raw.pop("artisan", None)
    pk, sk = raw.pop("pk")["S"], raw.pop("sk")["S"]
    PlayerProfile._get_connection().put_item(pk, sk, attributes=raw)
    assert client_as("p2").get("/me").json()["profile"]["artisan"] is False
