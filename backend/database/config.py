from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os
import os

load_dotenv()

db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")

if not db_url:
    db_url = "sqlite:///./memoir.db"
    print("WARNING: Using SQLite database. Set DATABASE_URL for production.")

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

Base.metadata.create_all(bind=engine)
