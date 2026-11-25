"""Player profile and plantings. Keys always come from the caller identity, never from the body."""

from datetime import UTC, datetime

from fastapi import HTTPException, Response
from stardew_valley_db.entities import (
    GameDateAttribute,
    MachineBatch,
    Planting,
    PlayerProfile,
    player_records,
)

from ..identity import PlayerId
from ..init import app, logger, tracer
from ..machine_service import machine_batch_schedule
from ..models import (
    NOT_FOUND_RESPONSE,
    GameDateIn,
    MachineBatchIn,
    MachineBatchOut,
    MeOut,
    PlantingIn,
    PlantingOut,
    ProfileIn,
    ProfileOut,
    ScheduleOut,
    SchedulePreviewIn,
)
from ..schedule_service import planting_schedule, schedule_for


def _date_in(value: GameDateAttribute | None) -> GameDateIn | None:
    if value is None:
        return None
    return GameDateIn.model_validate({"year": int(value.year), "season": value.season, "day": int(value.day)})


def _date_attr(value: GameDateIn | None) -> GameDateAttribute | None:
    return GameDateAttribute(year=value.year, season=value.season, day=value.day) if value else None


def _profile_out(profile: PlayerProfile) -> ProfileOut:
    current = _date_in(profile.current_date)
    assert current is not None
    return ProfileOut(
        current_date=current,
        agriculturist=bool(profile.agriculturist),
        community_center_restored=bool(profile.community_center_restored),
        key_to_town=bool(profile.key_to_town),
        boat_repaired=bool(profile.boat_repaired),
        rain_today=bool(profile.rain_today),
        # A record with both professions (edited by hand) keeps Agriculturist instead of breaking /me.
        artisan=bool(profile.artisan) and not profile.agriculturist,
    )


def _planting_fields(body: PlantingIn) -> dict:
    return {
        "seed_id": body.seed_id,
        "anchor": body.anchor,
        "planted_on": _date_attr(body.planted_on),
        "last_harvest_on": _date_attr(body.last_harvest_on),
        "fertilizer": body.fertilizer,
        "location": body.location,
        "quantity": body.quantity,
        "label": body.label,
    }


def _planting_body(planting: Planting) -> PlantingIn:
    return PlantingIn.model_validate(
        {
            "seed_id": planting.seed_id,
            "anchor": planting.anchor,
            "planted_on": _date_in(planting.planted_on),
            "last_harvest_on": _date_in(planting.last_harvest_on),
            "fertilizer": planting.fertilizer,
            "location": planting.location,
            "quantity": int(planting.quantity),
            "label": planting.label,
        }
    )


def _planting_out(planting: Planting, profile: ProfileOut) -> PlantingOut:
    body = _planting_body(planting)
    schedule = planting_schedule(body, profile.agriculturist, profile.current_date)
    return PlantingOut(**body.model_dump(), id=planting.planting_id, schedule=schedule)


def _reason(error: HTTPException) -> str:
    detail = error.detail
    if isinstance(detail, list) and detail and isinstance(detail[0], dict):
        return str(detail[0].get("msg", error.status_code))
    return str(detail)


def _planting_out_or_invalid(planting: Planting, profile: ProfileOut) -> PlantingOut:
    """A stored planting whose seed no longer exists is returned without schedule instead of breaking /me."""
    try:
        return _planting_out(planting, profile)
    except HTTPException as error:
        logger.warning("Invalid planting", extra={"planting_id": planting.planting_id, "reason": _reason(error)})
        body = _planting_body(planting)
        return PlantingOut(**body.model_dump(), id=planting.planting_id, schedule=None, invalid=True)


def _get_owned(player: str, planting_id: str) -> Planting:
    try:
        return Planting.get(*Planting.key(player, planting_id))
    except Planting.DoesNotExist:
        raise HTTPException(status_code=404, detail="Planting not found") from None


def _machine_fields(body: MachineBatchIn) -> dict:
    return {
        "machine_id": body.machine_id,
        "output_id": body.output_id,
        "started_on": _date_attr(body.started_on),
        "quantity": body.quantity,
        "start_quality": body.start_quality,
        "location": body.location,
        "label": body.label,
    }


def _machine_body(batch: MachineBatch) -> MachineBatchIn:
    return MachineBatchIn.model_validate(
        {
            "machine_id": batch.machine_id,
            "output_id": batch.output_id,
            "started_on": _date_in(batch.started_on),
            "quantity": int(batch.quantity),
            "start_quality": batch.start_quality,
            "location": batch.location,
            "label": batch.label,
        }
    )


def _machine_out(batch: MachineBatch, profile: ProfileOut) -> MachineBatchOut:
    body = _machine_body(batch)
    schedule = machine_batch_schedule(body, profile.current_date)
    return MachineBatchOut(**body.model_dump(), id=batch.machine_batch_id, schedule=schedule)


