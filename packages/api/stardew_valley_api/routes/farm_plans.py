"""Farm layout plans of the caller. Keys always come from the caller identity."""

from datetime import UTC, datetime

from fastapi import HTTPException, Response
from pynamodb.exceptions import PutError
from stardew_valley_db.entities import FarmMap, FarmPlan, PlannerObject

from ..farm_plan import MAX_PLANS, decode_objects, encode_objects, fixed_objects, validate_objects
from ..game_data import entity_key, list_folder
from ..identity import PlayerId
from ..init import app, logger, tracer
from ..models import (
    BAD_REQUEST_RESPONSE,
    CONFLICT_RESPONSE,
    NOT_FOUND_RESPONSE,
    FarmPlanCreateIn,
    FarmPlanOut,
    FarmPlanSummaryOut,
    FarmPlanUpdateIn,
)
from ..ttl_cache import TtlCache

RESPONSES = {**NOT_FOUND_RESPONSE, **BAD_REQUEST_RESPONSE, **CONFLICT_RESPONSE}

# Game data only changes on a dataset import, so the planner catalog and farm maps are
# kept in memory per Lambda instance for a while.
CACHE_TTL_SECONDS = 600
CACHE = TtlCache(CACHE_TTL_SECONDS)


def _summary(plan: FarmPlan) -> FarmPlanSummaryOut:
    return FarmPlanSummaryOut(
        id=plan.farm_plan_id,
        name=plan.name,
        farm_id=plan.farm_id,
        version=int(plan.version),
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )


def _out(plan: FarmPlan) -> FarmPlanOut:
    return FarmPlanOut(**_summary(plan).model_dump(), objects=decode_objects(plan.objects_json))


def _get_owned(player: str, plan_id: str) -> FarmPlan:
    try:
        return FarmPlan.get(*FarmPlan.key(player, plan_id))
    except FarmPlan.DoesNotExist:
        raise HTTPException(status_code=404, detail="Farm plan not found") from None


def _load_farm(farm_id: str) -> FarmMap:
    try:
        return FarmMap.get(*entity_key("farms", farm_id))
    except FarmMap.DoesNotExist:
        raise HTTPException(status_code=400, detail=f"Unknown farm: {farm_id}") from None


def _get_farm(farm_id: str) -> FarmMap:
    return CACHE.get(f"farm:{farm_id}", lambda: _load_farm(farm_id))


def _load_catalog() -> dict[str, PlannerObject]:
    return {str(p.entity_id): p for p in list_folder("planner-objects") if isinstance(p, PlannerObject)}


def _get_catalog() -> dict[str, PlannerObject]:
    # An empty catalog means the dataset is missing or mid-import: never keep it.
    return CACHE.get("catalog", _load_catalog, keep=bool)


def _is_conflict(error: PutError) -> bool:
    cause = error.cause
    code = getattr(cause, "response", {}).get("Error", {}).get("Code") if cause is not None else None
    return code == "ConditionalCheckFailedException"


@app.get("/me/farm-plans")
@tracer.capture_method
def list_farm_plans(player: PlayerId) -> list[FarmPlanSummaryOut]:
    return [_summary(plan) for plan in FarmPlan.list_for_player(player)]


@app.post("/me/farm-plans", status_code=201, responses=RESPONSES)
@tracer.capture_method
def create_farm_plan(player: PlayerId, body: FarmPlanCreateIn) -> FarmPlanOut:
    if len(FarmPlan.list_for_player(player)) >= MAX_PLANS:
        raise HTTPException(status_code=400, detail=f"Too many plans (max {MAX_PLANS})")
    if body.copy_from is not None:
        source = _get_owned(player, body.copy_from)
        farm_id, objects_json = source.farm_id, source.objects_json
    else:
        assert body.farm_id is not None
        farm_id = body.farm_id
        objects_json = encode_objects(fixed_objects(_get_farm(farm_id)))
    plan = FarmPlan.new(player, name=body.name, farm_id=farm_id, objects_json=objects_json)
    plan.save()
    return _out(plan)


@app.get("/me/farm-plans/{plan_id}", responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def get_farm_plan(player: PlayerId, plan_id: str) -> FarmPlanOut:
    return _out(_get_owned(player, plan_id))


@app.put("/me/farm-plans/{plan_id}", responses=RESPONSES)
@tracer.capture_method
def update_farm_plan(player: PlayerId, plan_id: str, body: FarmPlanUpdateIn) -> FarmPlanOut:
    plan = _get_owned(player, plan_id)
    error = validate_objects(body.objects, _get_farm(plan.farm_id), _get_catalog())
    if error:
        raise HTTPException(status_code=400, detail=error)
    plan.name = body.name
    plan.objects_json = encode_objects(body.objects)
    plan.updated_at = datetime.now(UTC).isoformat()
    plan.version = body.version + 1
    try:
        plan.save(condition=FarmPlan.version == body.version)
    except PutError as put_error:
        if _is_conflict(put_error):
            logger.info("Farm plan version conflict", extra={"farm_plan_id": plan_id})
            raise HTTPException(status_code=409, detail="Plan changed elsewhere") from None
        raise
    return _out(plan)


@app.delete("/me/farm-plans/{plan_id}", status_code=204, responses=NOT_FOUND_RESPONSE)
@tracer.capture_method
def delete_farm_plan(player: PlayerId, plan_id: str) -> Response:
    _get_owned(player, plan_id).delete()
    return Response(status_code=204)
