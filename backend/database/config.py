import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./memoir.db")

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

            # PostgreSQL: embedding column predates this migration on some
            # deployments as a pgvector `vector` type; make sure it's plain
            # text so the Python-side cosine-similarity search can read it.
            if DATABASE_URL.startswith("postgresql"):
                try:
                    conn.execute(text("ALTER TABLE memories ALTER COLUMN embedding TYPE TEXT"))
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
