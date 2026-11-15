SPRING_1 = {"year": 1, "season": "spring", "day": 1}
KEG = {"machineId": "keg", "outputId": "test-wine", "startedOn": SPRING_1, "quantity": 3}


def create_as(client_as, sub, body=KEG):
    response = client_as(sub).post("/me/machines", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_should_return_no_machines_when_player_is_new(client_as):
    assert client_as("p1").get("/me").json()["machines"] == []


def test_should_return_schedule_when_creating_machine_batch(client_as):
    response = client_as("p1").post("/me/machines", json=KEG)
    assert response.status_code == 201
    body = response.json()
    assert body["schedule"]["readyOn"] == {"year": 1, "season": "spring", "day": 8}
    assert body["quantity"] == 3
    assert client_as("p1").get("/me").json()["machines"][0]["id"] == body["id"]


def test_should_change_ready_date_when_updating_started_on(client_as):
    batch_id = create_as(client_as, "p1")
    moved = {**KEG, "startedOn": {"year": 1, "season": "spring", "day": 5}}
    response = client_as("p1").put(f"/me/machines/{batch_id}", json=moved)
    assert response.status_code == 200, response.text
    assert response.json()["schedule"]["readyOn"] == {"year": 1, "season": "spring", "day": 12}


def test_should_delete_batch_and_then_return_404(client_as):
    batch_id = create_as(client_as, "p1")
    assert client_as("p1").delete(f"/me/machines/{batch_id}").status_code == 204
    response = client_as("p1").put(f"/me/machines/{batch_id}", json=KEG)
    assert response.status_code == 404
    assert response.json()["detail"] == "Machine batch not found"


def test_should_not_let_another_player_touch_a_batch(client_as):
    batch_id = create_as(client_as, "p1")
    assert client_as("p2").put(f"/me/machines/{batch_id}", json=KEG).status_code == 404
    assert client_as("p2").delete(f"/me/machines/{batch_id}").status_code == 404
    assert len(client_as("p1").get("/me").json()["machines"]) == 1


def test_should_return_422_and_save_nothing_when_output_is_invalid(client_as):
    response = client_as("p1").post("/me/machines", json={**KEG, "outputId": "honey"})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "outputId"]
    assert client_as("p1").get("/me").json()["machines"] == []


def test_should_return_422_when_cask_starts_with_iridium(client_as):
    body = {**KEG, "machineId": "cask", "outputId": "wine", "startQuality": "iridium"}
    assert client_as("p1").post("/me/machines", json=body).status_code == 422
