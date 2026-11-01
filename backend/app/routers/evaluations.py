from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..security import get_current_user
from ..utils import oid, serialize

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.get("")
def list_evaluations(limit: int = 20, _: dict = Depends(get_current_user)):
    """Lista resumida de las evaluaciones guardadas por el notebook."""
    docs = db.evaluations.find({}, {"created_at": 1, "notebook_version": 1, "videos": 1}) \
        .sort("created_at", -1).limit(min(limit, 100))
    return [serialize(d) for d in docs]


@router.get("/latest")
def latest_evaluation(_: dict = Depends(get_current_user)):
    doc = next(iter(db.evaluations.find({}).sort("created_at", -1).limit(1)), None)
    if not doc:
        raise HTTPException(404, "Aún no hay evaluaciones. Ejecuta el notebook de evaluación.")
    return serialize(doc)


@router.get("/{evaluation_id}")
def get_evaluation(evaluation_id: str, _: dict = Depends(get_current_user)):
    doc = db.evaluations.find_one({"_id": oid(evaluation_id)})
    if not doc:
        raise HTTPException(404, "Evaluación no encontrada")
    return serialize(doc)
