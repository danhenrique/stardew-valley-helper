import pytest
from stardew_valley_db.entities import Item
from stardew_valley_db.entities.attributes import LocalizedText

from stardew_valley_api.fish import fish_out, parse_time


def _item(subtype=None, windows=None) -> Item:
    return Item.build(
        entity_id="x-fish",
        item_type="fish",
        subtype=subtype,
        name=LocalizedText(en="X", pt_br="X"),
        catch={
            "tool": "rod",
            "seasons": ["spring"],
            "weather": "any",
            "timeWindows": windows or [{"from": "06:00", "to": "19:00"}],
            "location": {"en": "River", "ptBr": "Rio"},
            "locationVerified": False,
        },
    )


def _fish(client) -> dict[str, dict]:
    return {f["id"]: f for f in client.get("/fish").json()}


def test_should_parse_time_when_plain():
    assert parse_time("06:00") == 360


def test_should_add_a_day_when_time_has_plus_1d():
    assert parse_time("02:00 (+1d)") == 1560


@pytest.mark.parametrize("value", ["25:99", "6h", ""])
def test_should_reject_time_when_malformed(value):
    with pytest.raises(ValueError):
        parse_time(value)


def test_should_list_valid_fish_sorted_by_pt_br_name_when_getting_fish(client):
    ids = [f["id"] for f in client.get("/fish").json()]
    assert ids == ["test-crab", "test-two-windows", "test-legend-rain", "test-rod-fish"]


def test_should_map_crab_pot_and_category_when_getting_fish(client):
    fish = _fish(client)
    assert fish["test-crab"]["tool"] == "crab-pot"
    assert fish["test-crab"]["category"] == "regular"
    assert fish["test-legend-rain"]["category"] == "legendary"
    assert fish["test-legend-rain"]["weather"] == "rain"
    assert fish["test-rod-fish"]["location"] == {"en": "River", "ptBr": "Rio"}
    assert fish["test-rod-fish"]["locationVerified"] is False


def test_should_return_two_windows_in_minutes_when_fish_has_two(client):
    assert _fish(client)["test-two-windows"]["windows"] == [
        {"fromMinute": 360, "toMinute": 660},
        {"fromMinute": 1080, "toMinute": 1560},
    ]


def test_should_raise_when_subtype_is_unknown_or_window_is_empty():
    with pytest.raises(ValueError):
        fish_out(_item(subtype="boss"))
    with pytest.raises(ValueError):
        fish_out(_item(windows=[{"from": "06:00", "to": "06:00"}]))
