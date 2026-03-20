import json
import os
from database import engine, Base, SessionLocal
from models import DBVideo, DBProfile, DBFolder, DBSetlist, DBSoundEffect, MASTER_PROFILE_ID, DEFAULT_PROFILE_ID

def migrate():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        if os.path.exists("profiles.json"):
            print("Migrating profiles...")
            with open("profiles.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                last_id = data.get("last_profile_id", DEFAULT_PROFILE_ID)
                with open("app_config.json", "w", encoding="utf-8") as cf:
                    json.dump({"last_profile_id": last_id}, cf)
                    
                for p in data.get("profiles", []):
                    if not db.query(DBProfile).filter(DBProfile.id == p["id"]).first():
                        db.add(DBProfile(id=p["id"], name=p.get("name", ""), config=p.get("config", {})))
            db.commit()

        if os.path.exists("playlist.json"):
            print("Migrating playlist...")
            with open("playlist.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                for v in data:
                    if not db.query(DBVideo).filter(DBVideo.id == v["id"]).first():
                        db.add(DBVideo(
                            id=v["id"],
                            title=v.get("title", ""),
                            author=v.get("author", ""),
                            youtube_url=v.get("youtube_url", ""),
                            category=v.get("category", "Uncategorized"),
                            speed=v.get("speed", "Medium"),
                            tags=v.get("tags", []),
                            duration=v.get("duration", "00:00"),
                            is_downloaded=v.get("is_downloaded", False),
                            local_file=v.get("local_file", ""),
                            thumbnail=v.get("thumbnail", ""),
                            youtube_data=v.get("youtube_data", {}),
                            added_at=v.get("added_at", "")
                        ))
            db.commit()

        if os.path.exists("folders.json"):
            print("Migrating folders...")
            with open("folders.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                for fol in data.get("folders", []):
                    if not db.query(DBFolder).filter(DBFolder.id == fol["id"]).first():
                        db.add(DBFolder(
                            id=fol["id"],
                            name=fol.get("name", ""),
                            parent_id=fol.get("parent_id"),
                            profile_id=fol.get("profile_id", DEFAULT_PROFILE_ID)
                        ))
            db.commit()

        if os.path.exists("setlists.json"):
            print("Migrating setlists...")
            with open("setlists.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                for sl in data.get("setlists", []):
                    if not db.query(DBSetlist).filter(DBSetlist.id == sl["id"]).first():
                        db.add(DBSetlist(
                            id=sl["id"],
                            name=sl.get("name", "New Setlist"),
                            profile_id=sl.get("profile_id", DEFAULT_PROFILE_ID),
                            folder_id=sl.get("folder_id"),
                            tracks=sl.get("tracks", []),
                            sublists=sl.get("sublists", [])
                        ))
            db.commit()

        if os.path.exists("sound_effects.json"):
            print("Migrating sound effects...")
            with open("sound_effects.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                for se in data.get("sound_effects", []):
                    if not db.query(DBSoundEffect).filter(DBSoundEffect.id == se["id"]).first():
                        db.add(DBSoundEffect(
                            id=se["id"],
                            name=se.get("name", "New Sound"),
                            local_file=se.get("local_file", ""),
                            source_url=se.get("source_url", ""),
                            category=se.get("category", "Uncategorized"),
                            tags=se.get("tags", []),
                            added_at=se.get("added_at", "")
                        ))
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()
        
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
