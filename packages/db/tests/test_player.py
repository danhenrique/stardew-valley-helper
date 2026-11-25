from stardew_valley_db.entities import (
    FarmPlan,
    GameDateAttribute,
    MachineBatch,
    Planting,
    PlayerProfile,
    player_records,
)


def _planting(player="test-sub", **overrides):
    fields = {
        "seed_id": "test-seed",
        "planted_on": GameDateAttribute(year=1, season="spring", day=1),
        "fertilizer": "none",
        "location": "farm",
        "quantity": 3,
    }
    fields.update(overrides)
    return Planting.new(player, **fields)


def test_should_use_player_partition_and_camel_case_when_creating_planting():
    planting = _planting()
    data = planting.serialize()
    assert planting.pk == "PLAYER#test-sub" and planting.sk.startswith("PLANTING#")
    assert {"seedId", "plantedOn", "createdAt", "anchor"} <= set(data)
    assert planting.anchor == "planted"


def test_should_store_last_harvest_when_anchor_is_harvested():
    planting = _planting(
        anchor="harvested", planted_on=None, last_harvest_on=GameDateAttribute(year=1, season="spring", day=13)
    )
    data = planting.serialize()
    assert "lastHarvestOn" in data and "plantedOn" not in data


def test_should_generate_unique_ids_when_creating_plantings():
    assert _planting().planting_id != _planting().planting_id


def test_should_return_default_profile_when_player_has_none(table):
    profile = PlayerProfile.get_or_default("missing-sub")
    date = profile.current_date
    assert (date.year, date.season, date.day, profile.agriculturist) == (1, "spring", 1, False)
    assert profile.pk == "PLAYER#missing-sub" and profile.sk == "PROFILE"


def test_should_default_progress_flags_to_false_when_player_has_none(table):
    profile = PlayerProfile.get_or_default("p-new")
    assert (profile.community_center_restored, profile.key_to_town, profile.boat_repaired) == (False, False, False)


def test_should_return_profile_and_plantings_in_one_query_when_listing_player(table):
    PlayerProfile.get_or_default("p1").save()
    _planting("p1").save()
    _planting("p1").save()
    _planting("p2").save()
    profile, plantings = Planting.list_for_player("p1")
    assert profile is not None and profile.pk == "PLAYER#p1"
    assert len(plantings) == 2 and all(p.pk == "PLAYER#p1" for p in plantings)


def test_should_return_no_profile_when_listing_new_player(table):
    assert Planting.list_for_player("nobody") == (None, [])


def _machine(player="test-sub", **overrides):
    fields = {
        "machine_id": "keg",
        "output_id": "test-wine",
        "started_on": GameDateAttribute(year=1, season="spring", day=1),
        "quantity": 3,
    }
    fields.update(overrides)
    return MachineBatch.new(player, **fields)


def test_should_use_player_partition_and_camel_case_when_creating_machine_batch():
    batch = _machine()
    data = batch.serialize()
    assert batch.pk == "PLAYER#test-sub" and batch.sk.startswith("MACHINE#")
    assert {"machineId", "outputId", "startedOn", "createdAt", "quantity", "location"} <= set(data)
    assert batch.location == "farm" and "startQuality" not in data
    assert batch.machine_batch_id != _machine().machine_batch_id
    assert MachineBatch.key("test-sub", batch.machine_batch_id) == (batch.pk, batch.sk)


def test_should_return_profile_plantings_and_machines_when_reading_player_records(table):
    PlayerProfile.get_or_default("p1").save()
    _planting("p1").save()
    _machine("p1").save()
    _machine("p2").save()
    records = player_records("p1")
    assert records.profile is not None and records.profile.pk == "PLAYER#p1"
    assert len(records.plantings) == 1
    assert len(records.machines) == 1 and records.machines[0].pk == "PLAYER#p1"


def test_should_return_no_machines_when_player_has_none(table):
    _planting("p1").save()
    assert player_records("p1").machines == []


def test_should_default_artisan_to_false_when_player_has_none(table):
    assert PlayerProfile.get_or_default("p-artisan").artisan is False


def test_should_create_farm_plan_with_ulid_sort_key_and_version_one():
    plan = FarmPlan.new("p1", name="A", farm_id="standard", objects_json="[]")
    data = plan.serialize()
    assert plan.pk == "PLAYER#p1" and plan.sk.startswith("FARMPLAN#")
    assert plan.version == 1
    assert plan.farm_plan_id == plan.sk.removeprefix("FARMPLAN#")
    assert {"farmId", "objectsJson", "createdAt", "updatedAt"} <= set(data)
    assert FarmPlan.key("p1", plan.farm_plan_id) == (plan.pk, plan.sk)


def test_should_list_only_the_players_plans_when_listing_farm_plans(table):
    mine = FarmPlan.new("p1", name="A", farm_id="standard", objects_json="[]")
    mine.save()
    FarmPlan.new("p2", name="B", farm_id="standard", objects_json="[]").save()
    PlayerProfile.get_or_default("p1").save()
    Planting.new("p1", seed_id="test-seed").save()
    assert [p.sk for p in FarmPlan.list_for_player("p1")] == [mine.sk]
