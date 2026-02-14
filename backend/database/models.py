from sqlalchemy import Column, String, Integer, LargeBinary, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

Base = declarative_base()

class User(Base):
    """Root level - Each user has their own categories"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    password = Column(String, nullable=False)
    
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}')>"


class Category(Base):
    """Second level - Categories belong to users"""
    __tablename__ = "category"
    
    id = Column(Integer, primary_key=True, index=True)
    cat_name = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="categories")
    people = relationship("Person", back_populates="category", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Category(id={self.id}, cat_name='{self.cat_name}', user_id={self.user_id})>"


class Person(Base):
    """Third level - People belong to categories"""
    __tablename__ = "persons"
    
    id = Column(Integer, primary_key=True, index=True)
    person_name = Column(String, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("category.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    category = relationship("Category", back_populates="people")
    files = relationship("FileStore", back_populates="person", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Person(id={self.id}, person_name='{self.person_name}', category_id={self.category_id})>"


class FileStore(Base):
    """Fourth level - Files belong to persons"""
    __tablename__ = "filestore"
    
    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False, index=True)
    file_data = Column(LargeBinary, nullable=False)
    file_type = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    
    person = relationship("Person", back_populates="files")
    
    def __repr__(self):
        return f"<FileStore(id={self.id}, file_name='{self.file_name}', person_id={self.person_id})>"


# Pydantic Models
class UserData(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class CategoryData(BaseModel):
    cat_name: str = Field(..., min_length=1, max_length=100, description="Category name")
    
    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    id: int
    cat_name: str
    user_id: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PersonData(BaseModel):
    person_name: str = Field(..., min_length=1, max_length=100, description="Person name")
    category_id: int = Field(..., description="Category ID this person belongs to")
    
    class Config:
        from_attributes = True


class PersonResponse(BaseModel):
    id: int
    person_name: str
    category_id: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class FileResponse(BaseModel):
    id: int
    file_name: str
    file_type: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    person_id: int
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str


class FileUploadResponse(BaseModel):
    id: int
    file_name: str
    file_size: int
    file_type: str
    person_id: int
    message: str