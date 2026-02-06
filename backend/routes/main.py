import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
from datetime import datetime, timedelta
from jose import JWTError, jwt

from fastapi import FastAPI,Depends,HTTPException,status
from fastapi.responses import FileResponse
from passlib.context import CryptContext
import asyncio
from database.models import User,user_data,UserResponse,Base
from fastapi.middleware.cors import CORSMiddleware
from database.config import SessionLocal,engine
pwd_context=CryptContext(schemes=['bcrypt'],deprecated='auto')
app=FastAPI()


Base.metadata.create_all(bind=engine)
SECRET_KEY = os.getenv("SECRET_KEY")
expires_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
        max_age=3600,
    )
def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def hash_password(password: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, pwd_context.hash, password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()

    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, "HS256")
    return encoded_jwt

@app.get('/home')
async def home():
    return {"home page"}
@app.post("/sign_up",response_model=UserResponse)
async def sign_up(data:user_data,db=Depends(get_db)):
    existing_user = db.query(User).filter(User.name == data.name).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    try:
        hashed=await hash_password(data.password)
        user=User(name=data.name,password=hashed)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )
@app.post("/login")
async def login(data: user_data,db = Depends(get_db)):
    """Authenticate user"""
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
        expires_delta=timedelta(minutes=expires_minutes))
    

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.name
    }


