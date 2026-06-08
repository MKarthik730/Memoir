import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

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
    """Create all tables."""
    from backend.database.models import Base
    Base.metadata.create_all(bind=engine)
    
    # Try to enable pgvector extension
    if DATABASE_URL.startswith("postgresql"):
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
        except Exception:
            pass  # Graceful fallback


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
