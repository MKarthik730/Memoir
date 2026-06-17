"""
Conversational Memory Assistant (Agent).

LangGraph-based agent with tool-calling for querying memories,
relationships, trips, and resurfacing suggestions.

The agent MUST call a tool before suggesting anything — no suggestions
from general knowledge alone.

Complexity: Depends on tool calls, each bounded by its own asymptotic cost.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ─── Tool: query_memories ───────────────────────────────────────────────────

def tool_query_memories(
    db: Session,
    family_id: str,
    person_id: Optional[str] = None,
    date_range: Optional[Dict[str, str]] = None,
    keyword: Optional[str] = None,
    limit: int = 10,
    min_score: float = 0.1,
) -> List[Dict]:
    """Search memories using hybrid RAG with relevance threshold. O(n log n).

    Uses hybrid_query() from vector_store.py for semantic + keyword search
    with weighted re-ranking and a configurable relevance threshold.
    Falls back to ILIKE-only only when hybrid search is unavailable.

    Args:
        db: SQLAlchemy session.
        family_id: Family UUID to search within.
        person_id: Optional person UUID to filter by.
        date_range: Optional {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}.
        keyword: Keyword for text search. If None, returns empty list.
        limit: Max results.
        min_score: Minimum relevance score (0-1) for a result to be returned.

    Returns:
        List of memory dicts.
    """
    if not keyword:
        # No keyword means no filter — return empty to avoid showing all memories
        logger.info("tool_query_memories called without keyword — returning empty")
        return []

    from backend.database.models import Person

    # Use hybrid RAG search for proper relevance scoring
    try:
        from backend.rag.vector_store import hybrid_query
        rag_results = hybrid_query(
            family_id=family_id,
            query_text=keyword,
            db=db,
            mode="hybrid",
            limit=limit,
        )

        # Apply relevance threshold and filter by person_id/date_range
        results = []
        for r in rag_results:
            score = r.get("score", 0)
            if score < min_score:
                logger.debug(
                    f"Filtered out memory '{r.get('title', '?')}' "
                    f"(score={score:.4f} < threshold={min_score})"
                )
                continue

            if person_id and r.get("person_id") != person_id:
                continue

            if date_range:
                mem_date = r.get("memory_date")
                if mem_date:
                    if date_range.get("start") and mem_date < date_range["start"]:
                        continue
                    if date_range.get("end") and mem_date > date_range["end"]:
                        continue

            results.append(r)

        logger.debug(
            f"tool_query_memories: keyword={keyword!r}, "
            f"{len(rag_results)} raw results, "
            f"{len(results)} after threshold={min_score}"
        )

        # If hybrid search returned nothing useful, log it clearly
        if not results:
            # Return empty — don't fall back to returning all memories
            return []

        # Enrich with person_name if not already present
        for r in results:
            if "person_name" not in r or not r.get("person_name"):
                person = db.query(Person).filter(Person.id == r.get("person_id")).first()
                r["person_name"] = person.name if person else "Unknown"

        return results

    except ImportError:
        logger.warning("hybrid_query unavailable, falling back to ILIKE")

    # Fallback: ILIKE-only search (no embedding DB / no sentence-transformers)
    from backend.database.models import Memory

    query = db.query(Memory).filter(Memory.family_id == family_id)

    if person_id:
        query = query.filter(Memory.person_id == person_id)

    if date_range:
        if date_range.get("start"):
            query = query.filter(Memory.memory_date >= date_range["start"])
        if date_range.get("end"):
            query = query.filter(Memory.memory_date <= date_range["end"])

    if keyword:
        # Only match if ALL words appear (AND logic, not OR) for stricter filtering
        terms = [t.strip() for t in keyword.split() if len(t.strip()) > 2]
        if not terms:
            terms = [keyword]
        for term in terms:
            query = query.filter(
                Memory.title.ilike(f"%{term}%") |
                Memory.story_text.ilike(f"%{term}%")
            )

    memories = query.order_by(Memory.memory_date.desc().nullslast()).limit(limit).all()

    logger.debug(
        f"tool_query_memories (ILIKE fallback): keyword={keyword!r}, "
        f"terms={[t for t in keyword.split() if len(t.strip()) > 2]!r}, "
        f"{len(memories)} results"
    )

    results = []
    for mem in memories:
        person = db.query(Person).filter(Person.id == mem.person_id).first()
        results.append({
            "id": str(mem.id),
            "title": mem.title,
            "story_text": mem.story_text[:500] if mem.story_text else "",
            "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
            "person_name": person.name if person else "Unknown",
            "score": 0.5,  # Neutral score for ILIKE fallback
        })

    return results


# ─── Tool: query_relationship ────────────────────────────────────────────────

def tool_query_relationship(
    db: Session,
    family_id: str,
    person_a_id: Optional[str] = None,
    person_b_id: Optional[str] = None,
) -> Dict:
    """Get relationship info between two people using graph algorithms.

    Args:
        db: SQLAlchemy session.
        family_id: Family UUID.
        person_a_id: Optional starting person UUID.
        person_b_id: Optional target person UUID.

    Returns:
        Dict with path info or all relationships in the family.
    """
    from backend.database.models import Person, Relationship

    people = db.query(Person).filter(Person.family_id == family_id).all()
    rels = db.query(Relationship).filter(Relationship.family_id == family_id).all()

    people_map = {str(p.id): {"id": str(p.id), "name": p.name} for p in people}
    people_names = {str(p.id): p.name for p in people}

    # Build adjacency list
    adj = {}
    for rel in rels:
        a_id = str(rel.person_a_id)
        b_id = str(rel.person_b_id)
        label = rel.label or ""
        adj.setdefault(a_id, []).append((b_id, label))
        adj.setdefault(b_id, []).append((a_id, label))

    if person_a_id and person_b_id:
        # Find shortest path
        from backend.graph.algorithms import shortest_path, build_adjacency_list
        rel_list = [{
            "person_a": {"id": str(r.person_a_id)},
            "person_b": {"id": str(r.person_b_id)},
            "label": r.label,
        } for r in rels]
        adj_full = build_adjacency_list(
            [{"id": str(p.id), "name": p.name} for p in people],
            rel_list,
        )
        path = shortest_path(person_a_id, person_b_id, adj_full, people_names)
        return {"path": path, "people": list(people_map.values())}

    return {
        "people": list(people_map.values()),
        "relationship_count": len(rels),
    }


# ─── Tool: query_trips ───────────────────────────────────────────────────────

def tool_query_trips(
    db: Session,
    family_id: str,
    person_id: Optional[str] = None,
    location: Optional[str] = None,
    date_range: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """Query trips. O(m) where m = trips.

    Args:
        db: SQLAlchemy session.
        family_id: Family UUID.
        person_id: Optional filter by person on trip.
        location: Optional location filter.
        date_range: Optional {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}.

    Returns:
        List of trip dicts with associated people and memories.
    """
    from backend.database.models import Trip, TripPerson, TripMemory, Person, Memory

    query = db.query(Trip).filter(Trip.family_id == family_id)

    if person_id:
        trip_ids = [
            tp.trip_id
            for tp in db.query(TripPerson).filter(TripPerson.person_id == person_id).all()
        ]
        query = query.filter(Trip.id.in_(trip_ids))

    if location:
        query = query.filter(Trip.location.ilike(f"%{location}%"))

    if date_range:
        if date_range.get("start"):
            query = query.filter(Trip.start_date >= date_range["start"])
        if date_range.get("end"):
            query = query.filter(Trip.end_date <= date_range["end"])

    trips = query.order_by(Trip.start_date.desc().nullslast()).limit(20).all()

    results = []
    for trip in trips:
        trip_people = db.query(TripPerson).filter(TripPerson.trip_id == trip.id).all()
        trip_mems = db.query(TripMemory).filter(TripMemory.trip_id == trip.id).all()

        results.append({
            "id": str(trip.id),
            "name": trip.name,
            "location": trip.location,
            "start_date": trip.start_date.isoformat() if trip.start_date else None,
            "end_date": trip.end_date.isoformat() if trip.end_date else None,
            "notes": trip.notes,
            "people_count": len(trip_people),
            "memory_count": len(trip_mems),
        })

    return results


# ─── Tool: get_resurfacing_suggestions ───────────────────────────────────────

def tool_get_resurfacing_suggestions(
    user_id: str,
    db: Session,
    limit: int = 5,
) -> List[Dict]:
    """Get memories due for resurfacing today. O(n).

    Args:
        user_id: Current user UUID.
        db: SQLAlchemy session.
        limit: Max results.

    Returns:
        List of memory dicts due for review.
    """
    from backend.scheduling.sm2 import get_today_memories_for_user
    return get_today_memories_for_user(user_id, db, limit)


# ─── Tool: get_neglected_connections ─────────────────────────────────────────

def tool_get_neglected_connections(
    db: Session,
    family_id: str,
    threshold_days: int = 90,
) -> List[Dict]:
    """Find people with the longest gap since last memory. O(p log p) for sort.

    Args:
        db: SQLAlchemy session.
        family_id: Family UUID.
        threshold_days: Days without a memory to be "neglected" (default 90).

    Returns:
        List of people with days since last memory, sorted descending.
    """
    from backend.database.models import Person, Memory
    from sqlalchemy import func

    people = db.query(Person).filter(Person.family_id == family_id).all()
    now = datetime.utcnow()

    neglected = []
    for person in people:
        last_memory = (
            db.query(func.max(Memory.created_at))
            .filter(Memory.person_id == person.id)
            .scalar()
        )
        if last_memory:
            days_since = (now - last_memory).days
            neglected.append({
                "person_id": str(person.id),
                "person_name": person.name,
                "days_since_last_memory": days_since,
                "last_memory_date": last_memory.isoformat(),
            })
        else:
            # No memories at all
            neglected.append({
                "person_id": str(person.id),
                "person_name": person.name,
                "days_since_last_memory": 9999,
                "last_memory_date": None,
            })

    neglected.sort(key=lambda x: x["days_since_last_memory"], reverse=True)
    return [n for n in neglected if n["days_since_last_memory"] >= threshold_days]


# ─── Agent Response Builder ──────────────────────────────────────────────────

def build_agent_response(
    user_message: str,
    user_id: str,
    family_id: str,
    db: Session,
) -> Dict:
    """Process a user message through tool-calling and build a response.

    For the MVP, we use a simple intent-routing approach:
    - Parse the message for keywords indicating which tool(s) to call
    - Execute the appropriate tool(s)
    - Build a natural-language response string

    In production, this would be replaced with a LangGraph agent that
    calls an LLM for intent parsing + tool selection.

    Args:
        user_message: The user's chat message.
        user_id: Current user UUID.
        family_id: Current family UUID.
        db: SQLAlchemy session.

    Returns:
        Dict with keys: response (str), suggestions (List[str]), tool_calls (List[str]).
    """
    msg_lower = user_message.lower()
    tool_calls = []
    context = []

    # Intent routing based on keywords
    is_memory_query = any(kw in msg_lower for kw in ["memory", "remember", "story", "tell me about"])
    is_relationship_query = any(kw in msg_lower for kw in ["connect", "relationship", "path", "how are", "related"])
    is_trip_query = any(kw in msg_lower for kw in ["trip", "travel", "visited", "went to"])
    is_resurfacing = any(kw in msg_lower for kw in ["resurface", "due", "review", "on this day", "today"])
    is_neglected = any(kw in msg_lower for kw in ["neglect", "haven't", "long time", "forgotten"])

    if is_memory_query or (not any([is_relationship_query, is_trip_query, is_resurfacing, is_neglected])):
        # Default to memory search
        keyword = user_message  # Use the full user message as the keyword by default
        person_id = None
        for person_ref in ["dadi", "thatha", "dad", "mom", "karthik", "priya", "rajan", "ananya"]:
            if person_ref in msg_lower:
                from backend.database.models import Person
                person = db.query(Person).filter(
                    Person.family_id == family_id,
                    Person.name.ilike(f"%{person_ref}%"),
                ).first()
                if person:
                    person_id = str(person.id)
                    break

        # Extract a more focused keyword (last 5 words after "about" or "find")
        # but still fall back to the full query if no stop-word pattern is found
        if "about" in msg_lower:
            extracted = msg_lower.split("about")[-1].strip().split()[:5]
            if extracted:
                keyword = " ".join(extracted)
        elif "find" in msg_lower:
            extracted = msg_lower.split("find")[-1].strip().split()[:5]
            if extracted:
                keyword = " ".join(extracted)

        memories = tool_query_memories(db, family_id, person_id=person_id, keyword=keyword)
        tool_calls.append("query_memories")
        if memories:
            context.append(f"Found {len(memories)} memories.")
            for m in memories[:3]:
                context.append(f"- {m['title']} ({m['person_name']}, {m['memory_date'] or 'no date'})")
        else:
            context.append("No matching memories found.")

    if is_relationship_query:
        # Extract person names from the query
        from backend.database.models import Person
        people = db.query(Person).filter(Person.family_id == family_id).all()
        mentioned = [p for p in people if p.name.lower() in msg_lower]

        if len(mentioned) >= 2:
            rel_info = tool_query_relationship(db, family_id, str(mentioned[0].id), str(mentioned[1].id))
            tool_calls.append("query_relationship")
            if rel_info.get("path"):
                path = rel_info["path"]
                context.append(f"Path between {mentioned[0].name} and {mentioned[1].name}: {path.get('degree', '?')} degree(s) of separation.")
                for node in path.get("path", []):
                    context.append(f"- {node.get('name', '?')}")
            else:
                context.append(f"No direct path found between {mentioned[0].name} and {mentioned[1].name}.")
        else:
            rel_info = tool_query_relationship(db, family_id)
            tool_calls.append("query_relationship")
            context.append(f"Family has {rel_info.get('relationship_count', 0)} relationships.")

    if is_trip_query:
        location = None
        for loc_ref in ["to ", "in ", "visited "]:
            if loc_ref in msg_lower:
                parts = msg_lower.split(loc_ref)
                if len(parts) > 1:
                    location = parts[-1].strip().split()[0] if parts[-1].strip() else None
                    break
        trips = tool_query_trips(db, family_id, location=location)
        tool_calls.append("query_trips")
        if trips:
            context.append(f"Found {len(trips)} trips.")
            for t in trips[:3]:
                context.append(f"- {t['name']} ({t['location'] or 'unknown location'})")
        else:
            context.append("No matching trips found.")

    if is_resurfacing:
        due = tool_get_resurfacing_suggestions(user_id, db)
        tool_calls.append("get_resurfacing_suggestions")
        if due:
            context.append("Memories due for review today:")
            for m in due[:3]:
                context.append(f"- {m['title']} ({m.get('person_name', '?')})")
        else:
            context.append("No memories due for review today.")

    if is_neglected:
        neglected = tool_get_neglected_connections(db, family_id)
        tool_calls.append("get_neglected_connections")
        if neglected:
            context.append("Connections you might want to revisit:")
            for n in neglected[:3]:
                context.append(
                    f"- {n['person_name']}: {n['days_since_last_memory']} days since last memory"
                )
        else:
            context.append("Everyone has been remembered recently.")

    # Build natural language response
    if not tool_calls:
        # Default: search memories using the full user message as keyword
        memories = tool_query_memories(db, family_id, keyword=user_message)
        tool_calls.append("query_memories")
        if memories:
            context.append(f"Here are some memories related to your question:")
            for m in memories[:3]:
                context.append(f"- {m['title']}")
        else:
            context.append("I couldn't find specific memories matching your question. Try being more specific!")

    response = "\n".join(context) if context else "I'm not sure how to help with that. Try asking about memories, relationships, or trips!"

    suggestions = [
        "Who have I been neglecting?",
        "What memories are due for review?",
        "Tell me about a trip",
        "How are Mom and Dad related?",
    ]

    return {
        "response": response,
        "suggestions": suggestions,
        "tool_calls": tool_calls,
    }
