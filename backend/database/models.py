from sqlalchemy import Column, Integer, String, JSON
from database.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    score = Column(Integer, default=0)

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True, index=True)
    secret_code = Column(JSON, nullable=False)
    history = Column(JSON, default=list) # Sera se isso tira minha tabela das regras normais?
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=10)
    status = Column(String, default="active")
    user_id = Column(Integer, nullable=False)