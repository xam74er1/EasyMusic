import os
import uuid
import json
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Boolean, JSON, DateTime
import logging

from database import Base, SessionLocal

logger = logging.getLogger(__name__)

# ─── SQLAlchemy ORM Models ─────────────────────────────────────────

class DBVideo(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, default="")
    author = Column(String, default="")
    youtube_url = Column(String, default="")
    spotify_url = Column(String, default="")
    category = Column(String, default="Uncategorized")
    speed = Column(String, default="Medium")
    tags = Column(JSON, default=list)
    duration = Column(String, default="00:00")
    is_downloaded = Column(Boolean, default=False)
    local_file = Column(String, default="")
    thumbnail = Column(String, default="")
    youtube_data = Column(JSON, default=dict)
    added_at = Column(String, default="")
    download_error = Column(String, nullable=True)

class DBProfile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, default="New Profile")
    config = Column(JSON, default=dict)

class DBFolder(Base):
    __tablename__ = "folders"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, default="New Folder")
    parent_id = Column(String, nullable=True)
    profile_id = Column(String, default="")

class DBSetlist(Base):
    __tablename__ = "setlists"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, default="New Setlist")
    profile_id = Column(String, default="")
    folder_id = Column(String, nullable=True)
    tracks = Column(JSON, default=list)
    sublists = Column(JSON, default=list)

class DBSoundEffect(Base):
    __tablename__ = "sound_effects"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, default="New Sound")
    local_file = Column(String, default="")
    source_url = Column(String, default="")
    category = Column(String, default="Uncategorized")
    tags = Column(JSON, default=list)
    added_at = Column(String, default="")


# ─── Pydantic Schemas ──────────────────────────────────────────────

class Video(BaseModel):
    id: str
    title: str = ""
    author: str = ""
    youtube_url: str = ""
    spotify_url: str = ""
    category: str = "Uncategorized"
    speed: str = "Medium"
    tags: List[str] = []
    duration: str = "00:00"
    is_downloaded: bool = False
    local_file: str = ""
    thumbnail: str = ""
    youtube_data: dict = {}
    added_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    download_error: Optional[str] = None

class PlaylistRepo:
    def get_all(self) -> List[Video]:
        db = SessionLocal()
        try:
            items = db.query(DBVideo).all()
            return [Video(**{c.name: getattr(v, c.name) for c in DBVideo.__table__.columns}) for v in items]
        finally:
            db.close()

    def add_video(self, video: Video) -> Video:
        db = SessionLocal()
        try:
            db_video = DBVideo(**video.dict())
            db.add(db_video)
            db.commit()
            db.refresh(db_video)
            return video
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to add video: {e}")
            raise
        finally:
            db.close()

    def update_video(self, video_id: str, updated_video: Video) -> Optional[Video]:
        db = SessionLocal()
        try:
            db_video = db.query(DBVideo).filter(DBVideo.id == video_id).first()
            if db_video:
                for key, value in updated_video.dict().items():
                    setattr(db_video, key, value)
                db.commit()
                return updated_video
            return None
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update video: {e}")
            raise
        finally:
            db.close()

    def delete_video(self, video_id: str) -> bool:
        db = SessionLocal()
        try:
            affected = db.query(DBVideo).filter(DBVideo.id == video_id).delete()
            db.commit()
            return affected > 0
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete video: {e}")
            raise
        finally:
            db.close()


# ─── Profile Models ───────────────────────────────────────────────

MASTER_PROFILE_ID = "master"
DEFAULT_PROFILE_ID = "default"

class Profile(BaseModel):
    id: str = ""
    name: str = "New Profile"
    config: dict = {}

