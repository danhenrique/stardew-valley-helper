SPRING_1 = {"year": 1, "season": "spring", "day": 1}


def preview(client, **overrides):
    body = {"machineId": "keg", "outputId": "test-wine", "startedOn": SPRING_1, "today": SPRING_1, **overrides}
    return client.post("/machine-schedule", json=body)


def test_should_list_only_known_machines(client):
    body = client.get("/machines").json()
    assert {m["id"] for m in body} == {"keg", "bee-house", "cask", "tapper"}


def test_should_expose_outputs_kind_and_approximate_flag(client):
    machines = {m["id"]: m for m in client.get("/machines").json()}
    assert [o["id"] for o in machines["bee-house"]["outputs"]] == ["honey"]
    assert machines["cask"]["kind"] == "aging"
    beer = next(o for o in machines["keg"]["outputs"] if o["id"] == "beer")
    assert beer["approximate"] is True and beer["days"] == 2
    assert beer["name"]["en"]


def test_should_preview_batch_schedule(client):
    body = preview(client).json()
    assert body["readyOn"] == {"year": 1, "season": "spring", "day": 8}
    assert body["status"] == "processing"


def test_should_reject_output_of_another_machine(client):
    response = preview(client, outputId="honey")
    assert response.status_code == 422
    assert "Output does not belong to this machine" in response.text


def test_should_return_404_when_machine_is_unknown(client):
    response = preview(client, machineId="nope")
    assert response.status_code == 404
    assert response.json()["detail"] == "Machine not found"


def test_should_require_start_quality_for_cask(client):
    assert preview(client, machineId="cask", outputId="wine").status_code == 422


def test_should_return_milestones_for_cask(client):
    body = preview(client, machineId="cask", outputId="wine", startQuality="normal").json()
    assert [m["quality"] for m in body["milestones"]] == ["silver", "gold", "iridium"]


def test_should_reject_start_quality_on_keg(client):
    assert preview(client, startQuality="silver").status_code == 422
