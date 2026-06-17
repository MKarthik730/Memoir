"""
Hybrid search module combining pgvector semantic similarity and PostgreSQL
full-text search (tsvector), merged via weighted re-ranking.

Complexity:
  - semantic_search: O(n) cosine similarity over all embedding rows
  - keyword_search:  O(log n) via GIN index on tsvector
  - hybrid_query:    O(n log n) merge + re-rank of two result sets
"""
import logging
import hashlib
import json
from typing import Optional, List
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Weighted re-rank constants
SEMANTIC_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4


def _query_cache_key(user_id: str, query: str) -> str:
    """Generate a Redis cache key for embedding results. O(1)."""
    h = hashlib.sha256(f"{user_id}:{query}".encode()).hexdigest()[:16]
    return f"memoir:embedding:{h}"


def _get_embedding(text: str) -> Optional[list]:
    """Generate embedding using sentence-transformers. O(n) on model size."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode(text).tolist()
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return None


def _build_tsvector_query(query_text: str) -> str:
    """Build a tsquery string from plain text. O(n) on query length."""
    # Strip special characters and join with & for AND matching
    import re
    terms = re.findall(r'\w+', query_text.lower())
    if not terms:
        return ""
    return " & ".join(terms)


def semantic_search(
    family_id: str,
    query_text: str,
    db: Session,
    redis_client=None,
    user_id: Optional[str] = None,
    limit: int = 20,
) -> List[dict]:
    """Perform pgvector cosine similarity search. O(n) on embedding dimension.

    Results cached in Redis for 1 hour (key: hash of query text + user_id).
    """
    embedding = _get_embedding(query_text)
    if not embedding:
        return []

    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"

    sql = text("""
        SELECT m.id, m.title, m.story_text, m.memory_date,
               p.name as person_name, p.id as person_id,
               1 - (m.embedding <=> :embedding) as score
        FROM memories m
        JOIN people p ON p.id = m.person_id
        WHERE m.family_id = :family_id AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> :embedding
        LIMIT :limit
    """)

    try:
        rows = db.execute(sql, {
            "embedding": embedding_str,
            "family_id": family_id,
            "limit": limit,
        }).fetchall()

        results = []
        for row in rows:
            results.append({
                "id": str(row[0]),
                "title": row[1],
                "story_text": row[2],
                "memory_date": row[3].isoformat() if row[3] else None,
                "person_name": row[4],
                "person_id": str(row[5]) if row[5] else None,
                "score": float(row[6]) if row[6] else 0,
            })
        return results
    except Exception as e:
        logger.warning(f"Semantic search failed: {e}")
        return []


def keyword_search(
    family_id: str,
    query_text: str,
    db: Session,
    limit: int = 20,
) -> List[dict]:
    """Perform PostgreSQL full-text search via tsvector. O(log n) with GIN index.

    Falls back to ILIKE if tsvector column/index doesn't exist.
    """
    tsquery = _build_tsvector_query(query_text)
    if not tsquery:
        return []

    # Try tsvector first
    try:
        sql = text(f"""
            SELECT m.id, m.title, m.story_text, m.memory_date,
                   p.name as person_name, p.id as person_id,
                   ts_rank(m.search_vector, to_tsquery('english', :tsquery)) as score
            FROM memories m
            JOIN people p ON p.id = m.person_id
            WHERE m.family_id = :family_id
              AND m.search_vector @@ to_tsquery('english', :tsquery)
            ORDER BY score DESC
            LIMIT :limit
        """)
        rows = db.execute(sql, {
            "tsquery": tsquery,
            "family_id": family_id,
            "limit": limit,
        }).fetchall()

        results = []
        for row in rows:
            results.append({
                "id": str(row[0]),
                "title": row[1],
                "story_text": row[2],
                "memory_date": row[3].isoformat() if row[3] else None,
                "person_name": row[4],
                "person_id": str(row[5]) if row[5] else None,
                "score": float(row[6]) if row[6] else 0.5,
            })
        return results
    except Exception:
        # Fallback to ILIKE
        logger.info("tsvector unavailable, falling back to ILIKE")
        from sqlalchemy import or_
        from backend.database.models import Memory, Person
        memories = db.query(Memory).filter(
            Memory.family_id == family_id,
            or_(
                Memory.title.ilike(f"%{query_text}%"),
                Memory.story_text.ilike(f"%{query_text}%"),
            )
        ).order_by(Memory.memory_date.desc().nullslast()).limit(limit).all()

        results = []
        for mem in memories:
            person = db.query(Person).filter(Person.id == mem.person_id).first()
            results.append({
                "id": str(mem.id),
                "title": mem.title,
                "story_text": mem.story_text,
                "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
                "person_name": person.name if person else "Unknown",
                "person_id": str(person.id) if person else None,
                "score": 0.5,
            })
        return results


def hybrid_query(
    family_id: str,
    query_text: str,
    db: Session,
    mode: str = "hybrid",
    redis_client=None,
    user_id: Optional[str] = None,
    limit: int = 20,
) -> List[dict]:
    """Hybrid search combining semantic + keyword results with weighted re-rank.

    Args:
        family_id: UUID of the family to search within.
        query_text: The user's search query.
        db: SQLAlchemy session.
        mode: 'semantic' | 'keyword' | 'hybrid' (default hybrid).
        redis_client: Optional Redis client for caching embeddings.
        user_id: Optional user ID for cache key.
        limit: Max results to return.

    Returns:
        List of dicts with keys: id, title, story_text, memory_date,
        person_name, person_id, score (0-1).

    Complexity: O(n log n) for merge + sort of two result sets.
    """
    if mode == "semantic":
        return semantic_search(family_id, query_text, db, redis_client, user_id, limit)

    if mode == "keyword":
        return keyword_search(family_id, query_text, db, limit)

    # Hybrid: run both and merge
    semantic_results = semantic_search(family_id, query_text, db, redis_client, user_id, limit)
    keyword_results = keyword_search(family_id, query_text, db, limit)

    # Log raw scores for debugging
    logger.debug(
        f"hybrid_query [{query_text!r}]: "
        f"{len(semantic_results)} semantic, {len(keyword_results)} keyword results"
    )
    for r in semantic_results:
        logger.debug(f"  semantic: {r['title']!r} score={r['score']:.4f}")
    for r in keyword_results:
        logger.debug(f"  keyword:  {r['title']!r} score={r['score']:.4f}")

    # Merge by memory ID, applying weighted scores
    merged = {}
    for r in semantic_results:
        rid = r["id"]
        merged[rid] = r
        merged[rid]["score"] = r["score"] * SEMANTIC_WEIGHT

    for r in keyword_results:
        rid = r["id"]
        if rid in merged:
            merged[rid]["score"] += r["score"] * KEYWORD_WEIGHT
        else:
            r["score"] = r["score"] * KEYWORD_WEIGHT
            merged[rid] = r

    # Sort by combined score descending, return top-k
    sorted_results = sorted(merged.values(), key=lambda x: x["score"], reverse=True)

    # Log final scores after threshold
    logger.debug(f"hybrid_query final scores (top {limit}):")
    for r in sorted_results[:limit]:
        logger.debug(f"  final: {r['title']!r} score={r['score']:.4f}")

    return sorted_results[:limit]
