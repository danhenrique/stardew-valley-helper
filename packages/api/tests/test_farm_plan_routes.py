URL = "/me/farm-plans"
FIXED = [{"t": "farmhouse", "x": 4, "y": 1}]


def create(client, name="Ano 1", **extra):
    return client.post(URL, json={"name": name, **({"farmId": "standard"} | extra)})


def test_should_seed_plan_with_fixed_objects_when_creating_from_farm(client_as):
    response = create(client_as("p1"))
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["version"] == 1 and body["farmId"] == "standard" and body["objects"] == FIXED


def test_should_copy_objects_when_creating_from_plan(client_as):
    c = client_as("p1")
    source = create(c).json()
    objects = FIXED + [{"t": "tilled-soil", "x": 0, "y": 0}]
    assert c.put(f"{URL}/{source['id']}", json={"name": "A", "objects": objects, "version": 1}).status_code == 200
    copy = c.post(URL, json={"name": "Copia", "copyFrom": source["id"]})
    assert copy.status_code == 201
    assert copy.json()["objects"] == objects and copy.json()["id"] != source["id"]


def test_should_return_404_when_copying_another_players_plan(client_as):
    other = create(client_as("p2")).json()["id"]
    assert client_as("p1").post(URL, json={"name": "x", "copyFrom": other}).status_code == 404


def test_should_return_400_when_creating_the_21st_plan(client_as):
    c = client_as("p1")
    for _ in range(20):
        assert create(c).status_code == 201
    assert create(c).status_code == 400


def test_should_return_400_when_farm_is_unknown(client_as):
    assert client_as("p1").post(URL, json={"name": "x", "farmId": "nope"}).status_code == 400


def test_should_return_422_when_name_is_invalid_or_source_is_ambiguous(client_as):
    c = client_as("p1")
    assert create(c, name="").status_code == 422
    assert create(c, name="a" * 61).status_code == 422
    assert c.post(URL, json={"name": "x"}).status_code == 422
    assert create(c, copyFrom="abc").status_code == 422


def test_should_strip_the_name_and_reject_a_blank_one(client_as):
    c = client_as("p1")
    response = create(c, name="  Ano 2  ")
    assert response.status_code == 201, response.text
    plan = response.json()
    assert plan["name"] == "Ano 2"
    assert create(c, name="   ").status_code == 422
    url = f"{URL}/{plan['id']}"
    assert c.put(url, json={"name": " \t ", "objects": FIXED, "version": 1}).status_code == 422
    renamed = c.put(url, json={"name": " Novo ", "objects": FIXED, "version": 1})
    assert renamed.status_code == 200 and renamed.json()["name"] == "Novo"


def test_should_bump_version_when_updating_with_current_version(client_as):
    c = client_as("p1")
    plan = create(c).json()
    response = c.put(f"{URL}/{plan['id']}", json={"name": "Novo", "objects": FIXED, "version": 1})
    assert response.status_code == 200
    assert response.json()["version"] == 2 and response.json()["name"] == "Novo"
    assert c.get(f"{URL}/{plan['id']}").json()["version"] == 2


def test_should_return_409_when_version_is_stale(client_as):
    c = client_as("p1")
    plan = create(c).json()
    body = {"name": "A", "objects": FIXED, "version": 1}
    assert c.put(f"{URL}/{plan['id']}", json=body).status_code == 200
    response = c.put(f"{URL}/{plan['id']}", json=body)
    assert response.status_code == 409
    assert response.json() == {"detail": "Plan changed elsewhere"}


def test_should_return_400_with_message_when_object_is_invalid(client_as):
    c = client_as("p1")
    plan = create(c).json()
    body = {"name": "A", "objects": FIXED + [{"t": "foo", "x": 0, "y": 0}], "version": 1}
    response = c.put(f"{URL}/{plan['id']}", json=body)
    assert response.status_code == 400 and response.json()["detail"] == "Unknown object: foo"


def test_should_list_plans_without_objects(client_as):
    c = client_as("p1")
    create(c)
    items = c.get(URL).json()
    assert len(items) == 1 and "objects" not in items[0] and items[0]["farmId"] == "standard"
    assert client_as("p2").get(URL).json() == []


def test_should_return_404_for_another_players_plan(client_as):
    plan_id = create(client_as("p1")).json()["id"]
    other = client_as("p2")
    assert other.get(f"{URL}/{plan_id}").status_code == 404
    body = {"name": "A", "objects": FIXED, "version": 1}
    assert other.put(f"{URL}/{plan_id}", json=body).status_code == 404
    assert other.delete(f"{URL}/{plan_id}").status_code == 404


def test_should_delete_plan(client_as):
    c = client_as("p1")
    plan_id = create(c).json()["id"]
    assert c.delete(f"{URL}/{plan_id}").status_code == 204
    assert c.get(f"{URL}/{plan_id}").status_code == 404


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _count_catalog_reads(monkeypatch):
    from stardew_valley_api.routes import farm_plans

    reads = []
    real = farm_plans.list_folder

    def counting(folder):
        reads.append(folder)
        return real(folder)

    monkeypatch.setattr(farm_plans, "list_folder", counting)
    return reads


def test_should_read_the_catalog_once_when_saving_twice(client_as, monkeypatch):
    reads = _count_catalog_reads(monkeypatch)
    c = client_as("p1")
    plan = create(c).json()
    url = f"{URL}/{plan['id']}"
    assert c.put(url, json={"name": "A", "objects": FIXED, "version": 1}).status_code == 200
    assert c.put(url, json={"name": "B", "objects": FIXED, "version": 2}).status_code == 200
    assert reads == ["planner-objects"]


def test_should_read_the_catalog_again_when_the_cache_ttl_has_passed(client_as, monkeypatch):
    from stardew_valley_api.routes import farm_plans
    from stardew_valley_api.ttl_cache import TtlCache

    clock = _Clock()
    monkeypatch.setattr(farm_plans, "CACHE", TtlCache(farm_plans.CACHE_TTL_SECONDS, clock=clock))
    reads = _count_catalog_reads(monkeypatch)
    c = client_as("p1")
    plan = create(c).json()
    url = f"{URL}/{plan['id']}"
    assert c.put(url, json={"name": "A", "objects": FIXED, "version": 1}).status_code == 200
    clock.now = farm_plans.CACHE_TTL_SECONDS
    assert c.put(url, json={"name": "B", "objects": FIXED, "version": 2}).status_code == 200
    assert reads == ["planner-objects", "planner-objects"]


def test_should_load_the_catalog_again_when_it_was_empty(monkeypatch):
    from stardew_valley_api.routes import farm_plans

    reads = []
    monkeypatch.setattr(farm_plans, "list_folder", lambda folder: reads.append(folder) or [])
    assert farm_plans._get_catalog() == {}
    assert farm_plans._get_catalog() == {}
    assert len(reads) == 2


def test_should_load_the_catalog_once_when_it_is_not_empty(seeded, monkeypatch):
    from stardew_valley_api.routes import farm_plans

    reads = _count_catalog_reads(monkeypatch)
    assert farm_plans._get_catalog()
    assert farm_plans._get_catalog()
    assert reads == ["planner-objects"]
