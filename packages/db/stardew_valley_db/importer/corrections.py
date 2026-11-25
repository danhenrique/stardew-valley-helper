"""Versioned corrections for known mistakes in the source dataset, applied between load and convert."""

import copy

# Outputs that age in a Cask; the dataset lists them under the Bee House.
AGING_OUTPUTS: frozenset[str] = frozenset({"wine", "pale-ale", "beer", "mead", "cheese", "goat-cheese"})

MACHINES_FOLDER = "machines"
BEE_HOUSE = "bee-house"
CASK = "cask"
PRESERVES_JAR = "preserves-jar"

# Preserves Jar outputs missing from the dataset (roe in, aged roe or caviar out).
MISSING_PRESERVES_JAR_OUTPUTS: tuple[dict, ...] = (
    {"days": 3, "output": "aged-roe", "label": {"en": "Aged Roe (roe)", "pt-BR": "Ovas Maturadas (ovas)"}},
    {"days": 4, "output": "caviar", "label": {"en": "Caviar (sturgeon roe)", "pt-BR": "Caviar (ovas de esturjão)"}},
)

Log = list[dict[str, str]]


def _move_aging_outputs_to_cask(machines: dict[str, dict], log: Log) -> None:
    bee_house, cask = machines.get(BEE_HOUSE), machines.get(CASK)
    if bee_house is None or cask is None:
        return
    kept: list[dict] = []
    moved: list[dict] = []
    for step in bee_house.get("processing") or []:
        (moved if step.get("output") in AGING_OUTPUTS else kept).append(step)
    if not moved:
        return
    bee_house["processing"] = kept
    cask["processing"] = [*(cask.get("processing") or []), *({**step, "kind": "aging"} for step in moved)]
    log.extend({"machine": BEE_HOUSE, "output": step["output"], "action": "moved-to-cask"} for step in moved)


def _add_roe_outputs_to_preserves_jar(machines: dict[str, dict], log: Log) -> None:
    jar = machines.get(PRESERVES_JAR)
    if jar is None:
        return
    present = {step.get("output") for step in jar.get("processing") or []}
    missing = [copy.deepcopy(step) for step in MISSING_PRESERVES_JAR_OUTPUTS if step["output"] not in present]
    if not missing:
        return
    jar["processing"] = [*(jar.get("processing") or []), *missing]
    log.extend({"machine": PRESERVES_JAR, "output": step["output"], "action": "added"} for step in missing)


def apply_corrections(dataset: dict[str, list[dict]]) -> tuple[dict[str, list[dict]], Log]:
    """Return a corrected deep copy and one log entry per changed entry. Idempotent."""
    corrected = copy.deepcopy(dataset)
    log: Log = []
    # load_dataset guarantees every document has an id (it falls back to the file name).
    machines = {doc["id"]: doc for doc in corrected.get(MACHINES_FOLDER, [])}
    _move_aging_outputs_to_cask(machines, log)
    _add_roe_outputs_to_preserves_jar(machines, log)
    return corrected, log
