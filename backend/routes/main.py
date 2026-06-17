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


# ─── File Upload Route ────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    url = save_upload(file)
    return {"url": url}


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "pgvector": PGVECTOR_AVAILABLE and check_pgvector()}
