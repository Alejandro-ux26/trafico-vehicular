"""Microservicio de IA: recibe un video ya validado por el backend y devuelve conteos + metadatos."""
import os
import re
from pathlib import Path
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator

SERVICE_VERSION = "0.1.0"
DATA_DIR = Path(os.getenv("DATA_DIR", "./data")).resolve()

app = FastAPI(title="Servicio IA - Tráfico vehicular", version=SERVICE_VERSION)


class ProcessRequest(BaseModel):
    video_path: str
    line: List[float] = Field(min_length=4, max_length=4, description="[x1,y1,x2,y2] normalizados 0..1")
    method: Literal["yolo26", "baseline"] = "yolo26"
    interval_seconds: int = Field(10, ge=1, le=3600)
    stride: int = Field(2, ge=1, le=10)
    imgsz: int = Field(480, ge=160, le=1280)
    conf: float = Field(0.3, gt=0, lt=1)
    model_name: str = "yolo26n.pt"

    @field_validator("line")
    @classmethod
    def check_line(cls, v):
        if any(not 0 <= x <= 1 for x in v):
            raise ValueError("Las coordenadas de la línea deben estar entre 0 y 1")
        if (v[0], v[1]) == (v[2], v[3]):
            raise ValueError("La línea necesita dos puntos distintos")
        return v

    @field_validator("model_name")
    @classmethod
    def check_model(cls, v):
        if not re.fullmatch(r"yolo26[nsmlx]\.pt", v):
            raise ValueError("model_name debe ser yolo26n/s/m/l/x .pt")
        return v


@app.get("/health")
def health():
    return {"status": "ok", "service_version": SERVICE_VERSION}


@app.post("/process")
def process(req: ProcessRequest):
    path = Path(req.video_path).resolve()
    if DATA_DIR not in path.parents:
        raise HTTPException(400, "Ruta de video fuera del directorio de datos")
    if not path.is_file():
        raise HTTPException(404, "Video no encontrado")
    try:
        if req.method == "yolo26":
            from .yolo_counter import run_yolo

            counts, meta = run_yolo(str(path), req.line, req.interval_seconds, req.stride,
                                    req.imgsz, req.conf, req.model_name)
        else:
            from .baseline import run_baseline

            counts, meta = run_baseline(str(path), req.line, req.interval_seconds, req.stride)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Error de inferencia: {e}")
    meta["service_version"] = SERVICE_VERSION
    return {"counts": counts, "meta": meta}
