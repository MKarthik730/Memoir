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
    MemberRole, RelationshipTag,
    UserCreate, UserLogin, UserResponse, LoginResponse, FamilyCreate, FamilyResponse,
    PersonCreate, PersonResponse, PersonDetailResponse,
    RelationshipCreate, RelationshipResponse,
    MemoryCreate, MemoryResponse, SearchQuery, UploadResponse,
)
from backend.database.config import engine, SessionLocal, get_db, check_pgvector, init_db, PGVECTOR_AVAILABLE

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


# ─── File Upload Route ────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    url = save_upload(file)
    return {"url": url}


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "pgvector": PGVECTOR_AVAILABLE and check_pgvector()}
