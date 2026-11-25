"""Machine catalog and schedule preview built from the stored game data."""

from fastapi import HTTPException
from stardew_valley_db.entities import Item

from .game_data import list_folder, localized_name, to_plain
from .machine_schedule import APPROXIMATE_OUTPUTS, MACHINE_KINDS, InvalidMachineInputError, machine_schedule
from .models import (
    GameDateIn,
    LocalizedTextOut,
    MachineBatchIn,
    MachineOut,
    MachineOutputOut,
    MachineScheduleOut,
    MilestoneOut,
)
from .schedule import GameDate
from .schedule_service import game_date, rule_error

MACHINES_FOLDER = "machines"
OUTPUT_NOT_IN_MACHINE = "Output does not belong to this machine"


def _date_out(date: GameDate) -> GameDateIn:
    return GameDateIn(year=date.year, season=date.season, day=date.day)


def _steps(machine: Item) -> list[dict]:
    return [to_plain(step) for step in machine.processing or []]


def list_machines() -> list[MachineOut]:
    machines = []
    for model in list_folder(MACHINES_FOLDER):
        kind = MACHINE_KINDS.get(model.entity_id)
        if kind is None or not isinstance(model, Item):
            continue
        outputs = []
        for step in _steps(model):
            label = step.get("label") or {}
            outputs.append(
                MachineOutputOut(
                    id=step["output"],
                    name=LocalizedTextOut(en=label.get("en"), pt_br=label.get("ptBr")) if label else None,
                    days=int(step["days"]),
                    approximate=(model.entity_id, step["output"]) in APPROXIMATE_OUTPUTS,
                )
            )
        machines.append(MachineOut(id=model.entity_id, name=localized_name(model), kind=kind, outputs=outputs))
    return machines


def machine_batch_schedule(body: MachineBatchIn, today: GameDateIn) -> MachineScheduleOut:
    try:
        machine = Item.get(f"ITEM#{body.machine_id}", "ITEM")
    except Item.DoesNotExist:
        raise HTTPException(status_code=404, detail="Machine not found") from None
    if machine.item_type != MACHINES_FOLDER or body.machine_id not in MACHINE_KINDS:
        raise HTTPException(status_code=404, detail="Machine not found")
    step = next((s for s in _steps(machine) if s.get("output") == body.output_id), None)
    if step is None:
        raise rule_error(OUTPUT_NOT_IN_MACHINE, ["body", "outputId"])
    try:
        result = machine_schedule(
            body.machine_id,
            body.output_id,
            int(step["days"]),
            game_date(body.started_on),
            body.location,
            body.start_quality,
            game_date(today),
        )
    except InvalidMachineInputError as error:
        raise rule_error(str(error), ["body"]) from None
    return MachineScheduleOut(
        ready_on=_date_out(result.ready_on) if result.ready_on else None,
        collections=[_date_out(d) for d in result.collections],
        milestones=[MilestoneOut(quality=q, on=_date_out(d)) for q, d in result.milestones],
        infinite=result.infinite,
        status=result.status,
        days_until_next=result.days_until_next,
        approximate=result.approximate,
        warnings=result.warnings,
    )
