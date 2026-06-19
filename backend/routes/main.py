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
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

from backend.database.models import (
    Base, User, Family, FamilyMember, Person, Relationship, Memory, MemoryPhoto,
    ApiKey, Trip, TripPerson, TripMemory,
    MemberRole, RelationshipTag,
    UserCreate, UserLogin, UserResponse, LoginResponse, FamilyCreate, FamilyResponse,
    PersonCreate, PersonResponse, PersonDetailResponse,
    RelationshipCreate, RelationshipResponse,
    MemoryCreate, MemoryResponse, SearchQuery, UploadResponse,
)
from backend.database.config import engine, SessionLocal, get_db, check_pgvector, init_db, PGVECTOR_AVAILABLE
from backend.utils import encrypt_api_key, decrypt_api_key, mask_api_key, get_user_llm_client
from backend.rag.vector_store import hybrid_query
from backend.graph.algorithms import shortest_path, detect_communities, centrality_ranking, build_adjacency_list
from backend.scheduling.sm2 import sm2_update, get_due_memories, get_today_memories_for_user

from backend.agent import build_agent_response

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


def get_embedding(text: str) -> Optional[list]:
    """Generate embedding for text using sentence-transformers. Returns None if unavailable."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        return model.encode(text).tolist()
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return None


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
    members = db.query(FamilyMember).filter(FamilyMember.family_id == family.id).all()
    member_list = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            member_list.append({
                "id": str(m.id),
                "name": user.name,
                "avatar_url": user.avatar_url,
                "role": m.role.value,
            })
    
    return {
        "id": str(family.id),
        "name": family.name,
        "cover_photo_url": family.cover_photo_url,
        "invite_token": str(family.invite_token),
        "created_by": str(family.created_by),
        "created_at": family.created_at.isoformat() if family.created_at else None,
        "members": member_list,
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


@app.get("/family/{family_id}/invite-link")
async def get_invite_link(family_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    return {"invite_url": f"http://localhost:5173/join/{family.invite_token}"}


@app.post("/family/join/{invite_token}")
async def join_family(invite_token: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    family = db.query(Family).filter(Family.invite_token == invite_token).first()
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite token")
    
    existing = db.query(FamilyMember).filter(
        FamilyMember.family_id == family.id, FamilyMember.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member of this family")
    
    member = FamilyMember(
        id=uuid.uuid4(),
        user_id=current_user.id,
        family_id=family.id,
        role=MemberRole.member,
    )
    db.add(member)
    db.commit()
    
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
    
    # Generate embedding
    embedding_text = f"{title} {story_text or ''}"
    embedding = get_embedding(embedding_text)
    # Store as JSON string if pgvector is not available (PGVECTOR_AVAILABLE is imported from config at top of file)
    embedding_value = embedding if PGVECTOR_AVAILABLE else (str(embedding) if embedding else None)
    
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


@app.get("/memories/{memory_id}/public")
async def get_public_memory(memory_id: str, db: Session = Depends(get_db)):
    """No auth required - for sharing."""
    memory = db.query(Memory).filter(Memory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    
    person = db.query(Person).filter(Person.id == memory.person_id).first()
    family = db.query(Family).filter(Family.id == memory.family_id).first()
    
    result = serialize_memory(memory, db)
    result["family_name"] = family.name if family else None
    result["person_name"] = person.name if person else None
    return result


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


# ─── Search Route ─────────────────────────────────────────────────────────────

@app.post("/family/{family_id}/search")
async def search_family(family_id: str, data: SearchQuery, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id, FamilyMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")
    
    query_text = data.query
    results = []
    
    # Try pgvector semantic search first
    pgvector_ok = PGVECTOR_AVAILABLE and check_pgvector()
    
    if pgvector_ok:
        try:
            embedding = get_embedding(query_text)
            if embedding:
                embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                sql = text("""
                    SELECT m.id, m.title, m.story_text, m.memory_date, p.name as person_name,
                           1 - (m.embedding <=> :embedding) as score
                    FROM memories m
                    JOIN people p ON p.id = m.person_id
                    WHERE m.family_id = :family_id AND m.embedding IS NOT NULL
                    ORDER BY m.embedding <=> :embedding
                    LIMIT 20
                """)
                rows = db.execute(sql, {"embedding": embedding_str, "family_id": family_id}).fetchall()
                for row in rows:
                    results.append({
                        "memory": {
                            "id": str(row[0]),
                            "title": row[1],
                            "story_text": row[2],
                            "memory_date": row[3].isoformat() if row[3] else None,
                        },
                        "person_name": row[4],
                        "score": float(row[5]) if row[5] else 0,
                    })
        except Exception as e:
            logger.warning(f"Vector search failed, falling back to ILIKE: {e}")
            pgvector_ok = False
    
    # Fallback: ILIKE search
    if not pgvector_ok:
        memories = db.query(Memory).filter(
            Memory.family_id == family_id,
            or_(
                Memory.title.ilike(f"%{query_text}%"),
                Memory.story_text.ilike(f"%{query_text}%"),
            )
        ).order_by(Memory.memory_date.desc().nullslast()).limit(20).all()
        
        for memory in memories:
            person = db.query(Person).filter(Person.id == memory.person_id).first()
            results.append({
                "memory": {
                    "id": str(memory.id),
                    "title": memory.title,
                    "story_text": memory.story_text,
                    "memory_date": memory.memory_date.isoformat() if memory.memory_date else None,
                },
                "person_name": person.name if person else "Unknown",
                "score": 0.5,
            })
    
    return results


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

    # Check if user has an API key for LLM calls
    api_key_record = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).first()

    agent_result = build_agent_response(
        user_message=message,
        user_id=str(current_user.id),
        family_id=family_id,
        db=db,
    )

    async def event_stream():
        response_text = agent_result.get("response", "I couldn't process that request.")

        # Check if user needs to add an API key for LLM-powered features
        if not api_key_record and any(
            kw in message.lower()
            for kw in ["llm", "gpt", "claude", "ai", "summarize", "analyze"]
        ):
            response_text = (
                "Add your API key in Settings to use AI-powered features. "
                "You can still search memories and explore relationships!"
            )

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
# Instagram-style Feed & Posts
# ═══════════════════════════════════════════════════════════════════════════════

from backend.database.models import (
    Post, PostPhoto, PostLike, PostComment,
    Story, StoryView, VaultItem, Notification,
)


def serialize_post(post: Post, db: Session, current_user_id: str) -> dict:
    """Serialize a post with photos, likes, comments, and user info."""
    photos = db.query(PostPhoto).filter(PostPhoto.post_id == post.id).order_by(PostPhoto.display_order).all()
    likes = db.query(PostLike).filter(PostLike.post_id == post.id).count()
    comments_q = db.query(PostComment).filter(PostComment.post_id == post.id).order_by(PostComment.created_at.desc()).limit(2).all()
    total_comments = db.query(PostComment).filter(PostComment.post_id == post.id).count()
    user_liked = db.query(PostLike).filter(PostLike.post_id == post.id, PostLike.user_id == current_user_id).first() is not None
    user = db.query(User).filter(User.id == post.user_id).first()
    tagged_people = db.query(Person).filter(Person.id.in_(
        db.query(PostPhoto.photo_url).filter(PostPhoto.post_id == post.id)  # placeholder — tag via caption parse
    )).all() if False else []

    return {
        "id": str(post.id),
        "user_id": str(post.user_id),
        "family_id": str(post.family_id),
        "caption": post.caption,
        "location": post.location,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "photos": [{"id": str(p.id), "photo_url": p.photo_url, "caption": p.caption, "display_order": p.display_order} for p in photos],
        "user": {"id": str(user.id), "name": user.name, "avatar_url": user.avatar_url} if user else None,
        "likes_count": likes,
        "comments_count": total_comments,
        "user_has_liked": user_liked,
        "recent_comments": [{
            "id": str(c.id),
            "user_id": str(c.user_id),
            "user_name": db.query(User).filter(User.id == c.user_id).first().name if db.query(User).filter(User.id == c.user_id).first() else "Unknown",
            "text": c.text,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        } for c in reversed(comments_q)],
    }


@app.post("/posts")
async def create_post(
    family_id: str = Form(...),
    caption: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    photos: List[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new post with optional photos."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    post = Post(
        id=uuid.uuid4(),
        user_id=current_user.id,
        family_id=family_id,
        caption=caption,
        location=location,
    )
    db.add(post)
    db.flush()

    for i, photo in enumerate(photos):
        if photo.filename:
            photo_url = save_upload(photo)
            pp = PostPhoto(
                id=uuid.uuid4(),
                post_id=post.id,
                photo_url=photo_url,
                display_order=i,
            )
            db.add(pp)

    db.commit()
    db.refresh(post)
    return serialize_post(post, db, str(current_user.id))


@app.get("/feed")
async def get_feed(
    family_id: str = Query(...),
    cursor: Optional[str] = Query(None),
    limit: int = Query(10, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cursor-based paginated feed."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    query = db.query(Post).filter(Post.family_id == family_id)
    if cursor:
        try:
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.filter(Post.created_at < cursor_dt)
        except ValueError:
            pass

    posts = query.order_by(Post.created_at.desc()).limit(limit + 1).all()
    has_more = len(posts) > limit
    if has_more:
        posts = posts[:limit]

    return {
        "posts": [serialize_post(p, db, str(current_user.id)) for p in posts],
        "next_cursor": posts[-1].created_at.isoformat() if has_more and posts else None,
        "has_more": has_more,
    }


@app.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Like or unlike a post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False, "likes_count": db.query(PostLike).filter(PostLike.post_id == post_id).count()}
    else:
        like = PostLike(id=uuid.uuid4(), post_id=post_id, user_id=current_user.id)
        db.add(like)
        db.commit()
        # Create notification
        if str(post.user_id) != str(current_user.id):
            notif = Notification(
                id=uuid.uuid4(),
                user_id=post.user_id,
                type="like",
                payload='{"post_id": "' + post_id + '"}',
                post_id=post_id,
                from_user_id=current_user.id,
            )
            db.add(notif)
            db.commit()
        return {"liked": True, "likes_count": db.query(PostLike).filter(PostLike.post_id == post_id).count()}


@app.post("/posts/{post_id}/comment")
async def add_comment(
    post_id: str,
    text: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a comment to a post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = PostComment(
        id=uuid.uuid4(),
        post_id=post_id,
        user_id=current_user.id,
        text=text,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Create notification
    if str(post.user_id) != str(current_user.id):
        notif = Notification(
            id=uuid.uuid4(),
            user_id=post.user_id,
            type="comment",
            payload='{"post_id": "' + post_id + '"}',
            post_id=post_id,
            from_user_id=current_user.id,
        )
        db.add(notif)
        db.commit()

    user = db.query(User).filter(User.id == current_user.id).first()
    return {
        "id": str(comment.id),
        "user_id": str(current_user.id),
        "user_name": user.name if user else "Unknown",
        "text": comment.text,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
    }


@app.get("/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all comments for a post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = db.query(PostComment).filter(PostComment.post_id == post_id).order_by(PostComment.created_at.asc()).all()
    result = []
    for c in comments:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": str(c.id),
            "user_id": str(c.user_id),
            "user_name": user.name if user else "Unknown",
            "avatar_url": user.avatar_url if user else None,
            "text": c.text,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Stories
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/stories")
async def create_story(
    family_id: str = Form(...),
    caption: Optional[str] = Form(None),
    media: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a 24hr story."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    media_url = save_upload(media)
    ext = media.filename.rsplit(".", 1)[-1].lower() if media.filename else ""
    media_type = "video" if ext in ("mp4", "mov", "avi", "webm") else "image"

    story = Story(
        id=uuid.uuid4(),
        user_id=current_user.id,
        family_id=family_id,
        media_url=media_url,
        media_type=media_type,
        caption=caption,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(story)
    db.commit()
    db.refresh(story)

    return {
        "id": str(story.id),
        "media_url": story.media_url,
        "media_type": story.media_type,
        "caption": story.caption,
        "expires_at": story.expires_at.isoformat(),
    }


@app.get("/stories")
async def get_active_stories(
    family_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get active (non-expired) stories for a family."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    now = datetime.utcnow()
    stories = db.query(Story).filter(
        Story.family_id == family_id,
        Story.expires_at > now,
    ).order_by(Story.created_at.desc()).all()

    # Group by user
    users_map = {}
    for story in stories:
        uid = str(story.user_id)
        if uid not in users_map:
            user = db.query(User).filter(User.id == story.user_id).first()
            users_map[uid] = {
                "user_id": uid,
                "user_name": user.name if user else "Unknown",
                "avatar_url": user.avatar_url,
                "stories": [],
            }
        has_viewed = db.query(StoryView).filter(
            StoryView.story_id == story.id,
            StoryView.viewer_id == current_user.id,
        ).first() is not None
        view_count = db.query(StoryView).filter(StoryView.story_id == story.id).count()
        users_map[uid]["stories"].append({
            "id": str(story.id),
            "media_url": story.media_url,
            "media_type": story.media_type,
            "caption": story.caption,
            "created_at": story.created_at.isoformat() if story.created_at else None,
            "expires_at": story.expires_at.isoformat() if story.expires_at else None,
            "has_viewed": has_viewed,
            "view_count": view_count,
        })

    return list(users_map.values())


@app.post("/stories/{story_id}/view")
async def view_story(
    story_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a story as viewed."""
    existing = db.query(StoryView).filter(
        StoryView.story_id == story_id,
        StoryView.viewer_id == current_user.id,
    ).first()
    if not existing:
        view = StoryView(id=uuid.uuid4(), story_id=story_id, viewer_id=current_user.id)
        db.add(view)
        db.commit()
    return {"viewed": True}


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
# Notifications
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all notifications for the current user."""
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id,
    ).order_by(Notification.created_at.desc()).limit(50).all()

    result = []
    for n in notifs:
        from_user = db.query(User).filter(User.id == n.from_user_id).first() if n.from_user_id else None
        result.append({
            "id": str(n.id),
            "type": n.type,
            "payload": n.payload,
            "post_id": str(n.post_id) if n.post_id else None,
            "from_user": {
                "id": str(from_user.id),
                "name": from_user.name,
                "avatar_url": from_user.avatar_url,
            } if from_user else None,
            "read": bool(n.read),
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })
    return result


@app.post("/notifications/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == 0,
    ).update({"read": 1})
    db.commit()
    return {"message": "All notifications marked as read"}


@app.get("/notifications/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get unread notification count."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == 0,
    ).count()
    return {"count": count}


# ═══════════════════════════════════════════════════════════════════════════════
# Birthdays
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/birthdays")
async def get_upcoming_birthdays(
    family_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get upcoming birthdays in the next 30 days."""
    member = db.query(FamilyMember).filter(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a family member")

    from sqlalchemy import func, extract
    today = date.today()
    people = db.query(Person).filter(
        Person.family_id == family_id,
        Person.dob.isnot(None),
    ).all()

    birthdays = []
    for p in people:
        if not p.dob:
            continue
        # Calculate next birthday
        try:
            next_bday = date(today.year, p.dob.month, p.dob.day)
            if next_bday < today:
                next_bday = date(today.year + 1, p.dob.month, p.dob.day)
            days_until = (next_bday - today).days
            if days_until <= 30:
                age = today.year - p.dob.year
                if next_bday.year > today.year:
                    age += 1
                birthdays.append({
                    "person_id": str(p.id),
                    "person_name": p.name,
                    "photo_url": p.photo_url,
                    "dob": p.dob.isoformat(),
                    "next_birthday": next_bday.isoformat(),
                    "days_until": days_until,
                    "turning_age": age,
                })
        except ValueError:
            continue

    birthdays.sort(key=lambda b: b["days_until"])
    return birthdays


# ─── File Upload Route ────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    url = save_upload(file)
    return {"url": url}


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "pgvector": PGVECTOR_AVAILABLE and check_pgvector()}