def _machine_out_or_invalid(batch: MachineBatch, profile: ProfileOut) -> MachineBatchOut:
    """A stored batch whose machine/output no longer exists is returned without schedule instead of breaking /me."""
    try:
        return _machine_out(batch, profile)
    except HTTPException as error:
        logger.warning(
            "Invalid machine batch", extra={"machine_batch_id": batch.machine_batch_id, "reason": _reason(error)}
        )
        body = _machine_body(batch)
        return MachineBatchOut(**body.model_dump(), id=batch.machine_batch_id, schedule=None, invalid=True)


def _get_owned_batch(player: str, machine_batch_id: str) -> MachineBatch:
    try:
        return MachineBatch.get(*MachineBatch.key(player, machine_batch_id))
    except MachineBatch.DoesNotExist:
        raise HTTPException(status_code=404, detail="Machine batch not found") from None


@app.get("/me")
@tracer.capture_method
def get_me(player: PlayerId) -> MeOut:
    records = player_records(player)
    profile = _profile_out(records.profile or PlayerProfile.get_or_default(player))
    return MeOut(
        profile=profile,
        plantings=[_planting_out_or_invalid(p, profile) for p in records.plantings],
        machines=[_machine_out_or_invalid(m, profile) for m in records.machines],
    )


@app.put("/me/profile")
@tracer.capture_method
def update_profile(player: PlayerId, body: ProfileIn) -> ProfileOut:
    profile = PlayerProfile.get_or_default(player)
    date_changed = _date_in(profile.current_date) != body.current_date
    profile.current_date = _date_attr(body.current_date)
    profile.rain_today = False if date_changed else body.rain_today
    profile.agriculturist = body.agriculturist
    # An older client omits artisan: keep it, unless it chose Agriculturist (they are exclusive).
    profile.artisan = body.artisan if body.artisan is not None else bool(profile.artisan) and not body.agriculturist
    profile.community_center_restored = body.community_center_restored
    profile.key_to_town = body.key_to_town
    profile.boat_repaired = body.boat_repaired
    profile.updated_at = datetime.now(UTC).isoformat()
    profile.save()
    return _profile_out(profile)


@app.post("/me/plantings", status_code=201, responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def create_planting(player: PlayerId, body: PlantingIn) -> PlantingOut:
    profile = _profile_out(PlayerProfile.get_or_default(player))
    schedule_for(body, profile.agriculturist, profile.current_date)  # validates before saving
    planting = Planting.new(player, **_planting_fields(body))
    planting.save()
    return _planting_out(planting, profile)


@app.put("/me/plantings/{planting_id}", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def update_planting(player: PlayerId, planting_id: str, body: PlantingIn) -> PlantingOut:
    planting = _get_owned(player, planting_id)
    profile = _profile_out(PlayerProfile.get_or_default(player))
    schedule_for(body, profile.agriculturist, profile.current_date)
    for name, value in _planting_fields(body).items():
        setattr(planting, name, value)
    planting.save()
    return _planting_out(planting, profile)


@app.delete("/me/plantings/{planting_id}", status_code=204, responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def delete_planting(player: PlayerId, planting_id: str) -> Response:
    _get_owned(player, planting_id).delete()
    return Response(status_code=204)


@app.post("/me/machines", status_code=201, responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def create_machine_batch(player: PlayerId, body: MachineBatchIn) -> MachineBatchOut:
    profile = _profile_out(PlayerProfile.get_or_default(player))
    machine_batch_schedule(body, profile.current_date)  # validates before saving
    batch = MachineBatch.new(player, **_machine_fields(body))
    batch.save()
    return _machine_out(batch, profile)


@app.put("/me/machines/{machine_batch_id}", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def update_machine_batch(player: PlayerId, machine_batch_id: str, body: MachineBatchIn) -> MachineBatchOut:
    batch = _get_owned_batch(player, machine_batch_id)
    profile = _profile_out(PlayerProfile.get_or_default(player))
    machine_batch_schedule(body, profile.current_date)
    for name, value in _machine_fields(body).items():
        setattr(batch, name, value)
    batch.save()
    return _machine_out(batch, profile)


@app.delete("/me/machines/{machine_batch_id}", status_code=204, responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def delete_machine_batch(player: PlayerId, machine_batch_id: str) -> Response:
    _get_owned_batch(player, machine_batch_id).delete()
    return Response(status_code=204)


@app.post("/schedule", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def preview_schedule(player: PlayerId, body: SchedulePreviewIn) -> ScheduleOut:
    return planting_schedule(body, body.agriculturist, body.today)
