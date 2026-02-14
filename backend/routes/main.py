import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import asyncio
from typing import Optional, List

from database.models import (
    User, UserData, UserResponse, Base, FileStore, FileResponse, 
    LoginResponse, CategoryResponse, FileUploadResponse, Category, 
    Person, CategoryData, PersonData, PersonResponse
)
from fastapi.middleware.cors import CORSMiddleware
from database.config import SessionLocal, engine

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
app = FastAPI()
security = HTTPBearer()

Base.metadata.create_all(bind=engine)

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def hash_password(password: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, pwd_context.hash, password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

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
                detail="Token missing expiration"
            )

        current_time = datetime.now(timezone.utc).timestamp()
        if current_time > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )

        user_id = payload.get("user_id")
        if user_id is None or not isinstance(user_id, int) or user_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user_id in token"
            )

        username = payload.get("sub")
        if username is None or not isinstance(username, str) or len(username.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username in token"
            )

        logger.info(f"Token verified for: {username} (ID: {user_id})")
        return {"user_id": user_id, "username": username}

    except JWTError as e:
        logger.error(f"JWT verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected token error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed"
        )

ALLOWED_EXTENSIONS = {
    'audio': {'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'},
    'video': {'mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm'},
    'image': {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'},
    'document': {'pdf', 'txt', 'docx', 'xlsx', 'pptx'}
}

MAX_FILE_SIZE = 100 * 1024 * 1024

def get_file_category(filename: str) -> Optional[str]:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
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



@app.get('/home')
async def home():
    return {"message": "Memoir API - Home page"}

@app.post("/sign_up", response_model=UserResponse)
async def sign_up(data: UserData, db=Depends(get_db)):
    logger.info(f"Sign up attempt for username: {data.name}")
    existing_user = db.query(User).filter(User.name == data.name).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    try:
        hashed = await hash_password(data.password)
        user = User(name=data.name, password=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"User created successfully: {user.name} (ID: {user.id})")
        return user
    except Exception as e:
        db.rollback()
        logger.error(f"Sign up failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )

@app.post("/login", response_model=LoginResponse)
async def login(data: UserData, db=Depends(get_db)):
    logger.info(f"Login attempt for username: {data.name}")
    if not data.name or not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password required"
        )
    user = db.query(User).filter(User.name == data.name).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    access_token = create_access_token(
        data={"sub": user.name, "user_id": user.id},
        expires_delta=timedelta(minutes=expires_minutes)
    )
    logger.info(f"Login successful for user: {user.name} (ID: {user.id})")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.name
    }


@app.post("/home/category", response_model=CategoryResponse)
async def create_category(
    data: CategoryData,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Create a new category for the authenticated user"""
    user_id = token_data["user_id"]
    
    # Check if category already exists for this user
    existing = db.query(Category).filter(
        Category.cat_name == data.cat_name,
        Category.user_id == user_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category already exists"
        )
    
    try:
        cat_obj = Category(
            cat_name=data.cat_name,
            user_id=user_id
        )
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
            detail="Error creating category"
        )

@app.get("/home/categories", response_model=List[CategoryResponse])
async def get_categories(
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Get all categories for the authenticated user"""
    user_id = token_data["user_id"]
    categories = db.query(Category).filter(Category.user_id == user_id).all()
    logger.info(f"Retrieved {len(categories)} categories for user {user_id}")
    return categories

@app.delete("/home/category/{category_id}")
async def delete_category(
    category_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Delete a category (and all its people and files)"""
    user_id = token_data["user_id"]
    
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == user_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    try:
        db.delete(category)
        db.commit()
        logger.info(f"Category deleted: {category.cat_name} (ID: {category_id})")
        return {"message": f"Category '{category.cat_name}' deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Category deletion failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {str(e)}"
        )


@app.post("/home/person", response_model=PersonResponse)
async def create_person(
    data: PersonData,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Create a new person in a category"""
    user_id = token_data["user_id"]
    
    # Verify category belongs to user
    category = db.query(Category).filter(
        Category.id == data.category_id,
        Category.user_id == user_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or doesn't belong to you"
        )
    
    try:
        person_obj = Person(
            person_name=data.person_name,
            category_id=data.category_id
        )
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
            detail="Error creating person"
        )

@app.get("/home/category/{category_id}/people", response_model=List[PersonResponse])
async def get_people_in_category(
    category_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Get all people in a specific category"""
    user_id = token_data["user_id"]
    
    # Verify category belongs to user
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == user_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    people = db.query(Person).filter(Person.category_id == category_id).all()
    logger.info(f"Retrieved {len(people)} people for category {category_id}")
    return people

@app.delete("/home/person/{person_id}")
async def delete_person(
    person_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Delete a person (and all their files)"""
    user_id = token_data["user_id"]
    
    person = db.query(Person).join(Category).filter(
        Person.id == person_id,
        Category.user_id == user_id
    ).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    try:
        db.delete(person)
        db.commit()
        logger.info(f"Person deleted: {person.person_name} (ID: {person_id})")
        return {"message": f"Person '{person.person_name}' deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Person deletion failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {str(e)}"
        )

# FILE ENDPOINTS (Hierarchical - Person-based)

@app.post("/home/person/{person_id}/upload", response_model=FileUploadResponse)
async def upload_file_to_person(
    person_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Upload a file to a specific person"""
    user_id = token_data["user_id"]
    
    # Verify person belongs to user's category
    person = db.query(Person).join(Category).filter(
        Person.id == person_id,
        Category.user_id == user_id
    ).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found or doesn't belong to you"
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
            person_id=person_id
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
            "message": "File uploaded successfully"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Upload failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )

@app.get("/home/person/{person_id}/files", response_model=List[FileResponse])
async def get_person_files(
    person_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Get all files for a specific person"""
    user_id = token_data["user_id"]
    
    # Verify person belongs to user
    person = db.query(Person).join(Category).filter(
        Person.id == person_id,
        Category.user_id == user_id
    ).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    files = db.query(FileStore).filter(FileStore.person_id == person_id).all()
    logger.info(f"Retrieved {len(files)} files for person {person_id}")
    return files

@app.delete("/home/person/{person_id}/files/{file_id}")
async def delete_person_file(
    person_id: int,
    file_id: int,
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
):
    """Delete a specific file from a person"""
    user_id = token_data["user_id"]
    
    # Verify person belongs to user
    person = db.query(Person).join(Category).filter(
        Person.id == person_id,
        Category.user_id == user_id
    ).first()
    
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )
    
    # Get the file
    db_file = db.query(FileStore).filter(
        FileStore.id == file_id,
        FileStore.person_id == person_id
    ).first()
    
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
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {str(e)}"
        )



@app.get("/home/user/structure")
async def get_user_structure(
    token_data: dict = Depends(verify_token),
    db=Depends(get_db)
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
            people_data.append({
                "id": person.id,
                "name": person.person_name,
                "file_count": len(files),
                "files": [
                    {
                        "id": f.id,
                        "file_name": f.file_name,
                        "file_type": f.file_type,
                        "description": f.description,
                        "created_at": f.created_at.isoformat() if f.created_at else None
                    }
                    for f in files
                ]
            })
        
        structure.append({
            "id": category.id,
            "name": category.cat_name,
            "people_count": len(people),
            "people": people_data
        })
    
    return {
        "user_id": user_id,
        "categories": structure
    }