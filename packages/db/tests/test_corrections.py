import copy

from stardew_valley_db.importer.corrections import apply_corrections
from stardew_valley_db.importer.load import load_dataset

from .conftest import FIXTURES_DIR


def _machine(dataset, machine_id):
    return next(doc for doc in dataset["machines"] if doc["id"] == machine_id)


def _outputs(doc):
    return [step["output"] for step in doc.get("processing") or []]


def test_should_move_aging_entries_from_bee_house_to_cask():
    corrected, log = apply_corrections(load_dataset(FIXTURES_DIR))

    assert _outputs(_machine(corrected, "bee-house")) == ["honey"]
    cask = {step["output"]: step for step in _machine(corrected, "cask")["processing"]}
    assert cask["wine"]["days"] == 56
    assert cask["cheese"]["days"] == 14
    assert all(step["kind"] == "aging" for step in cask.values())
    assert sorted(log, key=lambda e: e["output"]) == [
        {"machine": "bee-house", "output": "cheese", "action": "moved-to-cask"},
        {"machine": "bee-house", "output": "wine", "action": "moved-to-cask"},
    ]


def test_should_not_change_already_correct_dataset():
    corrected, _ = apply_corrections(load_dataset(FIXTURES_DIR))
    again, log = apply_corrections(corrected)
    assert again == corrected
    assert log == []


def test_should_not_mutate_the_input():
    dataset = load_dataset(FIXTURES_DIR)
    snapshot = copy.deepcopy(dataset)
    apply_corrections(dataset)
    assert dataset == snapshot


def _with_preserves_jar(dataset):
    jar = {
        "id": "preserves-jar",
        "type": "machines",
        "name": {"en": "Preserves Jar", "pt-BR": "Jarra de Conserva"},
        "processing": [
            {"days": 3, "output": "pickles", "label": {"en": "Pickles (veg)", "pt-BR": "Picles (vegetal)"}},
            {"days": 3, "output": "jelly", "label": {"en": "Jelly (fruit)", "pt-BR": "Geleia (fruta)"}},
        ],
    }
    return {**dataset, "machines": [*dataset["machines"], jar]}


def test_should_add_roe_outputs_to_preserves_jar():
    corrected, log = apply_corrections(_with_preserves_jar(load_dataset(FIXTURES_DIR)))

    jar = {step["output"]: step for step in _machine(corrected, "preserves-jar")["processing"]}
    assert list(jar) == ["pickles", "jelly", "aged-roe", "caviar"]
    assert jar["aged-roe"]["days"] == 3
    assert jar["aged-roe"]["label"] == {"en": "Aged Roe (roe)", "pt-BR": "Ovas Maturadas (ovas)"}
    assert jar["caviar"]["days"] == 4
    assert jar["caviar"]["label"] == {"en": "Caviar (sturgeon roe)", "pt-BR": "Caviar (ovas de esturjão)"}
    assert {"machine": "preserves-jar", "output": "aged-roe", "action": "added"} in log
    assert {"machine": "preserves-jar", "output": "caviar", "action": "added"} in log


def test_should_not_duplicate_roe_outputs_when_applied_twice():
    corrected, _ = apply_corrections(_with_preserves_jar(load_dataset(FIXTURES_DIR)))
    again, log = apply_corrections(corrected)
    assert again == corrected
    assert log == []


def test_should_add_roe_outputs_when_bee_house_is_missing():
    dataset = _with_preserves_jar(load_dataset(FIXTURES_DIR))
    dataset = {**dataset, "machines": [doc for doc in dataset["machines"] if doc["id"] != "bee-house"]}
    corrected, _ = apply_corrections(dataset)
    assert "caviar" in _outputs(_machine(corrected, "preserves-jar"))
