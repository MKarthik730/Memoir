"""
Background Celery tasks.

All tasks return a job_id immediately and update their status in Redis
so the frontend can poll GET /home/jobs/{job_id} for progress.

Complexity:
  - generate_pdf: O(m * p) where m = memories, p = pages
  - generate_embedding: O(n) on model size
  - precompute_resurfacing: O(u * m) where u = users, m = memories per user
"""
import logging
import json
from datetime import datetime, timedelta
from typing import Optional
from celery import current_task
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.jobs.celery_app import celery_app
from backend.database.config import SessionLocal, engine
from backend.database.models import Memory, Person, Family, FamilyMember

logger = logging.getLogger(__name__)

# Redis client for job status updates
import redis as redis_lib
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis_lib.from_url(REDIS_URL)
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            _redis_client = None
    return _redis_client


def _update_job_status(job_id: str, status: str, progress: float = 0, result: dict = None):
    """Update job status in Redis. O(1)."""
    r = get_redis()
    if r is None:
        return
    data = {
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "updated_at": datetime.utcnow().isoformat(),
    }
    if result:
        data["result"] = result
    r.setex(f"memoir:job:{job_id}", 3600, json.dumps(data))


@celery_app.task(bind=True, name="backend.jobs.tasks.generate_pdf")
def generate_pdf(self, person_id: str, family_id: str, user_id: str):
    """Generate a PDF memoir book for a person. Runs asynchronously.

    The frontend polls GET /home/jobs/{task_id} for progress.

    Uses jsPDF via a headless browser or builds a server-side PDF.
    For the MVP, this generates a structured JSON representation that
    can be rendered client-side.
    Complexity: O(m * p) where m = memories, p = pages.
    """
    job_id = self.request.id
    _update_job_status(job_id, "processing", 0.1)

    try:
        from backend.database.config import SessionLocal
        from backend.database.models import Person, Memory, MemoryPhoto

        db = SessionLocal()
        try:
            _update_job_status(job_id, "processing", 0.3,
                               {"message": "Gathering memories"})

            person = db.query(Person).filter(Person.id == person_id).first()
            if not person:
                raise ValueError("Person not found")

            memories = db.query(Memory).filter(
                Memory.person_id == person_id
            ).order_by(Memory.memory_date.desc().nullslast()).all()

            # Build structured data for the frontend to render as PDF
            pdf_data = {
                "title": f"{person.name}'s Memoir",
                "person_name": person.name,
                "person_bio": person.bio,
                "generated_at": datetime.utcnow().isoformat(),
                "memories": [],
            }

            for mem in memories:
                photos = db.query(MemoryPhoto).filter(
                    MemoryPhoto.memory_id == mem.id
                ).all()
                pdf_data["memories"].append({
                    "title": mem.title,
                    "story_text": mem.story_text,
                    "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
                    "photo_urls": [p.photo_url for p in photos[:3]],
                })

            _update_job_status(job_id, "processing", 0.8,
                               {"message": "Binding your book"})

            import json
            _update_job_status(job_id, "completed", 1.0, {
                "pdf_data": pdf_data,
                "filename": f"{person.name.replace(' ', '_')}_Memoir.pdf",
            })
            return {"status": "completed", "job_id": job_id}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        _update_job_status(job_id, "failed", 0, {"error": str(e)})
        raise


@celery_app.task(bind=True, name="backend.jobs.tasks.generate_embedding")
def generate_embedding(self, memory_id: str):
    """Generate embedding for a single memory. Runs asynchronously. O(n)."""
    job_id = self.request.id
    _update_job_status(job_id, "processing", 0.1)

    try:
        from backend.database.config import SessionLocal, PGVECTOR_AVAILABLE
        from backend.rag.vector_store import _get_embedding

        db = SessionLocal()
        try:
            memory = db.query(Memory).filter(Memory.id == memory_id).first()
            if not memory:
                _update_job_status(job_id, "failed", 0, {"error": "Memory not found"})
                return {"status": "failed"}

            text = f"{memory.title} {memory.story_text or ''}"
            embedding = _get_embedding(text)

            if embedding and PGVECTOR_AVAILABLE:
                memory.embedding = embedding
                db.commit()
                _update_job_status(job_id, "completed", 1.0)
            else:
                _update_job_status(job_id, "completed", 1.0,
                                   {"message": "pgvector unavailable, embedding stored as text"})
                if embedding:
                    memory.embedding = str(embedding)
                    db.commit()

            return {"status": "completed", "job_id": job_id}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        _update_job_status(job_id, "failed", 0, {"error": str(e)})
        raise


@celery_app.task(name="backend.jobs.tasks.precompute_resurfacing")
def precompute_resurfacing():
    """Daily Celery Beat task: compute today's resurfacing memories for all users.

    This is a lightweight task that just touches next_review_at for memories
    that should resurface today, ensuring fast reads for the dashboard.

    Complexity: O(u * m) where u = users, m = memories per user.
    """
    from backend.scheduling.sm2 import get_due_memories

    db = SessionLocal()
    try:
        users = db.query(FamilyMember.user_id).distinct().all()
        count = 0
        for (uid,) in users:
            due = get_due_memories(str(uid), db, limit=50)
            count += len(due)
        logger.info(f"Precomputed resurfacing for {len(users)} users, {count} memories due today")
        return {"users_processed": len(users), "memories_due": count}
    finally:
        db.close()


def get_job_status(job_id: str) -> Optional[dict]:
    """Get the current status of a background job from Redis. O(1)."""
    r = get_redis()
    if r is None:
        return {"job_id": job_id, "status": "unknown", "progress": 0}
    data = r.get(f"memoir:job:{job_id}")
    if data is None:
        return {"job_id": job_id, "status": "not_found", "progress": 0}
    return json.loads(data)
