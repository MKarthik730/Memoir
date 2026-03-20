import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import asyncio
import re
import threading
from typing import Optional, List
from pydantic import BaseModel, Field
from io import BytesIO

from fastapi.responses import StreamingResponse

from database.models import (
    User,
    UserData,
    UserResponse,
    RegistrationResponse,
    Base,
    FileStore,
    FileResponse,
    LoginResponse,
    CategoryResponse,
    FileUploadResponse,
    Category,
    Person,
    CategoryData,
    PersonData,
    PersonResponse,
    Memory,
    MemoryData,
    MemoryResponse,
    PersonSummary,
    PersonSummaryData,
    PersonSummaryResponse,
    RelationshipSuggestion,
)
from fastapi.middleware.cors import CORSMiddleware
from database.config import SessionLocal, engine
from fastapi.staticfiles import StaticFiles

try:
    from ai import (
        SentimentAnalyzer,
        MemorySummarizer,
        RelationshipSuggester,
        EMOTION_COLORS,
    )
except Exception:
    SentimentAnalyzer = None
    MemorySummarizer = None
    RelationshipSuggester = None
    EMOTION_COLORS = {}

try:
    from rag.rag_model import RAGModel
except Exception:
    RAGModel = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

RAG_EMBEDDING_MODEL = os.getenv("RAG_EMBEDDING_MODEL", "all-mpnet-base-v2")
_RAG_MODEL_INSTANCE = None
_RAG_MODEL_LOCK = threading.Lock()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
app = FastAPI()
security = HTTPBearer()

Base.metadata.create_all(bind=engine)


@app.on_event("startup")
async def startup_event():
    logger.info("Testing database connection...")
    try:
        from database.config import engine

        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")


from sqlalchemy import text

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
expires_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
    max_age=3600,
)

# Serve static files at /static prefix
import os

frontend_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend",
)
print(f"Frontend path: {frontend_path}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    logger.info(
        f"Password length before truncate: {len(password)}, after: {len(password_bytes)}"
    )
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, pwd_context.hash, password_bytes)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")[:72]
    return pwd_context.verify(password_bytes, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, "HS256")
    logger.info(f"Token created for user: {data.get('sub')}")
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        logger.info("Token signature verified successfully")

        exp = payload.get("exp")
        if exp is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing expiration",
            )

        current_time = datetime.now(timezone.utc).timestamp()
        if current_time > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
            )

        user_id = payload.get("user_id")
        if user_id is None or not isinstance(user_id, int) or user_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user_id in token",
            )

        username = payload.get("sub")
        if (
            username is None
            or not isinstance(username, str)
            or len(username.strip()) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username in token",
            )

        logger.info(f"Token verified for: {username} (ID: {user_id})")
        return {"user_id": user_id, "username": username}

    except JWTError as e:
        logger.error(f"JWT verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected token error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token verification failed"
        )


ALLOWED_EXTENSIONS = {
    "audio": {"mp3", "wav", "flac", "aac", "m4a", "ogg"},
    "video": {"mp4", "avi", "mov", "mkv", "flv", "wmv", "webm"},
    "image": {"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"},
    "document": {"pdf", "txt", "docx", "xlsx", "pptx"},
}

MAX_FILE_SIZE = 100 * 1024 * 1024


class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=15)