class ProfileRepo:
    def __init__(self):
        _user_data_dir = os.environ.get("USER_DATA_DIR", ".")
        self.config_path = os.path.join(_user_data_dir, "app_config.json")
        
        if not os.path.exists(self.config_path):
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump({"last_profile_id": DEFAULT_PROFILE_ID}, f)
                
        db = SessionLocal()
        try:
            # Check if master exists, to avoid unique constraint if we use try/except block just query first
            master = db.query(DBProfile).filter(DBProfile.id == MASTER_PROFILE_ID).first()
            if not master:
                db.add(DBProfile(id=MASTER_PROFILE_ID, name="Master", config={}))
            
            default_p = db.query(DBProfile).filter(DBProfile.id == DEFAULT_PROFILE_ID).first()
            if not default_p:
                db.add(DBProfile(id=DEFAULT_PROFILE_ID, name="Default", config={}))
            
            db.commit()
        except Exception as e:
            # During migration step the table might not be created yet, so ignore errors
            db.rollback()
            logger.warning(f"Failed to initialize profiles (table might not exist yet): {e}")
        finally:
            db.close()

    def get_all(self) -> List[Profile]:
        db = SessionLocal()
        try:
            items = db.query(DBProfile).all()
            return [Profile(**{c.name: getattr(p, c.name) for c in DBProfile.__table__.columns}) for p in items]
        finally:
            db.close()

    def get_last_profile_id(self) -> str:
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("last_profile_id", DEFAULT_PROFILE_ID)
        except Exception:
            return DEFAULT_PROFILE_ID

    def set_last_profile_id(self, profile_id: str):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"last_profile_id": profile_id}, f)

    def get_by_id(self, profile_id: str) -> Optional[Profile]:
        db = SessionLocal()
        try:
            db_profile = db.query(DBProfile).filter(DBProfile.id == profile_id).first()
            if db_profile:
                return Profile(**{c.name: getattr(db_profile, c.name) for c in DBProfile.__table__.columns})
            return None
        finally:
            db.close()

    def create(self, profile: Profile) -> Profile:
        if not profile.id:
            profile.id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db_profile = DBProfile(**profile.dict())
            db.add(db_profile)
            db.commit()
            return profile
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create profile: {e}")
            raise
        finally:
            db.close()

    def update(self, profile_id: str, updated: Profile) -> Optional[Profile]:
        db = SessionLocal()
        try:
            db_profile = db.query(DBProfile).filter(DBProfile.id == profile_id).first()
            if db_profile:
                if profile_id == MASTER_PROFILE_ID:
                    db_profile.config = updated.dict().get("config", {})
                    updated.name = db_profile.name
                    updated.id = db_profile.id
                else:
                    for key, value in updated.dict().items():
                        setattr(db_profile, key, value)
                db.commit()
                return updated
            return None
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update profile: {e}")
            raise
        finally:
            db.close()

    def delete(self, profile_id: str) -> bool:
        if profile_id in (MASTER_PROFILE_ID, DEFAULT_PROFILE_ID):
            return False
        db = SessionLocal()
        try:
            affected = db.query(DBProfile).filter(DBProfile.id == profile_id).delete()
            db.commit()
            if affected > 0:
                if self.get_last_profile_id() == profile_id:
                    self.set_last_profile_id(DEFAULT_PROFILE_ID)
                return True
            return False
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete profile: {e}")
            raise
        finally:
            db.close()


# ─── Folder Models ────────────────────────────────────────────────

class Folder(BaseModel):
    id: str = ""
    name: str = "New Folder"
    parent_id: Optional[str] = None
    profile_id: str = DEFAULT_PROFILE_ID

class FolderRepo:
    def get_all(self, profile_id: Optional[str] = None) -> List[Folder]:
        db = SessionLocal()
        try:
            query = db.query(DBFolder)
            if profile_id and profile_id != MASTER_PROFILE_ID:
                query = query.filter(DBFolder.profile_id == profile_id)
            items = query.all()
            return [Folder(**{c.name: getattr(f, c.name) for c in DBFolder.__table__.columns}) for f in items]
        finally:
            db.close()

    def get_by_id(self, folder_id: str) -> Optional[Folder]:
        db = SessionLocal()
        try:
            db_folder = db.query(DBFolder).filter(DBFolder.id == folder_id).first()
            if db_folder:
                return Folder(**{c.name: getattr(db_folder, c.name) for c in DBFolder.__table__.columns})
            return None
        finally:
            db.close()

    def create(self, folder: Folder) -> Folder:
        if not folder.id:
            folder.id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db_folder = DBFolder(**folder.dict())
            db.add(db_folder)
            db.commit()
            return folder
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create folder: {e}")
            raise
        finally:
            db.close()

    def update(self, folder_id: str, updated: Folder) -> Optional[Folder]:
        db = SessionLocal()
        try:
            db_folder = db.query(DBFolder).filter(DBFolder.id == folder_id).first()
            if db_folder:
                for key, value in updated.dict().items():
                    setattr(db_folder, key, value)
                db.commit()
                return updated
            return None
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update folder: {e}")
            raise
        finally:
            db.close()

    def delete(self, folder_id: str) -> bool:
        db = SessionLocal()
        try:
            affected = db.query(DBFolder).filter(DBFolder.id == folder_id).delete()
            db.commit()
            return affected > 0
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete folder: {e}")
            raise
        finally:
            db.close()

    def delete_by_profile(self, profile_id: str) -> int:
        db = SessionLocal()
        try:
            affected = db.query(DBFolder).filter(DBFolder.profile_id == profile_id).delete()
            db.commit()
            return affected
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete folders by profile: {e}")
            raise
        finally:
            db.close()


