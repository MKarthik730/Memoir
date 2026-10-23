import os
import uuid
import logging
import shutil
from datetime import datetime, timedelta, date
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from sqlalchemy.exc import IntegrityError
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

from backend.database.models import (
    Base, User, Family, FamilyMember, Person, Relationship, Memory, MemoryPhoto,
    ApiKey, Trip, TripPerson, TripMemory, VaultItem,
    MemberRole, RelationshipTag,
    UserCreate, UserLogin, UserResponse, LoginResponse, FamilyCreate, FamilyResponse,
    PersonCreate, PersonResponse, PersonDetailResponse,
    RelationshipCreate, RelationshipResponse,
    MemoryCreate, MemoryResponse, SearchQuery, UploadResponse,
)
from backend.database.config import engine, SessionLocal, get_db, init_db
from backend.utils import encrypt_api_key, decrypt_api_key, mask_api_key, get_user_llm_client
from backend.rag.vector_store import hybrid_query, get_embedding, embedding_to_storage
from backend.graph.algorithms import shortest_path, detect_communities, centrality_ranking, build_adjacency_list
from backend.scheduling.sm2 import sm2_update, get_due_memories, get_today_memories_for_user, DEFAULT_INTERVAL_DAYS

from backend.agent import build_agent_response, build_llm_agent_response, tool_get_neglected_connections

import json
from starlette.responses import StreamingResponse

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ─── Security ─────────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Memoir API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[orig.strip() for orig in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ─── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("Database initialized")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password.encode("utf-8")[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain.encode("utf-8")[:72], hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def save_upload(file: UploadFile) -> str:
    """Save uploaded file to UPLOAD_DIR and return the URL path."""
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else ""
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"/uploads/{filename}"


def serialize_memory(memory: Memory, db: Session) -> dict:
    """Serialize a memory object with photos and contributor info."""
    photos = db.query(MemoryPhoto).filter(MemoryPhoto.memory_id == memory.id).order_by(MemoryPhoto.display_order).all()
    contributor = db.query(User).filter(User.id == memory.created_by_user_id).first()
    person = db.query(Person).filter(Person.id == memory.person_id).first()
    return {
        "id": str(memory.id),
        "person_id": str(memory.person_id),
        "family_id": str(memory.family_id),
        "title": memory.title,
        "story_text": memory.story_text,
        "memory_date": memory.memory_date.isoformat() if memory.memory_date else None,
        "voice_note_url": memory.voice_note_url,
        "created_by_user_id": str(memory.created_by_user_id),
        "created_at": memory.created_at.isoformat() if memory.created_at else None,
        "photos": [{"id": str(p.id), "photo_url": p.photo_url, "caption": p.caption, "display_order": p.display_order} for p in photos],
        "contributor": {"name": contributor.name, "avatar_url": contributor.avatar_url} if contributor else None,
        "person_name": person.name if person else None,
    }


def serialize_person(person: Person, db: Session) -> dict:
    """Serialize a person with memory count."""
    memory_count = db.query(Memory).filter(Memory.person_id == person.id).count()
    return {
        "id": str(person.id),
        "family_id": str(person.family_id),
        "name": person.name,
        "relationship_tag": person.relationship_tag.value if person.relationship_tag else None,
        "photo_url": person.photo_url,
        "dob": person.dob.isoformat() if person.dob else None,
        "bio": person.bio,
        "created_by": str(person.created_by),
        "created_at": person.created_at.isoformat() if person.created_at else None,
        "memory_count": memory_count,
    }


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.post("/auth/signup", response_model=LoginResponse)
async def signup(data: UserCreate, db: Session = Depends(get_db)):
    logger.info(f"Signup attempt: {data.email}")
    
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    try:
        user = User(
            id=uuid.uuid4(),
            email=data.email,
            password_hash=hash_password(data.password),
            name=data.name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        token = create_access_token({"user_id": str(user.id), "sub": user.email})
        
        return LoginResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse(id=str(user.id), name=user.name, email=user.email, avatar_url=user.avatar_url)
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Signup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")


@app.post("/auth/login", response_model=LoginResponse)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    logger.info(f"Login attempt: {data.email}")
    
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"user_id": str(user.id), "sub": user.email})
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=str(user.id), name=user.name, email=user.email, avatar_url=user.avatar_url)
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=str(current_user.id), name=current_user.name, email=current_user.email, avatar_url=current_user.avatar_url)


