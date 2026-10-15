from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends

from ..db import db
from ..security import get_current_user, require_roles
from ..utils import serialize

router = APIRouter(tags=["counts"])


def _match(source_id, job_id, start, end) -> dict:
    m: dict = {}
    if source_id:
        m["meta.source_id"] = source_id
    if job_id:
        m["meta.job_id"] = job_id
    if start or end:
        m["ts"] = {**({"$gte": start} if start else {}), **({"$lte": end} if end else {})}
    return m


@router.get("/counts/summary")
def summary(source_id: Optional[str] = None, job_id: Optional[str] = None,
            start: Optional[datetime] = None, end: Optional[datetime] = None,
            _: dict = Depends(get_current_user)):
    """Total de vehículos por categoría y dirección."""
    pipe = [{"$match": _match(source_id, job_id, start, end)},
            {"$group": {"_id": {"category": "$meta.category", "direction": "$meta.direction"},
                        "count": {"$sum": "$count"}}},
            {"$sort": {"_id.category": 1}}]
    return [{"category": r["_id"]["category"], "direction": r["_id"]["direction"], "count": r["count"]}
            for r in db.counts.aggregate(pipe)]


@router.get("/counts/series")
def series(unit: Literal["minute", "hour", "day"] = "minute",
           source_id: Optional[str] = None, job_id: Optional[str] = None,
           start: Optional[datetime] = None, end: Optional[datetime] = None,
           _: dict = Depends(get_current_user)):
    """Serie temporal agregada por unidad de tiempo y categoría (insumo del dashboard)."""
    pipe = [{"$match": _match(source_id, job_id, start, end)},
            {"$group": {"_id": {"t": {"$dateTrunc": {"date": "$ts", "unit": unit}}, "category": "$meta.category"},
                        "count": {"$sum": "$count"}}},
            {"$sort": {"_id.t": 1}}]
    return [{"t": r["_id"]["t"], "category": r["_id"]["category"], "count": r["count"]}
            for r in db.counts.aggregate(pipe)]


@router.get("/audit")
def audit_log(limit: int = 100, _: dict = Depends(require_roles("admin"))):
    return [serialize(a) for a in db.audit_log.find().sort("ts", -1).limit(min(limit, 500))]
