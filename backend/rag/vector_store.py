"""
Hybrid search: semantic similarity (sentence-transformers, cosine similarity
computed in Python) merged with keyword overlap scoring, weighted re-ranked.

Works identically on SQLite and Postgres — embeddings are stored as a JSON-
encoded list of floats in a plain text column, so there is no dependency on
pgvector, a Postgres extension, or any background job to be useful. Semantic
search degrades gracefully to keyword-only when sentence-transformers isn't
installed (see requirements-ai.txt).

Complexity:
  - semantic_search: O(n) over a family's memories (n = memories with an
    embedding), fine at personal/family scale.
  - keyword_search:  O(n) candidate scan + O(m) token overlap per candidate.
  - hybrid_query:    O(n log n) merge + sort of the two result sets.
"""
import json
import math
import re
import logging
from typing import Optional, List

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Weighted re-rank constants
SEMANTIC_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

_model = None
_model_load_failed = False


def _get_model():
    """Lazily load and cache the embedding model as a process-wide singleton.

    The previous implementation constructed a fresh SentenceTransformer on
    every call (every search, every memory save) — each load takes seconds,
    which made semantic search impractical. Loaded once here and reused.
    """
    global _model, _model_load_failed
    if _model is not None or _model_load_failed:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        logger.info(f"Loaded embedding model {EMBEDDING_MODEL_NAME}")
    except Exception as e:
        logger.warning(f"Embedding model unavailable, semantic search disabled: {e}")
        _model_load_failed = True
        _model = None
    return _model


def get_embedding(text: str) -> Optional[List[float]]:
    """Generate an embedding for text. Returns None if the model is unavailable."""
    if not text or not text.strip():
        return None
    model = _get_model()
    if model is None:
        return None
    try:
        return model.encode(text).tolist()
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return None


def embedding_to_storage(embedding: Optional[List[float]]) -> Optional[str]:
    """Serialize an embedding for storage in the Memory.embedding text column."""
    return json.dumps(embedding) if embedding else None


def _load_embedding(raw) -> Optional[List[float]]:
    """Parse a stored embedding back into a list of floats."""
    if not raw:
        return None
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def semantic_search(
    family_id: str,
    query_text: str,
    db: Session,
    limit: int = 20,
) -> List[dict]:
    """Cosine-similarity search over a family's memory embeddings. O(n)."""
    query_embedding = get_embedding(query_text)
    if not query_embedding:
        return []

    from backend.database.models import Memory, Person

    memories = db.query(Memory).filter(
        Memory.family_id == family_id,
        Memory.embedding.isnot(None),
    ).all()

    results = []
    for mem in memories:
        mem_embedding = _load_embedding(mem.embedding)
        if not mem_embedding:
            continue
        score = _cosine_similarity(query_embedding, mem_embedding)
        person = db.query(Person).filter(Person.id == mem.person_id).first()
        results.append({
            "id": str(mem.id),
            "title": mem.title,
            "story_text": mem.story_text,
            "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
            "person_name": person.name if person else "Unknown",
            "person_id": str(mem.person_id),
            "score": score,
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def keyword_search(
    family_id: str,
    query_text: str,
    db: Session,
    limit: int = 20,
) -> List[dict]:
    """Keyword search scored by query-term coverage, not just substring presence.

    Candidate generation is an ILIKE scan (works on SQLite and Postgres alike);
    ranking is the fraction of distinct query terms found in the memory's text,
    which is a real relevance signal instead of a flat 0.5 for every match.
    """
    terms = _tokenize(query_text)
    if not terms:
        return []
    term_set = set(terms)

    from backend.database.models import Memory, Person
    from sqlalchemy import or_

    conditions = []
    for t in term_set:
        conditions.append(Memory.title.ilike(f"%{t}%"))
        conditions.append(Memory.story_text.ilike(f"%{t}%"))

    candidates = db.query(Memory).filter(
        Memory.family_id == family_id,
        or_(*conditions),
    ).all()

    results = []
    for mem in candidates:
        haystack_terms = set(_tokenize(f"{mem.title or ''} {mem.story_text or ''}"))
        coverage = len(term_set & haystack_terms) / len(term_set)
        if coverage <= 0:
            continue
        person = db.query(Person).filter(Person.id == mem.person_id).first()
        results.append({
            "id": str(mem.id),
            "title": mem.title,
            "story_text": mem.story_text,
            "memory_date": mem.memory_date.isoformat() if mem.memory_date else None,
            "person_name": person.name if person else "Unknown",
            "person_id": str(mem.person_id),
            "score": coverage,
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def hybrid_query(
    family_id: str,
    query_text: str,
    db: Session,
    mode: str = "hybrid",
    limit: int = 20,
    **_ignored,
) -> List[dict]:
    """Hybrid search combining semantic + keyword results with weighted re-rank.

    Args:
        family_id: UUID of the family to search within.
        query_text: The user's search query.
        db: SQLAlchemy session.
        mode: 'semantic' | 'keyword' | 'hybrid' (default hybrid).
        limit: Max results to return.

    Returns:
        List of dicts with keys: id, title, story_text, memory_date,
        person_name, person_id, score (0-1).

    Complexity: O(n log n) for merge + sort of two result sets.
    """
    if mode == "semantic":
        return semantic_search(family_id, query_text, db, limit)

    if mode == "keyword":
        return keyword_search(family_id, query_text, db, limit)

    semantic_results = semantic_search(family_id, query_text, db, limit)
    keyword_results = keyword_search(family_id, query_text, db, limit)

    merged = {}
    for r in semantic_results:
        merged[r["id"]] = dict(r, score=r["score"] * SEMANTIC_WEIGHT)

    for r in keyword_results:
        rid = r["id"]
        if rid in merged:
            merged[rid]["score"] += r["score"] * KEYWORD_WEIGHT
        else:
            merged[rid] = dict(r, score=r["score"] * KEYWORD_WEIGHT)

    sorted_results = sorted(merged.values(), key=lambda x: x["score"], reverse=True)
    return sorted_results[:limit]