# ─── Family Routes ────────────────────────────────────────────────────────────

@app.post("/family", response_model=FamilyResponse)
async def create_family(data: FamilyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    family = Family(
        id=uuid.uuid4(),
        name=data.name,
        created_by=current_user.id,
    )
    db.add(family)
    db.flush()
    
    member = FamilyMember(
        id=uuid.uuid4(),
        user_id=current_user.id,
        family_id=family.id,
        role=MemberRole.admin,
    )
    db.add(member)
    db.commit()
    db.refresh(family)
    
    return _serialize_family(family, db)


def _serialize_family(family, db):
    return {
        "id": str(family.id),
        "name": family.name,
        "cover_photo_url": family.cover_photo_url,
        "created_by": str(family.created_by),
        "created_at": family.created_at.isoformat() if family.created_at else None,
    }


@app.get("/family/{family_id}")
async def get_family(family_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    # Check membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    return _serialize_family(family, db)


@app.get("/user/families")
async def get_user_families(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(FamilyMember).filter(FamilyMember.user_id == current_user.id).all()
    families = []
    for m in memberships:
        family = db.query(Family).filter(Family.id == m.family_id).first()
        if family:
            families.append(_serialize_family(family, db))
    return families


# ─── People Routes ────────────────────────────────────────────────────────────

@app.get("/family/{family_id}/people")
async def get_people(family_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    people = db.query(Person).filter(Person.family_id == family_id).order_by(Person.created_at.desc()).all()
    return [serialize_person(p, db) for p in people]


@app.get("/family/{family_id}/my-diary")
async def get_or_create_my_diary(
    family_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    person = db.query(Person).filter(
        Person.family_id == family_id,
        Person.created_by == current_user.id,
        Person.is_personal_diary.is_(True),
    ).order_by(Person.created_at.asc()).first()
    if person is None:
        person = Person(
            id=uuid.uuid4(),
            family_id=family_id,
            name=current_user.name,
            created_by=current_user.id,
            is_personal_diary=True,
        )
        db.add(person)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            person = db.query(Person).filter(
                Person.family_id == family_id,
                Person.created_by == current_user.id,
                Person.is_personal_diary.is_(True),
            ).first()
            if person is None:
                raise
            return serialize_person(person, db)
        db.refresh(person)

    return serialize_person(person, db)


@app.post("/family/{family_id}/people")
async def create_person(
    family_id: str,
    name: str = Form(...),
    relationship_tag: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    # Parse relationship tag enum
    tag_enum = None
    if relationship_tag:
        try:
            tag_enum = RelationshipTag(relationship_tag)
        except ValueError:
            tag_enum = RelationshipTag.Other
    
    # Parse DOB
    dob_date = None
    if dob:
        try:
            dob_date = date.fromisoformat(dob)
        except ValueError:
            pass
    
    photo_url = None
    if photo:
        photo_url = save_upload(photo)
    
    person = Person(
        id=uuid.uuid4(),
        family_id=family_id,
        name=name,
        relationship_tag=tag_enum,
        photo_url=photo_url,
        dob=dob_date,
        bio=bio,
        created_by=current_user.id,
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    
    return serialize_person(person, db)


@app.get("/people/{person_id}")
async def get_person(person_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    memories = db.query(Memory).filter(Memory.person_id == person_id).order_by(Memory.memory_date.desc().nullslast(), Memory.created_at.desc()).all()
    
    result = serialize_person(person, db)
    result["memories"] = [serialize_memory(m, db) for m in memories]
    return result


@app.patch("/people/{person_id}")
async def update_person(
    person_id: str,
    name: Optional[str] = Form(None),
    relationship_tag: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    if name:
        person.name = name
    if relationship_tag:
        try:
            person.relationship_tag = RelationshipTag(relationship_tag)
        except ValueError:
            pass
    if dob:
        try:
            person.dob = date.fromisoformat(dob)
        except ValueError:
            pass
    if bio is not None:
        person.bio = bio
    if photo:
        person.photo_url = save_upload(photo)
    
    db.commit()
    db.refresh(person)
    return serialize_person(person, db)


# ─── Relationship Routes ──────────────────────────────────────────────────────

@app.post("/family/{family_id}/relationships")
async def create_relationship(
    family_id: str,
    data: RelationshipCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    # Verify both people exist in this family
    person_a = db.query(Person).filter(Person.id == data.person_a_id, Person.family_id == family_id).first()
    person_b = db.query(Person).filter(Person.id == data.person_b_id, Person.family_id == family_id).first()
    if not person_a or not person_b:
        raise HTTPException(status_code=404, detail="Person not found")
    
    existing = db.query(Relationship).filter(
        or_(
            (Relationship.person_a_id == data.person_a_id) & (Relationship.person_b_id == data.person_b_id),
            (Relationship.person_a_id == data.person_b_id) & (Relationship.person_b_id == data.person_a_id),
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Relationship already exists")
    
    rel = Relationship(
        id=uuid.uuid4(),
        family_id=family_id,
        person_a_id=data.person_a_id,
        person_b_id=data.person_b_id,
        label=data.label,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    
    return {
        "id": str(rel.id),
        "person_a": {"id": str(person_a.id), "name": person_a.name},
        "person_b": {"id": str(person_b.id), "name": person_b.name},
        "label": rel.label,
    }


@app.get("/family/{family_id}/relationships")
async def get_relationships(family_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    rels = db.query(Relationship).filter(Relationship.family_id == family_id).all()
    result = []
    for rel in rels:
        person_a = db.query(Person).filter(Person.id == rel.person_a_id).first()
        person_b = db.query(Person).filter(Person.id == rel.person_b_id).first()
        result.append({
            "id": str(rel.id),
            "person_a": {"id": str(person_a.id), "name": person_a.name} if person_a else {},
            "person_b": {"id": str(person_b.id), "name": person_b.name} if person_b else {},
            "label": rel.label,
        })
    return result


@app.delete("/relationships/{relationship_id}")
async def delete_relationship(relationship_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rel = db.query(Relationship).filter(Relationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == rel.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    db.delete(rel)
    db.commit()
    return {"message": "Relationship deleted"}


# ─── Memory Routes ────────────────────────────────────────────────────────────

@app.post("/people/{person_id}/memories")
async def create_memory(
    person_id: str,
    title: str = Form(...),
    story_text: Optional[str] = Form(None),
    memory_date: Optional[str] = Form(None),
    photos: List[UploadFile] = File(default=[]),
    voice_note: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    # Parse date
    mem_date = None
    if memory_date:
        try:
            mem_date = date.fromisoformat(memory_date)
        except ValueError:
            pass
    
    # Save voice note
    voice_note_url = None
    if voice_note and voice_note.filename:
        voice_note_url = save_upload(voice_note)
    
    # Generate embedding for semantic search (best-effort — None if the
    # embedding model isn't installed, search falls back to keyword-only)
    embedding_text = f"{title} {story_text or ''}"
    embedding_value = embedding_to_storage(get_embedding(embedding_text))

    memory = Memory(
        id=uuid.uuid4(),
        person_id=person_id,
        family_id=person.family_id,
        title=title,
        story_text=story_text,
        memory_date=mem_date,
        voice_note_url=voice_note_url,
        created_by_user_id=current_user.id,
        embedding=embedding_value,
        # SM-2 spaced repetition: due for its first resurfacing tomorrow
        next_review_at=datetime.utcnow() + timedelta(days=DEFAULT_INTERVAL_DAYS),
    )
    db.add(memory)
    db.flush()
    
    # Save photos
    for i, photo in enumerate(photos):
        if photo.filename:
            photo_url = save_upload(photo)
            mp = MemoryPhoto(
                id=uuid.uuid4(),
                memory_id=memory.id,
                photo_url=photo_url,
                display_order=i,
            )
            db.add(mp)
    
    db.commit()
    db.refresh(memory)
    
    return serialize_memory(memory, db)


@app.get("/people/{person_id}/memories")
async def get_person_memories(person_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    memories = db.query(Memory).filter(Memory.person_id == person_id).order_by(Memory.memory_date.desc().nullslast(), Memory.created_at.desc()).all()
    return [serialize_memory(m, db) for m in memories]


@app.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    # Only creator or family admin can delete
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == memory.family_id, FamilyMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    if memory.created_by_user_id != current_user.id and member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Only the creator or family admin can delete")
    
    db.delete(memory)
    db.commit()
    return {"message": "Memory deleted"}


@app.patch("/memories/{memory_id}")
async def update_memory(
    memory_id: str,
    title: str = Form(...),
    story_text: Optional[str] = Form(None),
    memory_date: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == memory.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    if memory.created_by_user_id != current_user.id and member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Only the creator or family admin can edit")

    memory.title = title.strip()
    memory.story_text = story_text
    if memory_date is not None:
        try:
            memory.memory_date = date.fromisoformat(memory_date) if memory_date.strip() else None
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid memory date") from exc

    db.commit()
    db.refresh(memory)
    return serialize_memory(memory, db)


# ─── Search Route ─────────────────────────────────────────────────────────────

@app.post("/family/{family_id}/search")
async def search_family(family_id: str, data: SearchQuery, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    hits = hybrid_query(family_id=family_id, query_text=data.query, db=db, mode="hybrid", limit=20)

    return [
        {
            "memory": {
                "id": h["id"],
                "title": h["title"],
                "story_text": h["story_text"],
                "memory_date": h["memory_date"],
                "person_id": h.get("person_id"),
            },
            "person_name": h["person_name"],
            "score": h["score"],
        }
        for h in hits
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# Life Assistant: On This Day, Resurfacing, Neglected Connections
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/family/{family_id}/on-this-day")
async def on_this_day(family_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Memories from this same month/day in previous years.

    Pure calendar-date lookup — not the SM-2 scheduler (see /home/resurface).
    O(n) over the family's dated memories; fine at personal scale.
    """
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    today = date.today()
    results = []

    memories = db.query(Memory).filter(Memory.family_id == family_id, Memory.memory_date.isnot(None)).all()
    for mem in memories:
        d = mem.memory_date
        if d.month == today.month and d.day == today.day and d.year < today.year:
            person = db.query(Person).filter(Person.id == mem.person_id).first()
            results.append({
                "type": "memory",
                "id": str(mem.id),
                "title": mem.title,
                "story_text": mem.story_text,
                "date": d.isoformat(),
                "years_ago": today.year - d.year,
                "person_id": str(mem.person_id),
                "person_name": person.name if person else "Unknown",
            })

    results.sort(key=lambda r: r["years_ago"])
    return {"today": today.isoformat(), "results": results}


@app.get("/home/resurface")
async def resurface_memories(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Memories the SM-2 scheduler has due for review today (or, if none are
    due yet, a small set the user hasn't seen recently). See sm2.py."""
    return {"memories": get_today_memories_for_user(str(current_user.id), db, limit=5)}


@app.post("/memories/{memory_id}/review")
async def review_memory(
    memory_id: str,
    quality: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a resurfacing review and reschedule via SM-2.

    quality: 0-5 (0-2 = "let it fade", 3-5 = "still meaningful"). See sm2.py.
    """
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == memory.family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    update = sm2_update(quality, memory.interval_days or DEFAULT_INTERVAL_DAYS, memory.ease_factor or 2.5)
    memory.interval_days = update["interval_days"]
    memory.ease_factor = update["ease_factor"]
    memory.next_review_at = datetime.fromisoformat(update["next_review_at"])
    memory.last_shown_at = datetime.utcnow()
    db.commit()

    return {
        "id": str(memory.id),
        "interval_days": memory.interval_days,
        "ease_factor": memory.ease_factor,
        "next_review_at": memory.next_review_at.isoformat(),
    }


@app.get("/family/{family_id}/neglected")
async def neglected_connections(
    family_id: str,
    threshold_days: int = Query(90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Family members nobody has written a memory for in a while."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    return {"neglected": tool_get_neglected_connections(db, family_id, threshold_days)}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 0: API Key Management
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/home/settings/api-key")
async def set_api_key(
    provider: str = Form(...),
    key: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Store an encrypted API key for the user.
    Only ENCRYPTION_SECRET lives in .env; user provider keys are encrypted at rest.
    """
    if provider not in ("anthropic", "groq", "openai"):
        raise HTTPException(status_code=400, detail="Unsupported provider. Use: anthropic, groq, or openai")
    if not key.strip():
        raise HTTPException(status_code=400, detail="Key cannot be empty")

    encrypted = encrypt_api_key(key.strip())

    existing = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.provider == provider,
    ).first()

    if existing:
        existing.encrypted_key = encrypted
    else:
        new_key = ApiKey(
            id=uuid.uuid4(),
            user_id=current_user.id,
            provider=provider,
            encrypted_key=encrypted,
        )
        db.add(new_key)

    db.commit()
    return {"message": f"{provider} API key saved", "provider": provider}


@app.get("/home/settings/api-key")
async def get_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return providers + masked keys (never the full key)."""
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    return [
        {
            "provider": k.provider,
            "masked_key": mask_api_key(decrypt_api_key(k.encrypted_key)),
            "created_at": k.created_at.isoformat() if k.created_at else None,
        }
        for k in keys
    ]


@app.delete("/home/settings/api-key")
async def delete_api_key(
    provider: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a stored API key for a given provider."""
    key = db.query(ApiKey).filter(
        ApiKey.user_id == current_user.id,
        ApiKey.provider == provider,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail=f"No {provider} key found")
    db.delete(key)
    db.commit()
    return {"message": f"{provider} API key removed"}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: Hybrid Search (RAG)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/home/rag/query")
async def rag_query(
    query: str = Form(...),
    family_id: str = Form(...),
    mode: str = Form("hybrid"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Hybrid search combining semantic + keyword search with weighted re-rank.
    Mode: semantic | keyword | hybrid (default).
    """
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    if mode not in ("semantic", "keyword", "hybrid"):
        raise HTTPException(status_code=400, detail="Mode must be: semantic, keyword, or hybrid")

    results = hybrid_query(
        family_id=family_id,
        query_text=query,
        db=db,
        mode=mode,
        user_id=str(current_user.id),
    )

    return {"results": results, "mode": mode, "count": len(results)}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: Graph Algorithms
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/graph/path")
async def graph_shortest_path(
    from_id: str = Query(..., alias="from"),
    to_id: str = Query(..., alias="to"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """BFS shortest path between two people. O(V + E)."""
    person_a = db.query(Person).filter(Person.id == from_id).first()
    person_b = db.query(Person).filter(Person.id == to_id).first()
    if not person_a or not person_b:
        raise HTTPException(status_code=404, detail="Person not found")

    # Verify membership in same family
    if person_a.family_id != person_b.family_id:
        raise HTTPException(status_code=400, detail="People are in different families")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person_a.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    family_id = person_a.family_id
    people = db.query(Person).filter(Person.family_id == family_id).all()
    rels = db.query(Relationship).filter(Relationship.family_id == family_id).all()

    people_map = {str(p.id): p.name for p in people}
    rel_list = [{
        "person_a": {"id": str(r.person_a_id)},
        "person_b": {"id": str(r.person_b_id)},
        "label": r.label,
    } for r in rels]
    adj = build_adjacency_list(
        [{"id": str(p.id), "name": p.name} for p in people],
        rel_list,
    )

    result = shortest_path(from_id, to_id, adj, people_map)
    if result is None:
        return {"path": None, "degree": None, "message": "No path found between these people"}
    return result


@app.get("/graph/communities")
async def graph_communities(
    family_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detect communities (connected components) in the family graph. O(E α(V))."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    people = db.query(Person).filter(Person.family_id == family_id).all()
    rels = db.query(Relationship).filter(Relationship.family_id == family_id).all()

    people_map = {str(p.id): p.name for p in people}
    rel_list = [{
        "person_a": {"id": str(r.person_a_id)},
        "person_b": {"id": str(r.person_b_id)},
        "label": r.label,
    } for r in rels]
    adj = build_adjacency_list(
        [{"id": str(p.id), "name": p.name} for p in people],
        rel_list,
    )

    communities = detect_communities(adj, people_map)
    return {"communities": communities, "count": len(communities)}


@app.get("/graph/centrality")
async def graph_centrality(
    family_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rank people by degree centrality. O(V)."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    people = db.query(Person).filter(Person.family_id == family_id).all()
    rels = db.query(Relationship).filter(Relationship.family_id == family_id).all()

    people_map = {str(p.id): p.name for p in people}
    rel_list = [{
        "person_a": {"id": str(r.person_a_id)},
        "person_b": {"id": str(r.person_b_id)},
        "label": r.label,
    } for r in rels]
    adj = build_adjacency_list(
        [{"id": str(p.id), "name": p.name} for p in people],
        rel_list,
    )

    rankings = centrality_ranking(adj, people_map)
    return {"rankings": rankings}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: Background Jobs
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/home/jobs/{job_id}")
async def get_job_status_endpoint(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Poll job status from Redis. O(1)."""
    from backend.jobs import get_job_status as _job_status
    status = _job_status(job_id)
    return status


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: Memory Timeline / Date Range
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/home/person/{person_id}/memories/range")
async def get_memories_in_range(
    person_id: str,
    start: str = Query(None),
    end: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get memories for a person filtered by date range.
    Uses Postgres range types for efficient querying when available,
    with simple comparison fallback.
    Complexity: O(log n) with B-tree index on memory_date.
    """
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == person.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    query = db.query(Memory).filter(Memory.person_id == person_id)

    if start:
        try:
            start_date = date.fromisoformat(start)
            query = query.filter(Memory.memory_date >= start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD")

    if end:
        try:
            end_date = date.fromisoformat(end)
            query = query.filter(Memory.memory_date <= end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD")

    memories = query.order_by(Memory.memory_date.desc().nullslast(), Memory.created_at.desc()).all()
    return {"memories": [serialize_memory(m, db) for m in memories], "count": len(memories)}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: Memory Resurfacing (SM-2)
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/home/resurface/today")
async def get_resurfacing_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get memories due for review today (SM-2 spaced repetition).
    Returns both scheduled memories and 'On This Day' fallback.
    """
    memories = get_today_memories_for_user(str(current_user.id), db)
    return {"memories": memories, "count": len(memories)}


@app.post("/home/resurface/{memory_id}/review")
async def review_resurfaced_memory(
    memory_id: str,
    quality: int = Form(...),  # 0-5 SM-2 quality rating
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an SM-2 review quality rating for a resurfaced memory.
    Quality: 0-2 = 'let it fade' (fail), 3-5 = 'still meaningful' (pass).
    """
    if quality < 0 or quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")

    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Apply SM-2 update
    result = sm2_update(quality, memory.interval_days, memory.ease_factor)

    memory.last_shown_at = datetime.utcnow()
    memory.interval_days = result["interval_days"]
    memory.ease_factor = result["ease_factor"]
    memory.next_review_at = datetime.fromisoformat(result["next_review_at"].replace("Z", ""))

    db.commit()
    return {
        "message": "Review recorded",
        "quality": quality,
        "new_interval_days": result["interval_days"],
        "new_ease_factor": result["ease_factor"],
        "next_review_at": result["next_review_at"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6: Trips
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/home/trip")
async def create_trip(
    name: str = Form(...),
    family_id: str = Form(...),
    location: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new trip."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    trip = Trip(
        id=uuid.uuid4(),
        family_id=family_id,
        name=name,
        location=location,
        start_date=date.fromisoformat(start_date) if start_date else None,
        end_date=date.fromisoformat(end_date) if end_date else None,
        notes=notes,
        created_by=current_user.id,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {
        "id": str(trip.id),
        "name": trip.name,
        "location": trip.location,
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
        "notes": trip.notes,
    }


@app.get("/home/trips")
async def get_trips(
    family_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all trips for a family."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    trips = db.query(Trip).filter(Trip.family_id == family_id).order_by(Trip.created_at.desc()).all()
    results = []
    for t in trips:
        person_count = db.query(TripPerson).filter(TripPerson.trip_id == t.id).count()
        memory_count = db.query(TripMemory).filter(TripMemory.trip_id == t.id).count()
        results.append({
            "id": str(t.id),
            "name": t.name,
            "location": t.location,
            "start_date": t.start_date.isoformat() if t.start_date else None,
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "notes": t.notes,
            "person_count": person_count,
            "memory_count": memory_count,
        })
    return {"trips": results}


@app.get("/home/trip/{trip_id}")
async def get_trip_detail(
    trip_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get trip details with associated people and memories."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == trip.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    people = []
    for tp in db.query(TripPerson).filter(TripPerson.trip_id == trip_id).all():
        p = db.query(Person).filter(Person.id == tp.person_id).first()
        if p:
            people.append({"id": str(p.id), "name": p.name})

    memories = []
    for tm in db.query(TripMemory).filter(TripMemory.trip_id == trip_id).all():
        m = db.query(Memory).filter(Memory.id == tm.memory_id).first()
        if m:
            memories.append({"id": str(m.id), "title": m.title})

    return {
        "id": str(trip.id),
        "name": trip.name,
        "location": trip.location,
        "start_date": trip.start_date.isoformat() if trip.start_date else None,
        "end_date": trip.end_date.isoformat() if trip.end_date else None,
        "notes": trip.notes,
        "people": people,
        "memories": memories,
    }


@app.post("/home/trip/{trip_id}/person")
async def add_person_to_trip(
    trip_id: str,
    person_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a person to a trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == trip.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    existing = db.query(TripPerson).filter(
        TripPerson.trip_id == trip_id,
        TripPerson.person_id == person_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Person already added to this trip")

    tp = TripPerson(id=uuid.uuid4(), trip_id=trip_id, person_id=person_id)
    db.add(tp)
    db.commit()
    return {"message": "Person added to trip"}


@app.post("/home/trip/{trip_id}/memory")
async def add_memory_to_trip(
    trip_id: str,
    memory_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Associate a memory with a trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == trip.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    existing = db.query(TripMemory).filter(
        TripMemory.trip_id == trip_id,
        TripMemory.memory_id == memory_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Memory already on this trip")

    tm = TripMemory(id=uuid.uuid4(), trip_id=trip_id, memory_id=memory_id)
    db.add(tm)
    db.commit()
    return {"message": "Memory added to trip"}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6b: Conversational Assistant (SSE Chat)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/home/assistant/chat")
async def assistant_chat(
    message: str = Form(...),
    family_id: str = Form(...),
    conversation_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Conversational memory assistant endpoint.

    Processes a user message through tool-calling and returns a streamed response.
    Maintains a short history in Redis per conversation_id (not full persistence).

    Returns SSE stream with:
      - data: {"type": "token", "content": "..."} — streamed tokens
      - data: {"type": "suggestions", "content": [...]} — suggestion chips
      - data: {"type": "done"} — end of stream
    """
    # Verify membership
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    # Prefer a real LLM tool-calling agent when the user has a key configured;
    # otherwise fall back to the keyword-routed agent (needs no API key).
    api_key_record = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).first()

    if api_key_record:
        try:
            decrypted_key = decrypt_api_key(api_key_record.encrypted_key)
            llm_client = get_user_llm_client(str(current_user.id), api_key_record.provider, decrypted_key)
            agent_result = build_llm_agent_response(
                user_message=message,
                user_id=str(current_user.id),
                family_id=family_id,
                db=db,
                provider=api_key_record.provider,
                client=llm_client,
            )
        except Exception as e:
            logger.error(f"LLM client setup failed, falling back to keyword router: {e}")
            agent_result = build_agent_response(
                user_message=message, user_id=str(current_user.id), family_id=family_id, db=db,
            )
    else:
        agent_result = build_agent_response(
            user_message=message, user_id=str(current_user.id), family_id=family_id, db=db,
        )

    async def event_stream():
        response_text = agent_result.get("response", "I couldn't process that request.")

        # Stream the response token by token
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

        # Send suggestions
        suggestions = agent_result.get("suggestions", [
            "Who have I been neglecting?",
            "Plan something for Mom",
            "What memories are due for review?",
            "Tell me about our trips",
        ])
        yield f"data: {json.dumps({'type': 'suggestions', 'content': suggestions})}\n\n"

        # Done
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Family Vault
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/vault/upload")
async def vault_upload(
    family_id: str = Form(...),
    name: str = Form(...),
    folder: str = Form("All"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a file to the family vault."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    file_url = save_upload(file)
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else ""
    img_types = {"jpg", "jpeg", "png", "gif", "webp"}
    doc_types = {"pdf", "doc", "docx", "txt"}
    vid_types = {"mp4", "mov", "avi", "webm"}
    if ext in img_types:
        file_type = "image"
    elif ext in doc_types:
        file_type = "document"
    elif ext in vid_types:
        file_type = "video"
    else:
        file_type = "other"

    item = VaultItem(
        id=uuid.uuid4(),
        family_id=family_id,
        name=name,
        file_url=file_url,
        file_type=file_type,
        file_size=0,
        folder=folder,
        uploaded_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": str(item.id),
        "name": item.name,
        "file_url": item.file_url,
        "file_type": item.file_type,
        "folder": item.folder,
    }


@app.get("/vault")
async def get_vault(
    family_id: str = Query(...),
    folder: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List vault items, optionally filtered by folder or type."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    query = db.query(VaultItem).filter(VaultItem.family_id == family_id)
    if folder and folder != "All":
        query = query.filter(VaultItem.folder == folder)
    if file_type:
        query = query.filter(VaultItem.file_type == file_type)

    items = query.order_by(VaultItem.created_at.desc()).all()
    folders = db.query(VaultItem.folder).filter(VaultItem.family_id == family_id).distinct().all()
    folder_list = ["All"] + [f[0] for f in folders if f[0] != "All"]

    result = []
    for item in items:
        uploader = db.query(User).filter(User.id == item.uploaded_by).first()
        result.append({
            "id": str(item.id),
            "name": item.name,
            "file_url": item.file_url,
            "file_type": item.file_type,
            "file_size": item.file_size,
            "folder": item.folder,
            "uploaded_by": uploader.name if uploader else "Unknown",
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "is_admin": member.role == MemberRole.admin,
        })

    return {"items": result, "folders": folder_list}


@app.delete("/vault/{item_id}")
async def delete_vault_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a vault item (admin only)."""
    item = db.query(VaultItem).filter(VaultItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == item.family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member or member.role != MemberRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# Calendar — read-only month view over existing data
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/family/{family_id}/calendar")
async def get_calendar_month(
    family_id: str,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Memories, birthdays, and trips for one calendar month.

    Pure read-over-existing-data — no new model, everything is derived from
    tables the app already has. Days are returned as 'YYYY-MM-DD' keys.
    """
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    from backend.database.models import Trip
    import calendar as _cal

    days_in_month = _cal.monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, days_in_month)

    days: dict = {}

    def add(day: date, item: dict):
        key = day.isoformat()
        days.setdefault(key, []).append(item)

    # Memories (person letters)
    memories = db.query(Memory).filter(
        Memory.family_id == family_id, Memory.memory_date.isnot(None)
    ).all()
    for mem in memories:
        if month_start <= mem.memory_date <= month_end:
            person = db.query(Person).filter(Person.id == mem.person_id).first()
            add(mem.memory_date, {
                "type": "memory",
                "id": str(mem.id),
                "title": mem.title,
                "by": person.name if person else "Unknown",
                "person_id": str(mem.person_id),
            })

    # Birthdays (recurring — projected onto this month/year)
    people = db.query(Person).filter(Person.family_id == family_id, Person.dob.isnot(None)).all()
    for p in people:
        try:
            occurrence = date(year, p.dob.month, p.dob.day)
        except ValueError:
            continue  # e.g. Feb 29 in a non-leap year
        if month_start <= occurrence <= month_end:
            add(occurrence, {
                "type": "birthday",
                "id": str(p.id),
                "title": f"{p.name}'s birthday",
                "person_id": str(p.id),
            })

    # Trips (any day the trip spans that falls within this month)
    trips = db.query(Trip).filter(Trip.family_id == family_id).all()
    for trip in trips:
        if not trip.start_date:
            continue
        span_end = trip.end_date or trip.start_date
        d = max(trip.start_date, month_start)
        last = min(span_end, month_end)
        while d <= last:
            add(d, {"type": "trip", "id": str(trip.id), "title": trip.name})
            d += timedelta(days=1)

    return {"year": year, "month": month, "days": days}


# ─── File Upload Route ────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    url = save_upload(file)
    return {"url": url}


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    from backend.rag.vector_store import _get_model
    return {"status": "ok", "semantic_search": _get_model() is not None}