def build_person_pdf_buffer(person: Person, db) -> BytesIO:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
    from reportlab.lib.units import inch
    from PIL import Image as PILImage

    files = (
        db.query(FileStore)
        .filter(FileStore.person_id == person.id)
        .order_by(FileStore.created_at.asc())
        .all()
    )
    memories = (
        db.query(Memory)
        .filter(Memory.person_id == person.id)
        .order_by(Memory.created_at.asc())
        .all()
    )

    items = []
    for file in files:
        items.append(
            {
                "type": "file",
                "file_name": file.file_name,
                "file_type": file.file_type,
                "file_data": file.file_data,
                "description": file.description,
                "created_at": file.created_at,
            }
        )
    for memory in memories:
        items.append(
            {
                "type": "memory",
                "content": memory.content,
                "created_at": memory.created_at,
            }
        )

    items.sort(key=lambda x: x.get("created_at") or datetime.min)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "PersonTitle",
        parent=styles["Heading1"],
        fontSize=22,
        spaceAfter=18,
    )
    subtitle_style = ParagraphStyle(
        "PersonSubTitle",
        parent=styles["Heading3"],
        fontSize=12,
        spaceAfter=16,
        textColor="gray",
    )
    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=8,
    )
    date_style = ParagraphStyle(
        "DateStyle",
        parent=styles["Normal"],
        fontSize=9,
        textColor="gray",
        spaceAfter=8,
    )
    content_style = ParagraphStyle(
        "ContentStyle",
        parent=styles["Normal"],
        fontSize=11,
        spaceAfter=16,
    )

    story = []
    story.append(Paragraph(f"Memoir - {person.person_name}", title_style))
    story.append(Paragraph("Memories and images", subtitle_style))
    story.append(Spacer(1, 0.2 * inch))

    if not items:
        story.append(Paragraph("No memories or images added yet.", content_style))

    for item in items:
        date_str = "Unknown date"
        if item.get("created_at"):
            date_str = item["created_at"].strftime("%B %d, %Y at %I:%M %p")

        if item["type"] == "memory":
            story.append(Paragraph("Memory", section_title_style))
            story.append(Paragraph(date_str, date_style))
            story.append(
                Paragraph(item["content"].replace("\n", "<br/>"), content_style)
            )
        elif item["type"] == "file" and item["file_type"].startswith("image/"):
            story.append(Paragraph(f"Image - {item['file_name']}", section_title_style))
            story.append(Paragraph(date_str, date_style))
            try:
                img_buffer = BytesIO(item["file_data"])
                pil_img = PILImage.open(img_buffer)
                max_width = 6 * inch
                max_height = 4 * inch
                width, height = pil_img.size
                if width > max_width or height > max_height:
                    ratio = min(max_width / width, max_height / height)
                    pil_img = pil_img.resize(
                        (int(width * ratio), int(height * ratio)),
                        PILImage.Resampling.LANCZOS,
                    )

                png_buffer = BytesIO()
                pil_img.save(png_buffer, format="PNG")
                png_buffer.seek(0)

                rl_img = Image(png_buffer)
                rl_img.hAlign = "CENTER"
                story.append(rl_img)
                story.append(Spacer(1, 0.15 * inch))
                if item.get("description"):
                    story.append(
                        Paragraph(f"Description: {item['description']}", content_style)
                    )
                else:
                    story.append(Spacer(1, 0.08 * inch))
            except Exception as img_err:
                logger.error(
                    f"Failed to add image '{item['file_name']}' to person PDF: {img_err}"
                )
                story.append(Paragraph("[Image could not be rendered]", content_style))

    doc.build(story)
    buffer.seek(0)
    return buffer


def get_user_rag_documents(user_id: int, db) -> List[dict]:
    def clean_text(value: str) -> str:
        return re.sub(r"\s+", " ", (value or "")).strip()

    def chunk_text(value: str, chunk_size: int = 900, overlap: int = 120) -> List[str]:
        text = clean_text(value)
        if not text:
            return []
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + chunk_size, text_len)
            chunks.append(text[start:end])
            if end == text_len:
                break
            start = max(end - overlap, start + 1)
        return chunks

    def extract_pdf_text(pdf_bytes: bytes) -> str:
        if PdfReader is None:
            return ""
        try:
            reader = PdfReader(BytesIO(pdf_bytes))
            pages = []
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages.append(page_text)
            return "\n".join(pages)
        except Exception:
            return ""

    docs: List[dict] = []

    memories = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .all()
    )
    for memory in memories:
        for idx, chunk in enumerate(chunk_text(memory.content)):
            docs.append(
                {
                    "text": chunk,
                    "metadata": {
                        "type": "memory",
                        "chunk_index": idx,
                        "person_id": memory.person_id,
                        "person_name": memory.person.person_name,
                        "category_name": memory.person.category.cat_name,
                        "created_at": memory.created_at.isoformat()
                        if memory.created_at
                        else None,
                    },
                }
            )

    files = (
        db.query(FileStore)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .all()
    )
    for file in files:
        if file.description:
            docs.append(
                {
                    "text": clean_text(file.description),
                    "metadata": {
                        "type": "file_description",
                        "file_name": file.file_name,
                        "file_type": file.file_type,
                        "person_id": file.person_id,
                        "person_name": file.person.person_name,
                        "category_name": file.person.category.cat_name,
                        "created_at": file.created_at.isoformat()
                        if file.created_at
                        else None,
                    },
                }
            )

        if file.file_type in ("text/plain", "application/json"):
            try:
                decoded = clean_text(file.file_data.decode("utf-8", errors="ignore"))
                for idx, chunk in enumerate(chunk_text(decoded)):
                    docs.append(
                        {
                            "text": chunk,
                            "metadata": {
                                "type": "text_file",
                                "chunk_index": idx,
                                "file_name": file.file_name,
                                "file_type": file.file_type,
                                "person_id": file.person_id,
                                "person_name": file.person.person_name,
                                "category_name": file.person.category.cat_name,
                                "created_at": file.created_at.isoformat()
                                if file.created_at
                                else None,
                            },
                        }
                    )
            except Exception:
                pass

        if file.file_type == "application/pdf" or file.file_name.lower().endswith(
            ".pdf"
        ):
            pdf_text = extract_pdf_text(file.file_data)
            for idx, chunk in enumerate(chunk_text(pdf_text)):
                docs.append(
                    {
                        "text": chunk,
                        "metadata": {
                            "type": "pdf_file",
                            "chunk_index": idx,
                            "file_name": file.file_name,
                            "file_type": file.file_type,
                            "person_id": file.person_id,
                            "person_name": file.person.person_name,
                            "category_name": file.person.category.cat_name,
                            "created_at": file.created_at.isoformat()
                            if file.created_at
                            else None,
                        },
                    }
                )

    return docs


