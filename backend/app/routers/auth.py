import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator

from ..db import audit, db, now
from ..security import ROLES, create_token, hash_password, require_roles, verify_password
from ..utils import serialize

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def valid_username(cls, v):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", v):
            raise ValueError("Solo letras, números, _ . -")
        return v


class RoleIn(BaseModel):
    role: str


@router.post("/register", status_code=201)
def register(body: RegisterIn):
    if db.users.find_one({"username": body.username}):
        raise HTTPException(409, "El usuario ya existe")
    db.users.insert_one({"username": body.username, "password_hash": hash_password(body.password),
                         "role": "usuario", "created_at": now()})
    audit(body.username, "register")
    return {"username": body.username, "role": "usuario"}


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = db.users.find_one({"username": form.username})
    if not user or not verify_password(form.password, user["password_hash"]):
        audit(form.username, "login_failed")
        raise HTTPException(401, "Credenciales incorrectas")
    audit(user["username"], "login")
    return {"access_token": create_token(user["username"], user["role"]), "token_type": "bearer",
            "role": user["role"]}


@router.put("/users/{username}/role")
def set_role(username: str, body: RoleIn, admin: dict = Depends(require_roles("admin"))):
    if body.role not in ROLES:
        raise HTTPException(422, f"Rol inválido. Opciones: {ROLES}")
    res = db.users.update_one({"username": username}, {"$set": {"role": body.role}})
    if not res.matched_count:
        raise HTTPException(404, "Usuario no encontrado")
    audit(admin["username"], "set_role", {"target": username, "role": body.role})
    return {"username": username, "role": body.role}


@router.get("/users")
def list_users(_: dict = Depends(require_roles("admin"))):
    return [serialize(u) for u in db.users.find()]
