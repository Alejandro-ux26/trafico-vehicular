import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .db import db, init_db
from .routers import auth, counts, evaluations, jobs, sources


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Plataforma de análisis de tráfico vehicular", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, sources.router, jobs.router, counts.router, evaluations.router):
    app.include_router(r)


@app.get("/health", tags=["health"])
def health():
    status = {"api": "ok"}
    try:
        db.command("ping")
        status["mongo"] = "ok"
    except Exception:  # noqa: BLE001
        status["mongo"] = "error"
    try:
        status["ai_service"] = "ok" if httpx.get(f"{config.AI_SERVICE_URL}/health", timeout=3).status_code == 200 else "error"
    except Exception:  # noqa: BLE001
        status["ai_service"] = "error"
    return status


# Frontend web (React sin compilación) servido por el propio backend en /app
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", Path(__file__).resolve().parents[2] / "frontend"))
if FRONTEND_DIR.is_dir():
    # En Windows el registro a veces asocia .js con text/plain y el navegador rechaza los módulos
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

    @app.get("/", include_in_schema=False)
    def raiz():
        return RedirectResponse("/app/")
