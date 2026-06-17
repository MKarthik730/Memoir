import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Text, DateTime, Date, ForeignKey, Enum,
    UniqueConstraint, Index, Float, LargeBinary, TypeDecorator
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel, Field
import enum

# Try to import pgvector Vector type - gracefully handle if unavailable
PGVECTOR_AVAILABLE = False
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    Vector = None


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL UUID when available, otherwise stores as String(36).
    Accepts both uuid.UUID objects and strings as input.
    """
    impl = String(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(UUID())
        return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            # PostgreSQL UUID type accepts uuid.UUID objects directly
            if isinstance(value, str):
                return uuid.UUID(value)
            return value
        # SQLite: store as string
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None or dialect.name == "postgresql":
            return value
        # SQLite: convert back to uuid.UUID
        if isinstance(value, str):
            return uuid.UUID(value)
        return value


Base = declarative_base()

# ─── Enums ───────────────────────────────────────────────────────────────────

class MemberRole(str, enum.Enum):
    admin = "admin"
    member = "member"

class RelationshipTag(str, enum.Enum):
    Grandparent = "Grandparent"
    Parent = "Parent"
    Sibling = "Sibling"
    Child = "Child"
    Uncle_Aunt = "Uncle/Aunt"
    Spouse = "Spouse"
    Friend = "Friend"
    Other = "Other"

# ─── SQLAlchemy Models ───────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    family_members = relationship("FamilyMember", back_populates="user")

class Family(Base):
    __tablename__ = "families"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    cover_photo_url = Column(String, nullable=True)
    invite_token = Column(GUID(), unique=True, default=uuid.uuid4)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("FamilyMember", back_populates="family", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="family", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="family", cascade="all, delete-orphan")
    memories = relationship("Memory", back_populates="family", cascade="all, delete-orphan")

class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    family_id = Column(GUID(), ForeignKey("families.id"), nullable=False)
    role = Column(Enum(MemberRole), default=MemberRole.member)
    joined_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "family_id"),)

    user = relationship("User", back_populates="family_members")
    family = relationship("Family", back_populates="members")

class Person(Base):
    __tablename__ = "people"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    family_id = Column(GUID(), ForeignKey("families.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    relationship_tag = Column(Enum(RelationshipTag), nullable=True)
    photo_url = Column(String, nullable=True)
    dob = Column(Date, nullable=True)
    bio = Column(Text, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    family = relationship("Family", back_populates="people")
    memories = relationship("Memory", back_populates="person", cascade="all, delete-orphan")
    relationships_a = relationship("Relationship", foreign_keys="[Relationship.person_a_id]", back_populates="person_a", cascade="all, delete-orphan")
    relationships_b = relationship("Relationship", foreign_keys="[Relationship.person_b_id]", back_populates="person_b", cascade="all, delete-orphan")

class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    family_id = Column(GUID(), ForeignKey("families.id"), nullable=False)
    person_a_id = Column(GUID(), ForeignKey("people.id"), nullable=False)
    person_b_id = Column(GUID(), ForeignKey("people.id"), nullable=False)
    label = Column(String, nullable=True)

    __table_args__ = (UniqueConstraint("person_a_id", "person_b_id"),)

    family = relationship("Family", back_populates="relationships")
    person_a = relationship("Person", foreign_keys=[person_a_id], back_populates="relationships_a")
    person_b = relationship("Person", foreign_keys=[person_b_id], back_populates="relationships_b")

class Memory(Base):
    __tablename__ = "memories"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    person_id = Column(GUID(), ForeignKey("people.id"), nullable=False, index=True)
    family_id = Column(GUID(), ForeignKey("families.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    story_text = Column(Text, nullable=True)
    memory_date = Column(Date, nullable=True)
    voice_note_url = Column(String, nullable=True)
    created_by_user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # embedding column - VECTOR(384) for pgvector, null fallback for SQLite
    if PGVECTOR_AVAILABLE and Vector:
        embedding = Column(Vector(384), nullable=True)
    else:
        embedding = Column(Text, nullable=True)

    # SM-2 Spaced Repetition fields (Section 5)
    last_shown_at = Column(DateTime, nullable=True)
    interval_days = Column(Integer, default=1)
    ease_factor = Column(Float, default=2.5)
    next_review_at = Column(DateTime, nullable=True)

    person = relationship("Person", back_populates="memories")
    family = relationship("Family", back_populates="memories")
    photos = relationship("MemoryPhoto", back_populates="memory", cascade="all, delete-orphan")

class MemoryPhoto(Base):
    __tablename__ = "memory_photos"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    memory_id = Column(GUID(), ForeignKey("memories.id"), nullable=False, index=True)
    photo_url = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    display_order = Column(Integer, default=0)

    memory = relationship("Memory", back_populates="photos")


# ─── NEW: API Keys (Section 0) ─────────────────────────────────────────────

class ApiKey(Base):
    """Per-user encrypted LLM API keys. Stored encrypted at rest via Fernet.
    The ENCRYPTION_SECRET env var is the only key-level config in .env.
    """
    __tablename__ = "api_keys"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)  # anthropic | groq | openai
    encrypted_key = Column(Text, nullable=False)  # Fernet-encrypted blob
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (UniqueConstraint("user_id", "provider"),)


# ─── NEW: Trips (Section 6) ────────────────────────────────────────────────

class Trip(Base):
    """A trip or journey that groups people and memories together."""
    __tablename__ = "trips"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    family_id = Column(GUID(), ForeignKey("families.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    family = relationship("Family")
    creator = relationship("User")
    people = relationship("TripPerson", back_populates="trip", cascade="all, delete-orphan")
    memories = relationship("TripMemory", back_populates="trip", cascade="all, delete-orphan")

class TripPerson(Base):
    """Join table: which people were on a trip."""
    __tablename__ = "trip_people"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    trip_id = Column(GUID(), ForeignKey("trips.id"), nullable=False)
    person_id = Column(GUID(), ForeignKey("people.id"), nullable=False)

    __table_args__ = (UniqueConstraint("trip_id", "person_id"),)

    trip = relationship("Trip", back_populates="people")
    person = relationship("Person")

class TripMemory(Base):
    """Join table: which memories are associated with a trip."""
    __tablename__ = "trip_memories"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    trip_id = Column(GUID(), ForeignKey("trips.id"), nullable=False)
    memory_id = Column(GUID(), ForeignKey("memories.id"), nullable=False)

    __table_args__ = (UniqueConstraint("trip_id", "memory_id"),)

    trip = relationship("Trip", back_populates="memories")
    memory = relationship("Memory")


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class FamilyCreate(BaseModel):
    name: str

class FamilyResponse(BaseModel):
    id: str
    name: str
    cover_photo_url: Optional[str] = None
    invite_token: str
    created_by: str
    created_at: Optional[datetime] = None
    members: List[dict] = []

    class Config:
        from_attributes = True

class FamilyMemberResponse(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None
    role: str

class PersonCreate(BaseModel):
    name: str
    relationship_tag: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None

class PersonResponse(BaseModel):
    id: str
    family_id: str
    name: str
    relationship_tag: Optional[str] = None
    photo_url: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None
    created_by: str
    created_at: Optional[datetime] = None
    memory_count: int = 0

    class Config:
        from_attributes = True

class PersonDetailResponse(BaseModel):
    id: str
    family_id: str
    name: str
    relationship_tag: Optional[str] = None
    photo_url: Optional[str] = None
    dob: Optional[str] = None
    bio: Optional[str] = None
    created_by: str
    created_at: Optional[datetime] = None
    memories: List[dict] = []

    class Config:
        from_attributes = True

class RelationshipCreate(BaseModel):
    person_a_id: str
    person_b_id: str
    label: str

class RelationshipResponse(BaseModel):
    id: str
    person_a: dict
    person_b: dict
    label: Optional[str] = None

    class Config:
        from_attributes = True

class MemoryCreate(BaseModel):
    title: str
    story_text: Optional[str] = None
    memory_date: Optional[str] = None

class MemoryResponse(BaseModel):
    id: str
    person_id: str
    family_id: str
    title: str
    story_text: Optional[str] = None
    memory_date: Optional[str] = None
    voice_note_url: Optional[str] = None
    created_by_user_id: str
    created_at: Optional[datetime] = None
    photos: List[dict] = []
    contributor: Optional[dict] = None
    person_name: Optional[str] = None

    class Config:
        from_attributes = True

class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1)

class SearchResult(BaseModel):
    memory: dict
    person_name: str
    score: float

class UploadResponse(BaseModel):
    url: str
