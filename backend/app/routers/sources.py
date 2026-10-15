from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..db import audit, db, now
from ..security import get_current_user, require_roles
from ..utils import oid, serialize

router = APIRouter(prefix="/sources", tags=["sources"])


class SourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field("", max_length=500)
    line: List[float] = Field(min_length=4, max_length=4, description="[x1,y1,x2,y2] normalizados 0..1")
    authorized: bool = True  # la fuente debe estar autorizada para poder procesarse

    @field_validator("line")
    @classmethod
    def check_line(cls, v):
        if any(not 0 <= x <= 1 for x in v) or (v[0], v[1]) == (v[2], v[3]):
            raise ValueError("Línea inválida: valores entre 0 y 1 y dos puntos distintos")
        return v


@router.post("", status_code=201)
def create_source(body: SourceIn, user: dict = Depends(require_roles("operador", "admin"))):
    doc = {**body.model_dump(), "created_by": user["username"], "created_at": now()}
    res = db.sources.insert_one(doc)
    audit(user["username"], "create_source", {"source_id": str(res.inserted_id)})
    return serialize({**doc, "_id": res.inserted_id})


@router.get("")
def list_sources(_: dict = Depends(get_current_user)):
    return [serialize(s) for s in db.sources.find().sort("created_at", -1)]


@router.get("/{source_id}")
def get_source(source_id: str, _: dict = Depends(get_current_user)):
    s = db.sources.find_one({"_id": oid(source_id)})
    if not s:
        raise HTTPException(404, "Fuente no encontrada")
    return serialize(s)


@router.put("/{source_id}")
def update_source(source_id: str, body: SourceIn, user: dict = Depends(require_roles("operador", "admin"))):
    res = db.sources.update_one({"_id": oid(source_id)}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Fuente no encontrada")
    audit(user["username"], "update_source", {"source_id": source_id})
    return serialize(db.sources.find_one({"_id": oid(source_id)}))
