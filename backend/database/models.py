from sqlalchemy import Column,String,Integer
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel,Field
Base=declarative_base()
class User(Base):
    __tablename__ = "users" 
    id=Column(Integer, primary_key=True, index=True)
    name=Column(String,nullable=False, unique=True,index=True)
    password=Column(String)
class user_data(BaseModel):  
    name: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    
    class Config:
        from_attributes = True
class UserResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True