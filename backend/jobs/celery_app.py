"""
Celery application configuration.

Uses Redis as both broker and result backend.
Configured via REDIS_URL env var (default: redis://localhost:6379/0).
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "memoir",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["backend.jobs.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "precompute-daily-resurfacing": {
            "task": "backend.jobs.tasks.precompute_resurfacing",
            "schedule": 86400.0,  # Every 24 hours
        },
    },
)
