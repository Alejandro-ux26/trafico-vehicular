import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from .. import config
from ..db import audit, db, now
from ..security import get_current_user, require_roles
from ..utils import oid, serialize

router = APIRouter(prefix="/jobs", tags=["jobs"])
METHODS = ("yolo26", "baseline")


def run_job(job_id) -> None:
    """Corre en segundo plano: llama al microservicio de IA y guarda los resultados."""
    job = db.jobs.find_one({"_id": job_id})
    source = db.sources.find_one({"_id": oid(job["source_id"])})
    db.jobs.update_one({"_id": job_id}, {"$set": {"status": "procesando", "started_at": now()}})
    try:
        resp = httpx.post(
            f"{config.AI_SERVICE_URL}/process",
            json={"video_path": job["video_path"], "line": source["line"], "method": job["method"],
                  "interval_seconds": job["interval_seconds"]},
            timeout=3600,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Servicio IA respondió {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        base = job["recorded_at"]
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        docs = [{
            "ts": base + timedelta(seconds=c["interval_start_s"]),
            "meta": {"source_id": job["source_id"], "job_id": str(job_id),
                     "category": c["category"], "direction": c["direction"]},
            "count": c["count"],
            "interval_seconds": job["interval_seconds"],
        } for c in data["counts"]]
        if docs:
            db.counts.insert_many(docs)
        totals: dict = {}
        for c in data["counts"]:
            totals[c["category"]] = totals.get(c["category"], 0) + c["count"]
        db.jobs.update_one({"_id": job_id}, {"$set": {
            "status": "completado", "finished_at": now(), "ai_meta": data["meta"], "totals": totals}})
        audit(job["created_by"], "job_completed", {"job_id": str(job_id)})
    except Exception as e:  # noqa: BLE001
        db.jobs.update_one({"_id": job_id}, {"$set": {"status": "error", "error": str(e), "finished_at": now()}})
        audit(job["created_by"], "job_failed", {"job_id": str(job_id), "error": str(e)[:200]})


@router.post("", status_code=202)
async def create_job(
    background: BackgroundTasks,
    source_id: str = Form(...),
    method: str = Form("yolo26"),
    interval_seconds: int = Form(10),
    recorded_at: Optional[datetime] = Form(None),
    file: UploadFile = File(...),
    user: dict = Depends(require_roles("operador", "admin")),
):
    if method not in METHODS:
        raise HTTPException(422, f"method debe ser uno de {METHODS}")
    if not 1 <= interval_seconds <= 3600:
        raise HTTPException(422, "interval_seconds debe estar entre 1 y 3600")
    source = db.sources.find_one({"_id": oid(source_id)})
    if not source:
        raise HTTPException(404, "Fuente no encontrada")
    if not source.get("authorized"):
        raise HTTPException(403, "La fuente no está autorizada para procesamiento")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in config.ALLOWED_VIDEO_EXT:
        raise HTTPException(422, f"Formato no permitido. Usa: {sorted(config.ALLOWED_VIDEO_EXT)}")

    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = config.UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    size, limit = 0, config.MAX_UPLOAD_MB * 1024 * 1024
    with open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"El archivo supera {config.MAX_UPLOAD_MB} MB")
            out.write(chunk)

    doc = {"source_id": source_id, "method": method, "interval_seconds": interval_seconds,
           "video_path": str(dest), "original_name": file.filename, "status": "pendiente",
           "recorded_at": recorded_at or now(), "created_by": user["username"], "created_at": now(),
           "error": None, "ai_meta": None, "totals": None}
    res = db.jobs.insert_one(doc)
    audit(user["username"], "create_job", {"job_id": str(res.inserted_id), "method": method})
    background.add_task(run_job, res.inserted_id)
    return {"id": str(res.inserted_id), "status": "pendiente"}


@router.get("")
def list_jobs(source_id: Optional[str] = None, _: dict = Depends(get_current_user)):
    q = {"source_id": source_id} if source_id else {}
    return [serialize(j) for j in db.jobs.find(q).sort("created_at", -1).limit(200)]


@router.get("/{job_id}")
def get_job(job_id: str, _: dict = Depends(get_current_user)):
    j = db.jobs.find_one({"_id": oid(job_id)})
    if not j:
        raise HTTPException(404, "Trabajo no encontrado")
    return serialize(j)
