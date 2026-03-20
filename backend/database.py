import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# The database will be created in the current working directory
DB_PATH = "app.db"

# connect_args={"check_same_thread": False} is required for SQLite in FastAPI/multithreaded environments
engine = create_engine(
    f"sqlite:///{DB_PATH}", 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
