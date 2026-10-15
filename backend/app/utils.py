from bson import ObjectId
from fastapi import HTTPException


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(422, "Identificador inválido")


def serialize(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            v = str(v)
        out["id" if k == "_id" else k] = v
    out.pop("password_hash", None)
    return out
