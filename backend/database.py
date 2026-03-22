import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Resolve DB path relative to USER_DATA_DIR if set, otherwise fall back to current directory
USER_DATA_DIR = os.environ.get("USER_DATA_DIR", ".")
DB_PATH = os.path.join(USER_DATA_DIR, "app.db")

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
