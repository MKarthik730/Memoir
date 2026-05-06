from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv
import os

load_dotenv()

db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")

if not db_url:
    db_url = "sqlite:///./memoir.db"
    print("WARNING: Using SQLite database. Set DATABASE_URL for production.")

if db_url.startswith("postgresql"):
    engine = create_engine(
        db_url,
        poolclass=NullPool,
        connect_args={"sslmode": "prefer"},
    )
else:
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False}
        if db_url.startswith("sqlite")
        else {},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Import Base from models to ensure tables are created correctly
from database.models import Base

Base.metadata.create_all(bind=engine) if not os.getenv("RENDER") else None
