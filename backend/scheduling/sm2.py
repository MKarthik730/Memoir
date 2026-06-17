"""
SM-2 Spaced Repetition Algorithm

Implements the SM-2 algorithm (same as Anki) for scheduling memory resurfacing.
When a user marks a resurfaced memory as "still meaningful" or "let it fade",
the algorithm updates the interval and ease factor accordingly.

Complexity:
  - sm2_update: O(1) — constant-time update
  - due_memories: O(n) — scans all memories for next_review_at <= now
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

logger = logging.getLogger(__name__)

# Default SM-2 parameters
DEFAULT_INTERVAL_DAYS = 1
DEFAULT_EASE_FACTOR = 2.5
MINIMUM_EASE_FACTOR = 1.3
MAXIMUM_INTERVAL_DAYS = 365  # Cap at 1 year


def sm2_update(
    quality: int,
    interval_days: int,
    ease_factor: float,
) -> dict:
    """Apply the SM-2 algorithm update rule.

    Args:
        quality: User rating 0-5 (0=complete blackout, 5=perfect response).
                 In practice: 0-2 = "let it fade" (fail), 3-5 = "still meaningful" (pass).
        interval_days: Current interval in days.
        ease_factor: Current ease factor (default 2.5).

    Returns:
        dict with keys:
          - interval_days: New interval
          - ease_factor: Updated ease factor
          - next_review_at: ISO datetime string for next review

    SM-2 Algorithm:
      1. If quality < 3 (failed): reset interval to 1, ease factor decreases.
      2. If quality >= 3 (passed): calculate new interval:
         - First review: 1 day
         - Second review: 6 days
         - Subsequent: interval * ease_factor
         - Ease factor increases slightly on perfect responses, decreases otherwise.

    Complexity: O(1).
    """
    quality = max(0, min(5, quality))

    if quality < 3:
        # Failed: reset
        new_interval = 1
        new_ease = max(MINIMUM_EASE_FACTOR, ease_factor - 0.20)
    else:
        # Passed
        if interval_days < 1:
            new_interval = 1
        elif interval_days == 1:
            new_interval = 6
        else:
            new_interval = min(
                MAXIMUM_INTERVAL_DAYS,
                round(interval_days * ease_factor)
            )

        # Adjust ease factor based on quality
        new_ease = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease = max(MINIMUM_EASE_FACTOR, new_ease)

    next_review = datetime.utcnow() + timedelta(days=new_interval)

    return {
        "interval_days": new_interval,
        "ease_factor": round(new_ease, 2),
        "next_review_at": next_review.isoformat(),
    }


def get_due_memories(
    user_id: str,
    db: Session,
    limit: int = 10,
) -> List[dict]:
    """Get memories that are due for review (next_review_at <= now).

    Scans all families the user belongs to and returns due memories
    across the entire family tree.

    Args:
        user_id: UUID of the user.
        db: SQLAlchemy session.
        limit: Max memories to return (default 10).

    Returns:
        List of memory dicts with person info.

    Complexity: O(n) where n = memories across user's families.
    """
    from backend.database.models import Memory, Person, FamilyMember, Family

    # Get user's families
    family_ids = [
        str(fm.family_id)
        for fm in db.query(FamilyMember).filter(FamilyMember.user_id == user_id).all()
    ]

    if not family_ids:
        return []

    now = datetime.utcnow()

    memories = (
        db.query(Memory)
        .filter(
            Memory.family_id.in_(family_ids),
            and_(
                Memory.next_review_at.isnot(None),
                Memory.next_review_at <= now,
            ),
        )
        .order_by(Memory.next_review_at.asc())
        .limit(limit)
        .all()
    )

    results = []
    for mem in memories:
        person = db.query(Person).filter(Person.id == mem.person_id).first()
        results.append({
            "id": str(mem.id),
            "person_id": str(mem.person_id),
            "person_name": person.name if person else "Unknown",
            "family_id": str(mem.family_id),
            "title": mem.title,
            "story_text": mem.story_text,
            "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
            "last_shown_at": mem.last_shown_at.isoformat() if mem.last_shown_at else None,
            "interval_days": mem.interval_days,
            "ease_factor": mem.ease_factor,
            "next_review_at": mem.next_review_at.isoformat() if mem.next_review_at else None,
        })

    return results


def get_today_memories_for_user(
    user_id: str,
    db: Session,
    limit: int = 5,
) -> List[dict]:
    """Get a short list of 'On This Day' / resurfacing memories for the dashboard.

    Selects memories whose next_review_at is today, or falls back to
    randomly selecting memories not seen recently if none are scheduled.

    Complexity: O(n log n) worst case for sort + limit.
    """
    from backend.database.models import Memory, FamilyMember, Family, Person
    from sqlalchemy import func

    family_ids = [
        str(fm.family_id)
        for fm in db.query(FamilyMember).filter(FamilyMember.user_id == user_id).all()
    ]
    if not family_ids:
        return []

    due = get_due_memories(user_id, db, limit)
    if due:
        return due

    # Fallback: memories not shown recently
    memories = (
        db.query(Memory)
        .filter(
            Memory.family_id.in_(family_ids),
            Memory.created_by_user_id == user_id,
        )
        .order_by(
            Memory.last_shown_at.asc().nullsfirst(),
            func.random(),
        )
        .limit(limit)
        .all()
    )

    results = []
    for mem in memories:
        person = db.query(Person).filter(Person.id == mem.person_id).first()
        results.append({
            "id": str(mem.id),
            "person_id": str(mem.person_id),
            "person_name": person.name if person else "Unknown",
            "family_id": str(mem.family_id),
            "title": mem.title,
            "story_text": mem.story_text,
            "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
            "interval_days": mem.interval_days,
            "ease_factor": mem.ease_factor,
        })

    return results
