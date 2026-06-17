"""
Background Jobs module.

Uses Celery with Redis broker for async task processing.
If Celery/Redis are unavailable, the app falls back to synchronous execution.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import Celery — gracefully degrade if unavailable
try:
    from backend.jobs.celery_app import celery_app
    from backend.jobs.tasks import generate_pdf, generate_embedding, precompute_resurfacing
    CELERY_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Celery/Redis not available: {e}. Async jobs disabled.")
    CELERY_AVAILABLE = False
    celery_app = None
    generate_pdf = None
    generate_embedding = None
    precompute_resurfacing = None


def get_job_status(job_id: str) -> Optional[dict]:
    """Get job status from Redis, or return a fallback if unavailable."""
    if not CELERY_AVAILABLE:
        return {
            "job_id": job_id,
            "status": "unavailable",
            "progress": 0,
            "message": "Celery/Redis not configured. Jobs run synchronously.",
        }
    from backend.jobs.tasks import get_job_status as _status
    return _status(job_id)


__all__ = [
    "celery_app", "generate_pdf", "generate_embedding", "precompute_resurfacing",
    "get_job_status", "CELERY_AVAILABLE",
]