def get_rag_model_instance():
    global _RAG_MODEL_INSTANCE
    if RAGModel is None:
        return None
    if _RAG_MODEL_INSTANCE is not None:
        return _RAG_MODEL_INSTANCE

    with _RAG_MODEL_LOCK:
        if _RAG_MODEL_INSTANCE is None:
            _RAG_MODEL_INSTANCE = RAGModel(embedding_model=RAG_EMBEDDING_MODEL)
    return _RAG_MODEL_INSTANCE


def synthesize_answer(question: str, retrieved_docs: List) -> str:
    query_terms = [
        t for t in re.findall(r"[a-zA-Z0-9]+", question.lower()) if len(t) > 2
    ]

    candidates = []
    for doc in retrieved_docs:
        text = (getattr(doc, "text", "") or "").strip()
        if not text:
            continue
        sentences = re.split(r"(?<=[.!?])\s+", text)
        for sentence in sentences:
            line = sentence.strip()
            if not line:
                continue
            score = sum(1 for token in query_terms if token in line.lower())
            candidates.append((score, line))

    if not candidates:
        return "No relevant context found for this question in your memories and uploaded files."

    candidates.sort(key=lambda x: x[0], reverse=True)
    selected = []
    seen = set()
    for _, sentence in candidates:
        normalized = sentence.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        selected.append(sentence)
        if len(selected) >= 4:
            break

    return "\n\n".join(selected)


def get_file_category(filename: str) -> Optional[str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return None


def validate_file(file: UploadFile) -> tuple[bool, str]:
    if file.size and file.size > MAX_FILE_SIZE:
        return False, f"File too large. Max: {MAX_FILE_SIZE / 1024 / 1024:.0f}MB"

    category = get_file_category(file.filename)
    if not category:
        return False, "File type not allowed"

    return True, "valid"


@app.get("/home")
async def home():
    return {"message": "Memoir API - Home page"}


@app.post("/sign_up", response_model=RegistrationResponse)
async def sign_up(data: UserData, db=Depends(get_db)):
    logger.info(f"Sign up attempt for username: {data.name}")
    existing_user = db.query(User).filter(User.name == data.name).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    try:
        hashed = await hash_password(data.password[:72])
        user = User(name=data.name, password=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)

        access_token = create_access_token(
            data={"sub": user.name, "user_id": user.id},
            expires_delta=timedelta(minutes=expires_minutes),
        )

        logger.info(f"User created successfully: {user.name} (ID: {user.id})")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
            "username": user.name,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Sign up failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating user: {str(e)}",
        )


@app.post("/login", response_model=LoginResponse)
async def login(data: UserData, db=Depends(get_db)):
    logger.info(f"Login attempt for username: {data.name}")
    if not data.name or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password required",
        )
    user = db.query(User).filter(User.name == data.name).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    access_token = create_access_token(
        data={"sub": user.name, "user_id": user.id},
        expires_delta=timedelta(minutes=expires_minutes),
    )
    logger.info(f"Login successful for user: {user.name} (ID: {user.id})")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.name,
    }


