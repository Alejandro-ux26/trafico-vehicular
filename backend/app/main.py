from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .db import db, init_db
from .routers import auth, counts, jobs, sources


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Plataforma de análisis de tráfico vehicular", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
for r in (auth.router, sources.router, jobs.router, counts.router):
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
