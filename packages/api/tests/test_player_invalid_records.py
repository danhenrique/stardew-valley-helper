"""A record whose seed/machine/output disappeared (e.g. after a re-import) must not break /me."""

import logging

from stardew_valley_db.entities import GameDateAttribute, MachineBatch, Planting

SPRING_1 = {"year": 1, "season": "spring", "day": 1}
VALID_PLANTING = {"seedId": "test-seed", "plantedOn": SPRING_1, "fertilizer": "none", "location": "farm"}
VALID_KEG = {"machineId": "keg", "outputId": "test-wine", "startedOn": SPRING_1, "quantity": 3}


def _spring_1() -> GameDateAttribute:
    return GameDateAttribute(year=1, season="spring", day=1)


def _store_invalid_records(player: str) -> tuple[str, str]:
    planting = Planting.new(
        player, seed_id="removed-seed", planted_on=_spring_1(), fertilizer="none", location="farm", quantity=1
    )
    planting.save()
    batch = MachineBatch.new(
        player, machine_id="keg", output_id="removed-output", started_on=_spring_1(), quantity=1, location="farm"
    )
    batch.save()
    return planting.planting_id, batch.machine_batch_id


def test_should_return_invalid_records_without_schedule_and_keep_valid_ones(client_as):
    client = client_as("p1")
    assert client.post("/me/plantings", json=VALID_PLANTING).status_code == 201
    assert client.post("/me/machines", json=VALID_KEG).status_code == 201
    bad_planting_id, bad_batch_id = _store_invalid_records("p1")

    response = client.get("/me")

    assert response.status_code == 200, response.text
    plantings = {p["id"]: p for p in response.json()["plantings"]}
    machines = {m["id"]: m for m in response.json()["machines"]}
    bad_planting = plantings.pop(bad_planting_id)
    assert bad_planting["invalid"] is True and bad_planting["schedule"] is None
    assert bad_planting["seedId"] == "removed-seed"
    (good_planting,) = plantings.values()
    assert good_planting["invalid"] is False
    assert good_planting["schedule"]["firstHarvest"] == {"year": 1, "season": "spring", "day": 9}
    bad_batch = machines.pop(bad_batch_id)
    assert bad_batch["invalid"] is True and bad_batch["schedule"] is None
    (good_batch,) = machines.values()
    assert good_batch["invalid"] is False
    assert good_batch["schedule"]["readyOn"] == {"year": 1, "season": "spring", "day": 8}


def test_should_log_record_id_and_reason_only_when_record_is_invalid(client_as, caplog):
    bad_planting_id, bad_batch_id = _store_invalid_records("secret-sub")

    with caplog.at_level(logging.WARNING):
        assert client_as("secret-sub").get("/me").status_code == 200

    warnings = {r.getMessage(): r for r in caplog.records if r.levelno == logging.WARNING}
    planting_log, batch_log = warnings["Invalid planting"], warnings["Invalid machine batch"]
    assert planting_log.planting_id == bad_planting_id and planting_log.reason == "Seed not found"
    assert batch_log.machine_batch_id == bad_batch_id and batch_log.reason
    assert all("secret-sub" not in str(vars(r)) for r in warnings.values())


def test_should_still_reject_invalid_planting_on_create(client_as):
    response = client_as("p1").post("/me/plantings", json={**VALID_PLANTING, "seedId": "removed-seed"})
    assert response.status_code in (404, 422)
    assert client_as("p1").get("/me").json()["plantings"] == []
