from datetime import datetime, timezone

from pymongo import ASCENDING, MongoClient
from pymongo.errors import CollectionInvalid

from . import config
from .security import hash_password

client = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
db = client[config.MONGO_DB]


def now():
    return datetime.now(timezone.utc)


def init_db() -> None:
    config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db.users.create_index([("username", ASCENDING)], unique=True)
    db.jobs.create_index([("source_id", ASCENDING), ("created_at", ASCENDING)])
    db.audit_log.create_index([("ts", ASCENDING)])
    try:  # colección de series temporales (MongoDB >= 5.0)
        db.create_collection(
            "counts", timeseries={"timeField": "ts", "metaField": "meta", "granularity": "seconds"}
        )
    except CollectionInvalid:
        pass
    if not db.users.find_one({"username": config.ADMIN_USER}):
        db.users.insert_one({
            "username": config.ADMIN_USER,
            "password_hash": hash_password(config.ADMIN_PASSWORD),
            "role": "admin",
            "created_at": now(),
        })


def audit(user: str, action: str, detail: dict | None = None) -> None:
    db.audit_log.insert_one({"ts": now(), "user": user, "action": action, "detail": detail or {}})