@app.post("/home/category", response_model=CategoryResponse)
async def create_category(
    data: CategoryData, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Create a new category for the authenticated user"""
    user_id = token_data["user_id"]

    # Check if category already exists for this user
    existing = (
        db.query(Category)
        .filter(Category.cat_name == data.cat_name, Category.user_id == user_id)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Category already exists"
        )

    try:
        cat_obj = Category(cat_name=data.cat_name, user_id=user_id)
        db.add(cat_obj)
        db.commit()
        db.refresh(cat_obj)
        logger.info(f"Category created: {cat_obj.cat_name} (ID: {cat_obj.id})")
        return cat_obj
    except Exception as e:
        db.rollback()
        logger.error(f"Category creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating category",
        )


@app.get("/home/categories", response_model=List[CategoryResponse])
async def get_categories(token_data: dict = Depends(verify_token), db=Depends(get_db)):
    """Get all categories for the authenticated user"""
    user_id = token_data["user_id"]
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    logger.info(f"Retrieved {len(categories)} categories for user {user_id}")
    return categories


@app.delete("/home/category/{category_id}")
async def delete_category(
    category_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Delete a category (and all its people and files)"""
    user_id = token_data["user_id"]

    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    try:
        db.delete(category)
        db.commit()
        logger.info(f"Category deleted: {category.cat_name} (ID: {category_id})")
        return {"message": f"Category '{category.cat_name}' deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Category deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


@app.post("/home/person", response_model=PersonResponse)
async def create_person(
    data: PersonData, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Create a new person in a category"""
    user_id = token_data["user_id"]

    # Verify category belongs to user
    category = (
        db.query(Category)
        .filter(Category.id == data.category_id, Category.user_id == user_id)
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or doesn't belong to you",
        )

    try:
        person_obj = Person(person_name=data.person_name, category_id=data.category_id)
        db.add(person_obj)
        db.commit()
        db.refresh(person_obj)
        logger.info(f"Person created: {person_obj.person_name} (ID: {person_obj.id})")
        return person_obj
    except Exception as e:
        db.rollback()
        logger.error(f"Person creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating person",
        )


@app.get("/home/category/{category_id}/people", response_model=List[PersonResponse])
async def get_people_in_category(
    category_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Get all people in a specific category"""
    user_id = token_data["user_id"]

    # Verify category belongs to user
    category = (
        db.query(Category)
        .filter(Category.id == category_id, Category.user_id == user_id)
        .first()
    )

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    people = db.query(Person).filter(Person.category_id == category_id).all()
    logger.info(f"Retrieved {len(people)} people for category {category_id}")
    return people


@app.delete("/home/person/{person_id}")
async def delete_person(
    person_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Delete a person (and all their files)"""
    user_id = token_data["user_id"]

    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )

    try:
        db.delete(person)
        db.commit()
        logger.info(f"Person deleted: {person.person_name} (ID: {person_id})")
        return {"message": f"Person '{person.person_name}' deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Person deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


# FILE ENDPOINTS (Hierarchical - Person-based)


@app.post("/home/person/{person_id}/upload", response_model=FileUploadResponse)
async def upload_file_to_person(
    person_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Upload a file to a specific person"""
    user_id = token_data["user_id"]

    # Verify person belongs to user's category
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found or doesn't belong to you",
        )

    is_valid, message = validate_file(file)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    try:
        data = await file.read()
        filesize = len(data)

        obj_file = FileStore(
            file_name=file.filename,
            file_data=data,
            file_type=file.content_type or "application/octet-stream",
            description=description,
            person_id=person_id,
        )
        db.add(obj_file)
        db.commit()
        db.refresh(obj_file)

        logger.info(f"File uploaded: {obj_file.file_name} to person {person_id}")

        return {
            "id": obj_file.id,
            "file_name": obj_file.file_name,
            "file_size": filesize,
            "file_type": obj_file.file_type,
            "person_id": person_id,
            "message": "File uploaded successfully",
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/home/person/{person_id}/files", response_model=List[FileResponse])
async def get_person_files(
    person_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Get all files for a specific person"""
    user_id = token_data["user_id"]

    # Verify person belongs to user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )

    files = db.query(FileStore).filter(FileStore.person_id == person_id).all()
    logger.info(f"Retrieved {len(files)} files for person {person_id}")
    return files


@app.delete("/home/person/{person_id}/files/{file_id}")
async def delete_person_file(
    person_id: int,
    file_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Delete a specific file from a person"""
    user_id = token_data["user_id"]

    # Verify person belongs to user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Person not found"
        )

    # Get the file
    db_file = (
        db.query(FileStore)
        .filter(FileStore.id == file_id, FileStore.person_id == person_id)
        .first()
    )

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        db.delete(db_file)
        db.commit()
        logger.info(f"File deleted: {db_file.file_name} (ID: {file_id})")
        return {"message": f"File '{db_file.file_name}' deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"File deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Deletion failed: {str(e)}")


# Memory endpoints
@app.post("/home/person/{person_id}/memory", response_model=MemoryResponse)
async def create_memory(
    person_id: int,
    memory_data: MemoryData,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Create a new memory for a person with automatic emotion analysis"""
    user_id = token_data["user_id"]

    # Verify the person belongs to the user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Analyze emotion
    emotion_tag = None
    emotion_confidence = None
    if SentimentAnalyzer:
        try:
            analyzer = SentimentAnalyzer()
            result = analyzer.analyze(memory_data.content)
            emotion_tag = result.emotion
            emotion_confidence = result.confidence
        except Exception as e:
            logger.warning(f"Emotion analysis failed: {str(e)}")

    # Create the memory with emotion data
    memory = Memory(
        content=memory_data.content,
        person_id=person_id,
        emotion_tag=emotion_tag,
        emotion_confidence=str(emotion_confidence) if emotion_confidence else None,
    )

    db.add(memory)
    db.commit()
    db.refresh(memory)

    return MemoryResponse.model_validate(memory)


@app.get("/home/person/{person_id}/memories", response_model=List[MemoryResponse])
async def get_memories(
    person_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Get all memories for a person"""
    user_id = token_data["user_id"]

    # Verify the person belongs to the user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    memories = (
        db.query(Memory)
        .filter(Memory.person_id == person_id)
        .order_by(Memory.created_at.desc())
        .all()
    )

    return [MemoryResponse.from_orm(memory) for memory in memories]


@app.delete("/home/person/{person_id}/memories/{memory_id}")
async def delete_memory(
    person_id: int,
    memory_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Delete a memory from a person"""
    user_id = token_data["user_id"]

    # Verify the person belongs to the user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Find and delete the memory
    memory = (
        db.query(Memory)
        .filter(Memory.id == memory_id, Memory.person_id == person_id)
        .first()
    )

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    db.delete(memory)
    db.commit()

    return {"message": "Memory deleted successfully"}


@app.get("/home/person/{person_id}/files/{file_id}/download")
async def download_file(
    person_id: int,
    file_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Download a file"""
    user_id = token_data["user_id"]

    # Verify the person belongs to the user
    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Get the file
    db_file = (
        db.query(FileStore)
        .filter(FileStore.id == file_id, FileStore.person_id == person_id)
        .first()
    )

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Return file data
    from fastapi.responses import StreamingResponse
    import io

    file_data = io.BytesIO(db_file.file_data)

    # For images, serve inline; for other files, force download
    if db_file.file_type.startswith("image/"):
        return StreamingResponse(file_data, media_type=db_file.file_type)
    else:
        return StreamingResponse(
            file_data,
            media_type=db_file.file_type,
            headers={
                "Content-Disposition": f"attachment; filename={db_file.file_name}"
            },
        )


@app.get("/home/user/all-content")
async def get_all_user_content(
    token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Get all files and memories for the user across all categories and people"""
    user_id = token_data["user_id"]

    # Get all files
    files = (
        db.query(FileStore)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .order_by(FileStore.created_at.desc())
        .all()
    )

    # Get all memories
    memories = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .order_by(Memory.created_at.desc())
        .all()
    )

    # Combine and sort by date
    all_content = []

    for file in files:
        all_content.append(
            {
                "id": file.id,
                "type": "file",
                "file_name": file.file_name,
                "file_type": file.file_type,
                "description": file.description,
                "person_name": file.person.person_name,
                "category_name": file.person.category.cat_name,
                "created_at": file.created_at.isoformat() if file.created_at else None,
                "person_id": file.person_id,
            }
        )

    for memory in memories:
        all_content.append(
            {
                "id": memory.id,
                "type": "memory",
                "content": memory.content,
                "person_name": memory.person.person_name,
                "category_name": memory.person.category.cat_name,
                "created_at": memory.created_at.isoformat()
                if memory.created_at
                else None,
                "person_id": memory.person_id,
            }
        )

    # Sort by creation date (newest first)
    all_content.sort(key=lambda x: x["created_at"] or "", reverse=True)

    return {"user_id": user_id, "total_items": len(all_content), "content": all_content}


@app.get("/home/user/memories/pdf")
async def generate_memories_pdf(
    token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Generate a PDF containing all user memories and images"""
    user_id = token_data["user_id"]

    # Get all files
    files = (
        db.query(FileStore)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .order_by(FileStore.created_at.asc())
        .all()
    )

    # Get all memories
    memories = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .order_by(Memory.created_at.asc())
        .all()
    )

    # Combine and sort by date
    all_content = []

    for file in files:
        all_content.append(
            {
                "id": file.id,
                "type": "file",
                "file_name": file.file_name,
                "file_type": file.file_type,
                "file_data": file.file_data,
                "description": file.description,
                "person_name": file.person.person_name,
                "category_name": file.person.category.cat_name,
                "created_at": file.created_at,
                "person_id": file.person_id,
            }
        )

    for memory in memories:
        all_content.append(
            {
                "id": memory.id,
                "type": "memory",
                "content": memory.content,
                "person_name": memory.person.person_name,
                "category_name": memory.person.category.cat_name,
                "created_at": memory.created_at,
                "person_id": memory.person_id,
            }
        )

    # Sort by creation date (oldest first for PDF)
    all_content.sort(key=lambda x: x["created_at"] or datetime.min)

    if not all_content:
        raise HTTPException(status_code=404, detail="No content found")

    # Generate PDF
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            PageBreak,
            Image as RLImage,
        )
        from reportlab.lib.units import inch
        from io import BytesIO
        from PIL import Image as PILImage

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            spaceAfter=30,
        )

        memory_title_style = ParagraphStyle(
            "MemoryTitle",
            parent=styles["Heading2"],
            fontSize=16,
            spaceAfter=10,
        )

        date_style = ParagraphStyle(
            "DateStyle",
            parent=styles["Normal"],
            fontSize=10,
            textColor="gray",
            spaceAfter=15,
        )

        content_style = ParagraphStyle(
            "ContentStyle",
            parent=styles["Normal"],
            fontSize=12,
            spaceAfter=20,
        )

        story = []

        # Title
        story.append(Paragraph("My Memoir Collection", title_style))
        story.append(Spacer(1, 0.5 * inch))

        for item in all_content:
            # Item header
            person_info = f"{item['category_name']} - {item['person_name']}"
            story.append(Paragraph(person_info, memory_title_style))

            # Date
            date_str = (
                item["created_at"].strftime("%B %d, %Y at %I:%M %p")
                if item["created_at"]
                else "Unknown date"
            )
            story.append(Paragraph(date_str, date_style))

            if item["type"] == "memory":
                # Content
                story.append(
                    Paragraph(item["content"].replace("\n", "<br/>"), content_style)
                )
            elif item["type"] == "file" and item["file_type"].startswith("image/"):
                # Image
                try:
                    img_buffer = BytesIO(item["file_data"])
                    pil_img = PILImage.open(img_buffer)
                    # Resize if too large
                    max_width = 6 * inch
                    max_height = 4 * inch
                    width, height = pil_img.size
                    if width > max_width or height > max_height:
                        ratio = min(max_width / width, max_height / height)
                        new_width = width * ratio
                        new_height = height * ratio
                        pil_img = pil_img.resize(
                            (int(new_width), int(new_height)),
                            PILImage.Resampling.LANCZOS,
                        )

                    img_buffer = BytesIO()
                    pil_img.save(img_buffer, format="PNG")
                    img_buffer.seek(0)

                    rl_img = RLImage(img_buffer)
                    rl_img.hAlign = "CENTER"
                    story.append(rl_img)
                    story.append(Spacer(1, 0.2 * inch))

                    if item.get("description"):
                        story.append(
                            Paragraph(
                                f"Description: {item['description']}", content_style
                            )
                        )
                except Exception as e:
                    logger.error(f"Failed to add image {item['id']}: {str(e)}")
                    story.append(
                        Paragraph(f"[Image: {item['file_name']}]", content_style)
                    )

            # Separator
            story.append(Spacer(1, 0.3 * inch))

        doc.build(story)
        buffer.seek(0)

        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=memories.pdf"},
        )

    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="PDF generation not available. Please install reportlab and pillow: pip install reportlab pillow",
        )
    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


@app.get("/home/person/{person_id}/pdf")
async def generate_person_pdf_download(
    person_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    user_id = token_data["user_id"]

    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    try:
        pdf_buffer = build_person_pdf_buffer(person, db)
        safe_name = person.person_name.replace(" ", "_")
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={safe_name}_memoir.pdf"
            },
        )
    except Exception as e:
        logger.error(f"Person PDF generation failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Person PDF generation failed: {str(e)}"
        )


@app.get("/home/person/{person_id}/pdf/view")
async def generate_person_pdf_inline(
    person_id: int, token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    user_id = token_data["user_id"]

    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    try:
        pdf_buffer = build_person_pdf_buffer(person, db)
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=person_memoir.pdf"},
        )
    except Exception as e:
        logger.error(f"Person inline PDF generation failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Person inline PDF generation failed: {str(e)}"
        )


@app.post("/home/rag/query")
async def rag_query(
    payload: RAGQueryRequest,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    user_id = token_data["user_id"]
    docs = get_user_rag_documents(user_id, db)

    if not docs:
        return {
            "answer": "No memories or document text found yet. Add memories or text files to query your data.",
            "sources": [],
            "query": payload.question,
        }

    question = payload.question.strip()
    top_k = min(payload.top_k, len(docs))

    rag_model = get_rag_model_instance()
    if rag_model is not None:
        try:
            rag_model.documents = []
            rag_model.vector_store = rag_model.vector_store.__class__(
                rag_model.embedding_model.get_dimension()
            )
            rag_model.add_documents(
                [d["text"] for d in docs], [d["metadata"] for d in docs]
            )
            result = rag_model.query(question, top_k=top_k)

            retrieved = result.get("retrieved_documents", [])
            answer = synthesize_answer(question, retrieved)
            return {
                "answer": answer,
                "sources": result.get("sources", []),
                "query": question,
            }
        except Exception as e:
            logger.warning(f"RAG model unavailable, using fallback retrieval: {str(e)}")

    query_terms = [t for t in question.lower().split() if len(t) > 2]
    ranked = []
    for d in docs:
        text_l = d["text"].lower()
        score = sum(1 for t in query_terms if t in text_l)
        ranked.append((score, d))

    ranked.sort(key=lambda x: x[0], reverse=True)
    selected = [item[1] for item in ranked[:top_k]]

    answer_parts = [s["text"][:320] for s in selected if s.get("text")]
    answer = (
        "\n\n".join(answer_parts)
        if answer_parts
        else "No relevant context found for this question."
    )
    return {
        "answer": answer,
        "sources": [s.get("metadata", {}) for s in selected],
        "query": question,
    }


@app.get("/home/user/structure")
async def get_user_structure(
    token_data: dict = Depends(verify_token), db=Depends(get_db)
):
    """Get the complete hierarchical structure for the user"""
    user_id = token_data["user_id"]

    categories = db.query(Category).filter(Category.user_id == user_id).all()

    structure = []
    for category in categories:
        people = db.query(Person).filter(Person.category_id == category.id).all()

        people_data = []
        for person in people:
            files = db.query(FileStore).filter(FileStore.person_id == person.id).all()
            memories = db.query(Memory).filter(Memory.person_id == person.id).all()
            people_data.append(
                {
                    "id": person.id,
                    "name": person.person_name,
                    "file_count": len(files),
                    "memory_count": len(memories),
                    "files": [
                        {
                            "id": f.id,
                            "file_name": f.file_name,
                            "file_type": f.file_type,
                            "description": f.description,
                            "created_at": f.created_at.isoformat()
                            if f.created_at
                            else None,
                        }
                        for f in files
                    ],
                    "memories": [
                        {
                            "id": m.id,
                            "content": m.content,
                            "created_at": m.created_at.isoformat()
                            if m.created_at
                            else None,
                        }
                        for m in memories
                    ],
                }
            )

        structure.append(
            {
                "id": category.id,
                "name": category.cat_name,
                "people_count": len(people),
                "people": people_data,
            }
        )

    return {"user_id": user_id, "categories": structure}


@app.post("/home/person/{person_id}/summary")
async def generate_person_summary(
    person_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Generate AI summary for a person's memories"""
    user_id = token_data["user_id"]

    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    memories = db.query(Memory).filter(Memory.person_id == person_id).all()

    if not memories:
        return {
            "summary": f"No memories recorded for {person.person_name} yet.",
            "key_topics": "",
        }

    if not MemorySummarizer:
        return {"error": "Summarization service not available"}, 503

    try:
        summarizer = MemorySummarizer()
        memory_contents = [m.content for m in memories]
        result = summarizer.summarize(memory_contents, person.person_name)

        existing_summary = (
            db.query(PersonSummary).filter(PersonSummary.person_id == person_id).first()
        )

        if existing_summary:
            existing_summary.summary = result["summary"]
            existing_summary.key_topics = result["key_topics"]
            existing_summary.last_summary_at = datetime.utcnow()
        else:
            new_summary = PersonSummary(
                person_id=person_id,
                summary=result["summary"],
                key_topics=result["key_topics"],
            )
            db.add(new_summary)

        db.commit()

        return result
    except Exception as e:
        logger.error(f"Summary generation failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Summary generation failed: {str(e)}"
        )


@app.get("/home/person/{person_id}/summary")
async def get_person_summary(
    person_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Get existing AI summary for a person"""
    user_id = token_data["user_id"]

    person = (
        db.query(Person)
        .join(Category)
        .filter(Person.id == person_id, Category.user_id == user_id)
        .first()
    )

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    summary = (
        db.query(PersonSummary).filter(PersonSummary.person_id == person_id).first()
    )

    if not summary:
        return {
            "summary": None,
            "key_topics": None,
            "message": "No summary generated yet",
        }

    return {
        "summary": summary.summary,
        "key_topics": summary.key_topics,
        "last_summary_at": summary.last_summary_at.isoformat()
        if summary.last_summary_at
        else None,
    }


@app.get("/home/user/relationship-suggestions")
async def get_relationship_suggestions(
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
    min_confidence: float = 0.3,
):
    """Get AI-suggested relationships between people"""
    user_id = token_data["user_id"]

    if not RelationshipSuggester or not SentimentAnalyzer:
        return {
            "suggestions": [],
            "message": "Relationship suggestion service not available",
        }

    persons = db.query(Person).join(Category).filter(Category.user_id == user_id).all()

    if len(persons) < 2:
        return {
            "suggestions": [],
            "message": "Need at least 2 people to suggest relationships",
        }

    try:
        suggester = RelationshipSuggester()
        persons_data = []

        for person in persons:
            memories = db.query(Memory).filter(Memory.person_id == person.id).all()
            emotion_tags = [m.emotion_tag for m in memories if m.emotion_tag]

            analyzer = SentimentAnalyzer()
            topics = []
            for memory in memories:
                result = analyzer.analyze(memory.content)
                if result.emotion:
                    topics.append(result.emotion)

            persons_data.append(
                {
                    "id": person.id,
                    "name": person.person_name,
                    "emotion_tags": list(set(emotion_tags)),
                    "topics": list(set(topics)),
                }
            )

        suggestions = suggester.suggest_relationships(persons_data, min_confidence)
        return {"suggestions": suggestions}

    except Exception as e:
        logger.error(f"Relationship suggestion failed: {str(e)}")
        return {"suggestions": [], "error": str(e)}


@app.get("/home/user/emotion-stats")
async def get_emotion_stats(
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Get emotion statistics across all user memories"""
    user_id = token_data["user_id"]

    memories = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(Category.user_id == user_id)
        .all()
    )

    emotion_counts = {}
    emotion_by_person = {}

    for memory in memories:
        if memory.emotion_tag:
            emotion_counts[memory.emotion_tag] = (
                emotion_counts.get(memory.emotion_tag, 0) + 1
            )

            person_name = memory.person.person_name
            if person_name not in emotion_by_person:
                emotion_by_person[person_name] = {}
            emotion_by_person[person_name][memory.emotion_tag] = (
                emotion_by_person[person_name].get(memory.emotion_tag, 0) + 1
            )

    return {
        "total_memories": len(memories),
        "emotion_distribution": emotion_counts,
        "emotion_by_person": emotion_by_person,
        "emotion_colors": EMOTION_COLORS if EMOTION_COLORS else {},
    }


@app.post("/home/memory/{memory_id}/analyze")
async def analyze_memory_emotion(
    memory_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Re-analyze a memory's emotion (useful for updating old memories)"""
    user_id = token_data["user_id"]

    memory = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(Memory.id == memory_id, Category.user_id == user_id)
        .first()
    )

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    if not SentimentAnalyzer:
        return {"error": "Sentiment analysis service not available"}, 503

    try:
        analyzer = SentimentAnalyzer()
        result = analyzer.analyze(memory.content)

        memory.emotion_tag = result.emotion
        memory.emotion_confidence = str(result.confidence)
        db.commit()

        return {
            "emotion_tag": result.emotion,
            "confidence": result.confidence,
            "color": result.color,
        }
    except Exception as e:
        logger.error(f"Memory emotion analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/home/user/batch-analyze")
async def batch_analyze_memories(
    token_data: dict = Depends(verify_token),
    db=Depends(get_db),
):
    """Analyze emotions for all unanalyzed memories"""
    user_id = token_data["user_id"]

    memories = (
        db.query(Memory)
        .join(Person)
        .join(Category)
        .filter(
            Category.user_id == user_id,
            Memory.emotion_tag == None,
        )
        .all()
    )

    if not memories:
        return {"analyzed": 0, "message": "No memories to analyze"}

    if not SentimentAnalyzer:
        return {"analyzed": 0, "error": "Sentiment analysis service not available"}, 503

    analyzed_count = 0
    try:
        analyzer = SentimentAnalyzer()

        for memory in memories:
            result = analyzer.analyze(memory.content)
            memory.emotion_tag = result.emotion
            memory.emotion_confidence = str(result.confidence)
            analyzed_count += 1

        db.commit()
        return {
            "analyzed": analyzed_count,
            "message": f"Successfully analyzed {analyzed_count} memories",
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Batch analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


@app.get("/{full_path:path}")
async def serve_frontend_or_static(full_path: str):
    """Serve frontend or static files for non-API routes"""
    import os

    frontend_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "frontend",
    )

    # Skip API routes
    if full_path.startswith("home/") or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    # Check if it's a file in frontend directory
    file_path = os.path.join(frontend_path, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        from fastapi.responses import FileResponse

        return FileResponse(file_path)

    # Serve index.html for SPA routing
    index_path = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_path):
        from fastapi.responses import FileResponse

        return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Not Found")