# ─── Setlist Models ───────────────────────────────────────────────

class SubSetlist(BaseModel):
    id: str = ""
    name: str = "Untitled"
    tracks: List[str] = []

class Setlist(BaseModel):
    id: str = ""
    name: str = "New Setlist"
    profile_id: str = DEFAULT_PROFILE_ID
    folder_id: Optional[str] = None
    tracks: List[str] = []
    sublists: List[SubSetlist] = []

class SetlistRepo:
    def get_all(self, profile_id: Optional[str] = None) -> List[Setlist]:
        db = SessionLocal()
        try:
            query = db.query(DBSetlist)
            if profile_id and profile_id != MASTER_PROFILE_ID:
                query = query.filter(DBSetlist.profile_id == profile_id)
            items = query.all()
            
            result = []
            for item in items:
                d = {c.name: getattr(item, c.name) for c in DBSetlist.__table__.columns}
                result.append(Setlist(**d))
            return result
        finally:
            db.close()

    def get_by_id(self, setlist_id: str) -> Optional[Setlist]:
        db = SessionLocal()
        try:
            db_setlist = db.query(DBSetlist).filter(DBSetlist.id == setlist_id).first()
            if db_setlist:
                d = {c.name: getattr(db_setlist, c.name) for c in DBSetlist.__table__.columns}
                return Setlist(**d)
            return None
        finally:
            db.close()

    def create(self, setlist: Setlist) -> Setlist:
        if not setlist.id:
            setlist.id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db_setlist = DBSetlist(**setlist.dict())
            db.add(db_setlist)
            db.commit()
            return setlist
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create setlist: {e}")
            raise
        finally:
            db.close()

    def update(self, setlist_id: str, updated: Setlist) -> Optional[Setlist]:
        db = SessionLocal()
        try:
            db_setlist = db.query(DBSetlist).filter(DBSetlist.id == setlist_id).first()
            if db_setlist:
                for key, value in updated.dict().items():
                    setattr(db_setlist, key, value)
                db.commit()
                return updated
            return None
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update setlist: {e}")
            raise
        finally:
            db.close()

    def delete(self, setlist_id: str) -> bool:
        db = SessionLocal()
        try:
            affected = db.query(DBSetlist).filter(DBSetlist.id == setlist_id).delete()
            db.commit()
            return affected > 0
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete setlist: {e}")
            raise
        finally:
            db.close()

    def delete_by_profile(self, profile_id: str) -> int:
        db = SessionLocal()
        try:
            affected = db.query(DBSetlist).filter(DBSetlist.profile_id == profile_id).delete()
            db.commit()
            return affected
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete setlists by profile: {e}")
            raise
        finally:
            db.close()


# ─── Sound Effect Models ──────────────────────────────────────────

class SoundEffect(BaseModel):
    id: str = ""
    name: str = "New Sound"
    local_file: str = ""
    source_url: str = ""
    category: str = "Uncategorized"
    tags: list[str] = []
    added_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class SoundEffectRepo:
    def get_all(self) -> List[SoundEffect]:
        db = SessionLocal()
        try:
            items = db.query(DBSoundEffect).all()
            return [SoundEffect(**{c.name: getattr(s, c.name) for c in DBSoundEffect.__table__.columns}) for s in items]
        finally:
            db.close()

    def get_by_id(self, effect_id: str) -> Optional[SoundEffect]:
        db = SessionLocal()
        try:
            db_effect = db.query(DBSoundEffect).filter(DBSoundEffect.id == effect_id).first()
            if db_effect:
                return SoundEffect(**{c.name: getattr(db_effect, c.name) for c in DBSoundEffect.__table__.columns})
            return None
        finally:
            db.close()

    def create(self, effect: SoundEffect) -> SoundEffect:
        if not effect.id:
            effect.id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db_effect = DBSoundEffect(**effect.dict())
            db.add(db_effect)
            db.commit()
            return effect
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create sound effect: {e}")
            raise
        finally:
            db.close()

    def delete(self, effect_id: str) -> bool:
        db = SessionLocal()
        try:
            affected = db.query(DBSoundEffect).filter(DBSoundEffect.id == effect_id).delete()
            db.commit()
            return affected > 0
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete sound effect: {e}")
            raise
        finally:
            db.close()
