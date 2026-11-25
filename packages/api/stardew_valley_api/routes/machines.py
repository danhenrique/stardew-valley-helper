"""Machine catalog and schedule preview endpoints."""

from ..init import app, tracer
from ..machine_service import list_machines as build_machine_list
from ..machine_service import machine_batch_schedule
from ..models import NOT_FOUND_RESPONSE, MachineOut, MachineScheduleOut, MachineSchedulePreviewIn


@app.get("/machines")
@tracer.capture_method
def list_machines() -> list[MachineOut]:
    return build_machine_list()


@app.post("/machine-schedule", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def preview_machine_schedule(body: MachineSchedulePreviewIn) -> MachineScheduleOut:
    return machine_batch_schedule(body, body.today)
