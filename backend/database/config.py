import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./memoir.db")

# Detect if pgvector is available
PGVECTOR_AVAILABLE = False
if DATABASE_URL.startswith("postgresql"):
    try:
        from pgvector.sqlalchemy import Vector
        PGVECTOR_AVAILABLE = True
    except ImportError:
        PGVECTOR_AVAILABLE = False

# Create engine
if DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        connect_args={"sslmode": "prefer"} if "sslmode" not in DATABASE_URL else {},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def check_pgvector():
    """Check if pgvector extension is available in PostgreSQL."""
    if not DATABASE_URL.startswith("postgresql"):
        return False
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT * FROM pg_extension WHERE extname = 'vector'"))
            return result.fetchone() is not None
    except Exception:
        return False


def init_db():
    """Create all tables and migrations."""
    from backend.database.models import Base
    Base.metadata.create_all(bind=engine)
    
    # Run migrations for existing tables (add new columns)
    try:
        with engine.connect() as conn:
            # SQLite migration: add SM-2 columns to memories if they don't exist
            if DATABASE_URL.startswith("sqlite"):
                # Check pragma table_info to see what columns exist
                result = conn.execute(text("PRAGMA table_info(memories)")).fetchall()
                existing_cols = {row[1] for row in result}
                
                cols_to_add = {
                    "last_shown_at": "DATETIME",
                    "interval_days": "INTEGER DEFAULT 1",
                    "ease_factor": "FLOAT DEFAULT 2.5",
                    "next_review_at": "DATETIME",
                }
                for col_name, col_type in cols_to_add.items():
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE memories ADD COLUMN {col_name} {col_type}"))
                        logger.info(f"Added column {col_name} to memories table")
                conn.commit()
            
            # PostgreSQL migration
            if DATABASE_URL.startswith("postgresql"):
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    try:
                        conn.execute(text("""
                            ALTER TABLE memories ADD COLUMN IF NOT EXISTS search_vector tsvector
                            GENERATED ALWAYS AS (
                                to_tsvector('english', coalesce(title, '') || ' ' || coalesce(story_text, ''))
                            ) STORED;
                        """))
                    except Exception:
                        pass
                    try:
                        conn.execute(text("""
                            CREATE INDEX IF NOT EXISTS idx_memories_search_vector
                            ON memories USING GIN(search_vector);
                        """))
                    except Exception:
                        pass
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Migration warning (non-fatal): {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
