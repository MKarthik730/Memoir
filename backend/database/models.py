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

    categories = relationship(
        "Category", back_populates="user", cascade="all, delete-orphan"
    )

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
    people = relationship(
        "Person", back_populates="category", cascade="all, delete-orphan"
    )

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
    files = relationship(
        "FileStore", back_populates="person", cascade="all, delete-orphan"
    )
    memories = relationship(
        "Memory", back_populates="person", cascade="all, delete-orphan"
    )
    summary = relationship(
        "PersonSummary",
        back_populates="person",
        uselist=False,
        cascade="all, delete-orphan",
    )

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


class Memory(Base):
    """Fourth level - Text memories belong to persons"""

    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)

    person = relationship("Person", back_populates="memories")

    emotion_tag = Column(String, nullable=True)
    emotion_confidence = Column(String, nullable=True)

    def __repr__(self):
        return f"<Memory(id={self.id}, person_id={self.person_id}, created_at={self.created_at})>"


class PersonSummary(Base):
    """AI-generated summary for a person"""

    __tablename__ = "person_summaries"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(
        Integer, ForeignKey("persons.id"), nullable=False, unique=True, index=True
    )
    summary = Column(String, nullable=False)
    key_topics = Column(String, nullable=True)
    last_summary_at = Column(DateTime, default=datetime.utcnow)

    person = relationship("Person", back_populates="summary")

    def __repr__(self):
        return f"<PersonSummary(person_id={self.person_id})>"


# Pydantic Models
class UserData(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(
        ..., min_length=8, description="Password (minimum 8 characters)"
    )

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CategoryData(BaseModel):
    cat_name: str = Field(
        ..., min_length=1, max_length=100, description="Category name"
    )

    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    id: int
    cat_name: str
    user_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class PersonData(BaseModel):
    person_name: str = Field(
        ..., min_length=1, max_length=100, description="Person name"
    )
    category_id: int = Field(..., description="Category ID this person belongs to")

    class Config:
        from_attributes = True


class PersonResponse(BaseModel):
    id: int
    person_name: str
    category_id: int
    created_at: Optional[datetime] = None
    summary: Optional["PersonSummaryResponse"] = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class FileResponse(BaseModel):
    id: int
    file_name: str
    file_type: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    person_id: int

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str


class RegistrationResponse(BaseModel):
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


class MemoryData(BaseModel):
    content: str = Field(
        ..., min_length=1, max_length=1000, description="Memory content"
    )

    class Config:
        from_attributes = True


class MemoryResponse(BaseModel):
    id: int
    content: str
    created_at: Optional[datetime] = None
    person_id: int
    emotion_tag: Optional[str] = None
    emotion_confidence: Optional[float] = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class PersonSummaryData(BaseModel):
    summary: str = Field(
        ..., min_length=1, max_length=2000, description="AI-generated summary"
    )
    key_topics: Optional[str] = None

    class Config:
        from_attributes = True


class PersonSummaryResponse(BaseModel):
    id: int
    person_id: int
    summary: str
    key_topics: Optional[str] = None
    last_summary_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class EmotionAnalysisResult(BaseModel):
    emotion_tag: str
    confidence: float
    original_text: str


class RelationshipSuggestion(BaseModel):
    person1_id: int
    person1_name: str
    person2_id: int
    person2_name: str
    reason: str
    confidence: float


class RAGQueryRequest(BaseModel):
    query: str = Field(
        ..., min_length=1, max_length=500, description="Natural language query"
    )
