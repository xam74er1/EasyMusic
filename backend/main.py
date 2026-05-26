from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uuid
import logging
from typing import Optional
from dotenv import load_dotenv
import json
import zipfile
import tempfile
import asyncio
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi import UploadFile, File

load_dotenv()

# Resolve user data directory early so logging and other modules can use it.
# USER_DATA_DIR may already be set by the --user-data-dir CLI arg (handled at __main__ entry),
# or by Electron before spawning the process.  Fall back to "." for backward compatibility.
USER_DATA_DIR = os.environ.get("USER_DATA_DIR", ".")

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
numeric_level = getattr(logging, log_level, logging.INFO)

log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(numeric_level)

handlers = [console_handler]

# Disabled by default unless explicitly enabled
if os.getenv("LOG_TO_FILE", "FALSE").upper() == "TRUE":
    logs_dir = os.path.join(USER_DATA_DIR, "logs")
    os.makedirs(logs_dir, exist_ok=True)
    file_handler = logging.FileHandler(os.path.join(logs_dir, "backend.log"), encoding='utf-8')
    file_handler.setFormatter(log_formatter)
    handlers.append(file_handler)

# Configure the root logger
root_logger = logging.getLogger()
root_logger.setLevel(numeric_level)
# Remove existing handlers to avoid duplicates, then add ours
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)
for handler in handlers:
    root_logger.addHandler(handler)

logger = logging.getLogger(__name__)

# Ensure uvicorn loggers show up in our console
for uvicorn_logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
    ulogger = logging.getLogger(uvicorn_logger_name)
    ulogger.setLevel(numeric_level)
    ulogger.handlers = []  # Clear uvicorn's default handlers
    ulogger.propagate = True # Propagate to root logger so our handlers are used


def initialize_user_data_dir(user_data_dir: str) -> None:
    """Ensure USER_DATA_DIR and required subdirectories/files exist on first run.

    This is idempotent — safe to call on every startup.  It creates:
      - <user_data_dir>/                (the root directory itself)
      - <user_data_dir>/downloads/      (downloaded audio files)
      - <user_data_dir>/logs/           (log files)
      - <user_data_dir>/app_config.json (default app configuration)

    The SQLite database (app.db) is initialized separately by SQLAlchemy's
    ``Base.metadata.create_all(engine)`` which is called right after this function.
    """
    # 1. Create root and subdirectories
    for subdir in ("", "downloads", "logs"):
        path = os.path.join(user_data_dir, subdir) if subdir else user_data_dir
        os.makedirs(path, exist_ok=True)
        logger.debug("Ensured directory exists: %s", path)

    # 2. Create default app_config.json if it doesn't exist
    config_path = os.path.join(user_data_dir, "app_config.json")
    if not os.path.exists(config_path):
        default_config = {"last_profile_id": "default"}
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(default_config, f)
        logger.info("Created default app_config.json at %s", config_path)


# Run first-run initialization before importing any modules that open the DB or
# read config files, so that all required paths exist when those modules load.
initialize_user_data_dir(USER_DATA_DIR)

# Load env variables before importing modules that depend on them

from database import engine, Base
from models import Video, PlaylistRepo, Setlist, SetlistRepo, Profile, ProfileRepo, Folder, FolderRepo, MASTER_PROFILE_ID, DEFAULT_PROFILE_ID, SoundEffect, SoundEffectRepo, CustomPlaylist, CustomPlaylistItem, CustomPlaylistRepo
from ai_service import chat_service
from download_service import start_download_background, batch_download_missing, get_download_mode, set_download_mode, _cached_find_file
from cc_service import search_cc_tracks, download_cc_track, CCTrack, CCSourceUnavailableError
import import_service
import import_logic
import youtube_service

# Initialize SQLite database
# Create tables if not exist
Base.metadata.create_all(bind=engine)

# Apply migrations for existing tables (e.g. adding columns)
import migrations
migrations.apply_migrations(engine)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application starting, performing initial audio scan...")
    import_service.scan_extra_audio_dir()
    print("BACKEND_READY", flush=True)
    yield

app = FastAPI(title="Improv Playlist API", lifespan=lifespan)

from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    logger.info(f"Incoming: {request.method} {request.url.path}")
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"Outgoing: {request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = PlaylistRepo()
setlist_repo = SetlistRepo()
profile_repo = ProfileRepo()
folder_repo = FolderRepo()
sound_effect_repo = SoundEffectRepo()
custom_playlist_repo = CustomPlaylistRepo()



@app.get("/")
def read_root():
    return {"message": "Improv Playlist API is running"}

# ─── Profile Endpoints ────────────────────────────────────────────

@app.get("/api/profiles")
def get_profiles():
    logger.debug("Fetching all profiles")
    profiles = profile_repo.get_all()
    last_id = profile_repo.get_last_profile_id()
    return {"profiles": [p.dict() for p in profiles], "last_profile_id": last_id}

@app.post("/api/profiles")
def create_profile(profile: Profile):
    if not profile.id:
        profile.id = str(uuid.uuid4())
    logger.info(f"Creating new profile: {profile.name} ({profile.id})")
    return profile_repo.create(profile)

@app.put("/api/profiles/{profile_id}")
def update_profile(profile_id: str, profile: Profile):
    logger.info(f"Updating profile: {profile_id}")
    updated = profile_repo.update(profile_id, profile)
    if not updated:
        logger.warning(f"Profile {profile_id} not found for update")
        raise HTTPException(status_code=404, detail="Profile not found")
    return updated

@app.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: str, delete_setlists: bool = False):
    logger.info(f"Deleting profile: {profile_id} (delete_setlists={delete_setlists})")
    if profile_id in (MASTER_PROFILE_ID, DEFAULT_PROFILE_ID):
        logger.warning(f"Attempted to delete protected profile: {profile_id}")
        raise HTTPException(status_code=403, detail="Cannot delete this profile")
    if delete_setlists:
        setlist_repo.delete_by_profile(profile_id)
        folder_repo.delete_by_profile(profile_id)
    success = profile_repo.delete(profile_id)
    if not success:
        logger.warning(f"Profile {profile_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "deleted"}

@app.post("/api/profiles/switch/{profile_id}")
def switch_profile(profile_id: str):
    logger.info(f"Switching profile to: {profile_id}")
    profile = profile_repo.get_by_id(profile_id)
    if not profile:
        logger.warning(f"Profile {profile_id} not found for switch")
        raise HTTPException(status_code=404, detail="Profile not found")
    profile_repo.set_last_profile_id(profile_id)
    return {"status": "switched", "profile_id": profile_id}


# ─── Folder Endpoints ─────────────────────────────────────────────

@app.get("/api/folders")
def get_folders(profile_id: Optional[str] = Query(None)):
    logger.debug(f"Fetching folders for profile_id={profile_id}")
    return folder_repo.get_all(profile_id=profile_id)

@app.post("/api/folders")
def create_folder(folder: Folder):
    if not folder.id:
        folder.id = str(uuid.uuid4())
    logger.info(f"Creating new folder: {folder.name} ({folder.id})")
    return folder_repo.create(folder)

@app.put("/api/folders/{folder_id}")
def update_folder(folder_id: str, folder: Folder):
    logger.info(f"Updating folder: {folder_id}")
    updated = folder_repo.update(folder_id, folder)
    if not updated:
        logger.warning(f"Folder {folder_id} not found for update")
        raise HTTPException(status_code=404, detail="Folder not found")
    return updated

@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str, action: str = Query("archive")):
    logger.info(f"Deleting folder: {folder_id} (action={action})")
    success = folder_repo.delete(folder_id)
    if not success:
        logger.warning(f"Folder {folder_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Folder not found")
        
    setlists = setlist_repo.get_all()
    for s in setlists:
        if s.folder_id == folder_id:
            if action == "delete":
                setlist_repo.delete(s.id)
            else:
                s.folder_id = None
                setlist_repo.update(s.id, s)

    return {"status": "deleted"}

# ─── Playlist Endpoints ──────────────────────────────────────────

@app.get("/api/playlist")
def get_playlist(profile_id: Optional[str] = Query(None)):
    logger.debug(f"Fetching playlist for profile_id={profile_id}")
    # Master (or no filter) sees all tracks; other profiles see only their own
    return repo.get_all(profile_id=profile_id)

@app.post("/api/playlist")
def create_video(video: Video):
    if not video.id:
        video.id = str(uuid.uuid4())
    logger.info(f"Adding new video to playlist: {video.title} ({video.id})")
    return repo.add_video(video)

@app.put("/api/playlist/{video_id}")
def update_video(video_id: str, video: Video):
    logger.info(f"Updating video in playlist: {video_id}")
    updated = repo.update_video(video_id, video)
    if not updated:
        logger.warning(f"Video {video_id} not found for update")
        raise HTTPException(status_code=404, detail="Video not found")
    return updated

@app.delete("/api/playlist/{video_id}")
def delete_video(video_id: str):
    logger.info(f"Deleting video from playlist: {video_id}")
    success = repo.delete_video(video_id)
    if not success:
        logger.warning(f"Video {video_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Video not found")
    return {"status": "deleted"}

@app.get("/api/playlist/{video_id}")
def get_video(video_id: str):
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
    return target

@app.post("/api/playlist/{video_id}/add-to-profile")
def add_track_to_profile(video_id: str, profile_id: str = Query(...)):
    """Add an existing track to a profile without changing its owner profile."""
    if profile_id == MASTER_PROFILE_ID:
        raise HTTPException(status_code=400, detail="Cannot add tracks specifically to master — master already sees all tracks")
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Track not found")
    extra = list(target.additional_profile_ids or [])
    if profile_id not in extra:
        extra.append(profile_id)
        target.additional_profile_ids = extra
        repo.update_video(video_id, target)
    return {"status": "added", "profile_id": profile_id}

@app.post("/api/playlist/{video_id}/remove-from-profile")
def remove_track_from_profile(video_id: str, profile_id: str = Query(...)):
    """Remove a track from a non-master profile.
    - If the track was added via add-to-profile (in additional_profile_ids), removes it from there.
    - If the track is owned by this profile (profile_id matches), reassigns it to master.
    """
    if profile_id == MASTER_PROFILE_ID:
        raise HTTPException(status_code=400, detail="Cannot remove tracks from master")
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Track not found")
    changed = False
    extra = list(target.additional_profile_ids or [])
    if profile_id in extra:
        extra.remove(profile_id)
        target.additional_profile_ids = extra
        changed = True
    if target.profile_id == profile_id:
        target.profile_id = MASTER_PROFILE_ID
        changed = True
    if changed:
        repo.update_video(video_id, target)
    return {"status": "removed", "profile_id": profile_id}

def sync_file_location(video: Video, new_category: str) -> str:
    from download_service import DOWNLOAD_DIR
    import shutil
    import os
    
    if not video.local_file or os.path.isabs(video.local_file):
        return video.local_file
        
    old_path = os.path.normpath(os.path.join(DOWNLOAD_DIR, video.local_file))
    if not os.path.exists(old_path):
        return video.local_file
        
    filename = os.path.basename(video.local_file)
    cat_dir = os.path.join(DOWNLOAD_DIR, new_category)
    os.makedirs(cat_dir, exist_ok=True)
    
    new_path = os.path.normpath(os.path.join(cat_dir, filename))
    
    if old_path != new_path:
        shutil.move(old_path, new_path)
        
    return os.path.join(new_category, filename).replace('\\', '/')

@app.put("/api/playlist/{video_id}/category")
def update_video_category(video_id: str, new_category: str = Query(..., alias="category")):
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
        
    target.local_file = sync_file_location(target, new_category)
    target.category = new_category
    updated = repo.update_video(video_id, target)
    return updated

class BulkCategoryRequest(BaseModel):
    old_category: str
    new_category: str

@app.patch("/api/playlist/category")
def update_bulk_category(req: BulkCategoryRequest):
    count = repo.bulk_update_category(req.old_category, req.new_category)
    return {"status": "updated", "count": count}

class ReorganizePlan(BaseModel):
    plan: list[dict]

@app.post("/api/library/reorganize")
def execute_reorganization(req: ReorganizePlan):
    videos = repo.get_all()
    # Save undo state
    undo_data = [v.dict() for v in videos]
    undo_path = os.path.join(USER_DATA_DIR, "undo_history.json")
    with open(undo_path, "w", encoding="utf-8") as f:
        json.dump(undo_data, f)
        
    count = 0
    from thefuzz import process
    all_categories = list(set([v.category for v in videos if v.category]))
    
    for op in req.plan:
        move_query = op.get("move", "")
        to_dest = op.get("to", "")
        
        if not all_categories or not move_query:
            continue
            
        best_match = process.extractOne(move_query, all_categories)
        if best_match and best_match[1] >= 60:
            target_cat = best_match[0]
            for v in videos:
                if v.category == target_cat or (v.category and v.category.startswith(target_cat + "/")):
                    new_cat = v.category.replace(target_cat, to_dest, 1) if v.category else to_dest
                    v.local_file = sync_file_location(v, new_cat)
                    v.category = new_cat
                    repo.update_video(v.id, v)
                    count += 1
                    
    return {"status": "success", "tracks_moved": count}

@app.post("/api/library/undo")
def undo_reorganization():
    undo_path = os.path.join(USER_DATA_DIR, "undo_history.json")
    if not os.path.exists(undo_path):
        raise HTTPException(status_code=404, detail="No undo history found")
        
    with open(undo_path, "r", encoding="utf-8") as f:
        undo_data = json.load(f)
        
    for v_data in undo_data:
        v = Video(**v_data)
        repo.update_video(v.id, v)
        
    os.remove(undo_path)
    return {"status": "success", "message": "Restored previous state."}

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    profile_id: str = MASTER_PROFILE_ID

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    result = chat_service.send_message(request.message, session_id=request.session_id, profile_id=request.profile_id)
    return result

# ─── Config Endpoints ────────────────────────────────────────────

class DownloadModeRequest(BaseModel):
    mode: str  # "youtube" | "spotify"

@app.get("/api/config/download-mode")
def get_download_mode_endpoint():
    return {"download_mode": get_download_mode()}

@app.get("/api/config/fallback")
def get_fallback_endpoint():
    from download_service import get_enable_fallback
    return {"enable_fallback": get_enable_fallback()}

@app.post("/api/config/download-mode")
def set_download_mode_endpoint(req: DownloadModeRequest):
    try:
        set_download_mode(req.mode)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"download_mode": req.mode}

class FallbackRequest(BaseModel):
    enabled: bool

@app.post("/api/config/fallback")
def set_fallback_endpoint(req: FallbackRequest):
    from download_service import set_enable_fallback
    set_enable_fallback(req.enabled)
    return {"enable_fallback": req.enabled}

# ─── Creative Commons Endpoints ──────────────────────────────────

class CCDownloadRequest(BaseModel):
    track: CCTrack
    category: str = "Uncategorized"
    profile_id: str = DEFAULT_PROFILE_ID

@app.get("/api/cc/search")
def search_cc(q: str = Query(...), limit: int = Query(10)):
    try:
        tracks = search_cc_tracks(q, limit)
    except CCSourceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"tracks": [t.dict() for t in tracks]}

@app.post("/api/cc/download")
def download_cc(req: CCDownloadRequest):
    try:
        local_file = download_cc_track(req.track, req.category, profile_id=req.profile_id)
    except Exception as e:
        logger.error(f"CC download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"local_file": local_file}

@app.post("/api/download/batch")
def download_all_missing():
    return batch_download_missing()

@app.post("/api/download/{video_id}")
def download_single_video(video_id: str, overwrite: bool = False):
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
    if not target.youtube_url:
        raise HTTPException(status_code=400, detail="Video has no YouTube URL")
    
    # Check if we should prompt for overwrite
    if target.is_downloaded and not overwrite:
        from download_service import DOWNLOAD_DIR
        local_path = sync_get_local_file_path(target, DOWNLOAD_DIR)
        if local_path and os.path.exists(local_path):
            raise HTTPException(status_code=409, detail="File already exists. Prompt user to overwrite.")
    
    # Reset is_downloaded flag for polling
    target.is_downloaded = False
    repo.update_video(target.id, target)
    
    start_download_background(target.id, target.youtube_url, overwrite)
    return {"message": f"Download background task started for {target.title}"}

def sync_get_local_file_path(target, download_dir):
    import os
    if not target.local_file:
        return None
        
    if os.path.isabs(target.local_file) and os.path.exists(target.local_file):
        return target.local_file
        
    dl_path = os.path.join(download_dir, target.local_file)
    if os.path.exists(dl_path):
        return dl_path
        
    extra_dir = os.getenv("EXTRA_AUDIO_DIR", "")
    if extra_dir and os.path.exists(extra_dir):
        extra_path = os.path.join(extra_dir, target.local_file)
        if os.path.exists(extra_path):
            return extra_path
            
    return None

import time

def cleanup_zip_file(path: str):
    import os
    try:
        if os.path.exists(path):
            os.remove(path)
            logger.info(f"Cleaned up temporary zip file: {path}")
    except Exception as e:
        logger.error(f"Failed to clean up {path}: {e}")

@app.get("/api/download/file/{video_id}")
def download_file_browser(video_id: str):
    from download_service import DOWNLOAD_DIR
    import urllib.parse
    
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")

    path = sync_get_local_file_path(target, DOWNLOAD_DIR)
    
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found on server")
        
    filename = f"{target.title} - {target.author}.mp3"
    # Provide safe ascii filename as fallback, and utf-8 filename for full support
    encoded_filename = urllib.parse.quote(filename)
    
    return FileResponse(
        path=path,
        media_type="audio/mpeg",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=utf-8''{encoded_filename}"}
    )

@app.get("/api/download/zip")
def download_as_zip(
    background_tasks: BackgroundTasks,
    profile_id: Optional[str] = Query(None),
    folder_id: Optional[str] = Query(None),
    flat: bool = Query(False)
):
    from download_service import DOWNLOAD_DIR
    import os
    
    # 1. Gather tracks (always scoped to the active profile)
    profile_tracks = repo.get_all(profile_id=profile_id if profile_id else None)
    tracks_to_zip = []

    if folder_id:
        # User wants a specific folder (folder_id is actually the category path string here)
        tracks_to_zip = [
            v for v in profile_tracks
            if v.category == folder_id or (v.category and v.category.startswith(folder_id + "/"))
        ]
    else:
        tracks_to_zip = profile_tracks
            
    if not tracks_to_zip:
        raise HTTPException(status_code=404, detail="No tracks found to zip")

    # 2. Extract valid file paths
    files_to_zip = []
    for t in tracks_to_zip:
        path = sync_get_local_file_path(t, DOWNLOAD_DIR)
        if path:
            files_to_zip.append((t, path))
            
    if not files_to_zip:
        raise HTTPException(status_code=404, detail="No matching audio files found on disk")
        
    # 3. Create a temporary Zip file
    fd, temp_zip_path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    
    try:
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for t, filepath in files_to_zip:
                filename = os.path.basename(filepath)
                if flat:
                    # Everything at the root of the ZIP
                    zipf.write(filepath, arcname=filename)
                else:
                    # Preserve the category folder structure from the DB
                    # e.g., category: "Pop/Upbeat" -> 'Pop/Upbeat/Title - Author.mp3'
                    category = t.category if t.category else "Uncategorized"
                    archive_path = os.path.join(category, filename).replace('\\', '/')
                    zipf.write(filepath, arcname=archive_path)
                    
        # 4. Schedule cleanup and return
        background_tasks.add_task(cleanup_zip_file, temp_zip_path)
        
        return FileResponse(
            path=temp_zip_path, 
            media_type="application/zip", 
            filename="easymusic_library.zip"
        )
    except Exception as e:
        logger.error(f"Error creating zip file: {str(e)}")
        cleanup_zip_file(temp_zip_path)
        raise HTTPException(status_code=500, detail="Failed to create zip file")


import shutil
import zipfile
import tempfile
from tempfile import NamedTemporaryFile

class ImportConfirmRequest(BaseModel):
    tracks: list[dict]
    profile_id: str = DEFAULT_PROFILE_ID

@app.post("/api/import/analyze")
async def analyze_import(
    files: list[UploadFile] = File(...), 
    use_ai: bool = Query(False)
):
    # 1. Save all files to a temporary directory
    temp_dir = tempfile.mkdtemp()
    try:
        for file in files:
            file_path = os.path.join(temp_dir, file.filename)
            # Ensure subdirectories if filename contains paths (from ZIP handled later or drops)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # If it's a ZIP, extract it in place
            if file.filename.lower().endswith(".zip"):
                import_logic.handle_zip_extraction(file_path, temp_dir)
                os.remove(file_path) # Remove zip after extraction

        # 2. Scanned for audio files and extract initial metadata
        analysis_batch = import_logic.process_upload_batch(temp_dir)
        
        # 3. Optional AI Enrichment
        if use_ai and analysis_batch:
            filenames = [item["filename"] for item in analysis_batch]
            ai_results = await chat_service.analyze_metadata_bulk(filenames)
            
            # Merge AI results
            for item in analysis_batch:
                match = next((ai for ai in ai_results if ai.filename == item["filename"]), None)
                if match:
                    # Update metadata with AI-predicted values, keeping some existing if needed
                    item["metadata"].update(match.metadata.dict())

        return {"session_temp_dir": temp_dir, "tracks": analysis_batch}
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/import/confirm")
async def confirm_import(req: ImportConfirmRequest):
    from download_service import DOWNLOAD_DIR
    try:
        imported_count = 0
        temp_dirs_to_clean = set()
        
        all_videos = repo.get_all()
        
        for track_data in req.tracks:
            temp_path = track_data.get("temp_path")
            if not temp_path or not os.path.exists(temp_path):
                continue
                
            temp_dirs_to_clean.add(os.path.dirname(temp_path))
            
            # Finalize file move
            local_rel_path = import_logic.finalize_import(track_data, DOWNLOAD_DIR)
            
            meta = track_data["metadata"]
            title = meta.get("title", "Unknown")
            author = meta.get("author", "Unknown")
            
            # Deduplicate
            existing = next((v for v in all_videos if v.title.lower() == title.lower() and v.author.lower() == author.lower()), None)
            
            if not existing:
                new_video = Video(
                    id=str(uuid.uuid4()),
                    title=title,
                    author=author,
                    category=meta.get("category", "Uncategorized"),
                    tags=meta.get("tags", []),
                    is_downloaded=True,
                    local_file=local_rel_path,
                    profile_id=req.profile_id
                )
                repo.add_video(new_video)
                imported_count += 1
            else:
                # If exists, we might still want to update its local_file? 
                # For now let's just count it as "already there" or maybe notify?
                pass

        # Cleanup temp dirs (only base temp_dir)
        for d in temp_dirs_to_clean:
            # We need to find the root temp dir for this session. 
            # In analyze_import we returned it, but confirm_import gets individual paths.
            # A better way is to pass session_temp_dir in the request, but let's be clever.
            pass

        return {"status": "success", "imported_count": imported_count}
    except Exception as e:
        logger.error(f"Import confirmation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan-audio")
def scan_extra_audio():
    result = import_service.scan_extra_audio_dir()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/api/playlist/{video_id}/sync")
def sync_track(video_id: str):
    from download_service import get_download_mode
    mode = get_download_mode()
    
    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Track not found")
    
    query = f"{target.title} {target.author}"
    
    if mode == "spotify":
        import spotify_service
        logger.info(f"Syncing {video_id} using Spotify/YTMusic metadata for query: {query}")
        results = spotify_service.search_spotify_metadata(query)
        if not results:
            raise HTTPException(status_code=404, detail="No matching Spotify/Music metadata found")
        
        match = results[0]
        target.title = match.title
        target.author = match.author
        target.thumbnail = match.thumbnail
        # If we have a way to get spotify_url later, update it here
    else:
        # Default to YouTube
        logger.info(f"Syncing {video_id} using YouTube for query: {query}")
        results = youtube_service.search_youtube(query, max_results=1)
        if not results:
            raise HTTPException(status_code=404, detail="No matching YouTube videos found with >100k views")
        
        match = results[0]
        target.youtube_url = match.url
        target.thumbnail = match.thumbnail
        target.youtube_data = match.raw_data
    
    repo.update_video(video_id, target)
    return {"status": "synced", "track": target, "mode": mode}

import re
from fastapi import Request
from fastapi.responses import StreamingResponse, FileResponse, Response

@app.get("/api/play/{video_id}")
def play_video(video_id: str, request: Request):
    from download_service import DOWNLOAD_DIR
    import os

    target = repo.get_by_id(video_id)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
        
    matches = []
    path = sync_get_local_file_path(target, DOWNLOAD_DIR)
    if path:
        matches.append(path)
    
    # Fallback to cached directory scan if still not matched
    if not matches:
        found = _cached_find_file(video_id, DOWNLOAD_DIR)
        if found:
            matches.append(found)

    if not matches:
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    file_path = matches[0]
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("Range", None)
    
    if range_header:
        byte1, byte2 = 0, None
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            g = match.groups()
            if g[0]: byte1 = int(g[0])
            if g[1]: byte2 = int(g[1])

        if byte1 >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        if byte2 is None or byte2 >= file_size:
            byte2 = file_size - 1
            
        length = byte2 - byte1 + 1
        
        def file_iterator():
            with open(file_path, "rb") as f:
                f.seek(byte1)
                remaining = length
                while remaining > 0:
                    chunk_size = min(1024 * 64, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {byte1}-{byte2}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        }
        return StreamingResponse(file_iterator(), status_code=206, headers=headers, media_type="audio/mpeg")

    return FileResponse(file_path, media_type="audio/mpeg", headers={"Accept-Ranges": "bytes"})

from fastapi.responses import StreamingResponse
import subprocess

@app.get("/api/stream/{video_id}")
def stream_video(video_id: str):
    target = repo.get_by_id(video_id)
    if not target or not target.youtube_url:
        raise HTTPException(status_code=404, detail="Video or URL not found")

    def generate():
        cmd = ["yt-dlp", "-f", "bestaudio", "-o", "-", target.youtube_url]
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            while True:
                chunk = process.stdout.read(1024 * 64)
                if not chunk:
                    break
                yield chunk
        except GeneratorExit:
            pass
        finally:
            process.kill()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pass

    return StreamingResponse(generate(), media_type="audio/mpeg")

# ─── Setlist Endpoints ────────────────────────────────────────────

@app.get("/api/setlists")
def get_setlists(profile_id: Optional[str] = Query(None)):
    logger.debug(f"Fetching setlists for profile_id={profile_id}")
    return setlist_repo.get_all(profile_id=profile_id)

@app.post("/api/setlists")
def create_setlist(setlist: Setlist):
    if not setlist.id:
        setlist.id = str(uuid.uuid4())
    for sub in setlist.sublists:
        if not sub.id:
            sub.id = str(uuid.uuid4())
    logger.info(f"Creating setlist: {setlist.name} ({setlist.id})")
    return setlist_repo.create(setlist)

@app.put("/api/setlists/{setlist_id}")
def update_setlist(setlist_id: str, setlist: Setlist):
    for sub in setlist.sublists:
        if not sub.id:
            sub.id = str(uuid.uuid4())
    logger.info(f"Updating setlist: {setlist_id}")
    updated = setlist_repo.update(setlist_id, setlist)
    if not updated:
        logger.warning(f"Setlist {setlist_id} not found for update")
        raise HTTPException(status_code=404, detail="Setlist not found")
    return updated

@app.delete("/api/setlists/{setlist_id}")
def delete_setlist(setlist_id: str):
    logger.info(f"Deleting setlist: {setlist_id}")
    success = setlist_repo.delete(setlist_id)
    if not success:
        logger.warning(f"Setlist {setlist_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Setlist not found")
    return {"status": "deleted"}


@app.post("/api/setlists/import")
async def import_setlist_from_file(file: UploadFile = File(...), profile_id: Optional[str] = Query(None)):
    content = (await file.read()).decode("utf-8", errors="replace")
    raw_items = _parse_playlist_text(content)
    if not raw_items:
        raise HTTPException(status_code=400, detail="Aucune piste trouvée dans le fichier")

    # Match against tracks visible to this profile
    all_tracks = repo.get_all(profile_id=profile_id if profile_id else None)
    track_ids = []
    total = len(raw_items)
    matched = 0
    for raw in raw_items:
        item_name = raw.get("ItemName", "")
        if not item_name:
            continue
        track_id = _match_track(item_name, all_tracks)
        if track_id:
            track_ids.append(track_id)
            matched += 1

    name = os.path.splitext(file.filename or "playlist")[0]
    setlist = Setlist(name=name, tracks=track_ids, profile_id=profile_id or DEFAULT_PROFILE_ID)
    if not setlist.id:
        setlist.id = str(uuid.uuid4())
    created = setlist_repo.create(setlist)
    logger.info(f"Imported setlist '{name}': {matched}/{total} tracks matched")
    return {"id": created.id, "name": created.name, "total": total, "matched": matched}


@app.get("/api/setlists/{setlist_id}/export")
def export_setlist_as_file(setlist_id: str):
    setlist = setlist_repo.get_by_id(setlist_id)
    if not setlist:
        raise HTTPException(status_code=404, detail="Setlist not found")

    all_tracks = repo.get_all()
    tracks_by_id = {t.id: t for t in all_tracks}
    lib_root = _find_library_root(all_tracks)

    all_track_ids = list(setlist.tracks)
    for sub in setlist.sublists:
        all_track_ids.extend(sub.tracks)

    lines = ["BeginPlayList"]
    for track_id in all_track_ids:
        track = tracks_by_id.get(track_id)
        if not track or not track.local_file:
            continue
        rel = track.local_file.replace("\\", "/")
        if lib_root and rel.startswith(lib_root):
            rel = rel[len(lib_root):]
        item_name = rel.replace("/", "\\")
        lines += [
            "BeginItem",
            f'ItemName "{item_name}"',
            "volumeMP3 1.000",
            "posMusic 0.000",
            "startLoop 0.000",
            "endLoop 0.000",
            "isLoop 0",
            "EndItem",
        ]
    lines.append("EndPlayList")

    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in setlist.name)
    from fastapi.responses import Response
    return Response(
        content="\n".join(lines).encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.txt"'},
    )


# ─── Sound Effect Endpoints ─────────────────────────────────────

@app.get("/api/sound-effects")
def get_sound_effects():
    logger.debug("Fetching sound effects")
    return sound_effect_repo.get_all()

@app.post("/api/sound-effects")
def create_sound_effect(effect: SoundEffect):
    logger.info(f"Creating sound effect: {effect.name} ({effect.id})")
    return sound_effect_repo.create(effect)

@app.delete("/api/sound-effects/{effect_id}")
def delete_sound_effect(effect_id: str):
    logger.info(f"Deleting sound effect: {effect_id}")
    success = sound_effect_repo.delete(effect_id)
    if not success:
        logger.warning(f"Sound effect {effect_id} not found for deletion")
        raise HTTPException(status_code=404, detail="Sound effect not found")
    return {"status": "deleted"}

@app.put("/api/sound-effects/{effect_id}")
def update_sound_effect(effect_id: str, updated: dict):
    effect = sound_effect_repo.get_by_id(effect_id)
    if not effect:
        raise HTTPException(status_code=404, detail="Sound effect not found")
        
    if "category" in updated:
        effect.category = updated["category"]
    if "tags" in updated:
        effect.tags = updated["tags"]
    if "name" in updated:
        effect.name = updated["name"]
        
    success = sound_effect_repo.delete(effect_id) # remove old
    if success:
        return sound_effect_repo.create(effect) # save new
    raise HTTPException(status_code=500, detail="Failed to update sound effect")

import urllib.request
import urllib.parse

@app.get("/api/sound-effects/search")
def search_pixabay(q: str = Query(...)):
    pixabay_key = os.getenv("PIXABAY_API_KEY", "")
    if not pixabay_key or pixabay_key == "your_key_here":
        raise HTTPException(status_code=400, detail="PIXABAY_API_KEY is not configured in .env")
        
    url = f"https://pixabay.com/api/audio/?key={pixabay_key}&q={urllib.parse.quote(q)}&category=sound%20effects"
    
    try:
        req = urllib.request.Request(url, headers={
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            return {"hits": data.get("hits", [])}
    except Exception as e:
        logger.error(f"Pixabay API error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch from Pixabay")


@app.post("/api/sound-effects/download")
def download_sound_effect(url: str = Query(...), name: str = Query("New Sound")):
    from download_service import DOWNLOAD_DIR
    import os
    
    se_dir = os.path.join(DOWNLOAD_DIR, "sound_effects")
    os.makedirs(se_dir, exist_ok=True)
    
    filename = f"{uuid.uuid4().hex[:8]}.mp3"
    local_path = os.path.join(se_dir, filename)
    
    try:
        req = urllib.request.Request(url, headers={
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req) as response:
            data = response.read()
            
            # Basic validation: check if the response is actually an HTML page (Cloudflare Block)
            if data.startswith(b'<!DOCTYPE html>') or data.startswith(b'<html'):
                raise Exception("Pixabay blocked the audio download (returned HTML instead of MP3).")
                
            with open(local_path, 'wb') as out_file:
                out_file.write(data)
                
        from download_service import trim_silence
        trim_silence(local_path)
    except Exception as e:
        logger.error(f"Failed to download sound effect: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download from URL: {str(e)}")
        
    effect = SoundEffect(
        name=name,
        local_file=os.path.join("sound_effects", filename).replace('\\', '/'),
        source_url=url
    )
    return sound_effect_repo.create(effect)

@app.get("/api/sound-effects/search/youtube")
def search_youtube_sfx(q: str = Query(...)):
    import yt_dlp
    
    # We want short sound effects. Try to find things under 1 min if possible
    search_query = f"ytsearch10:{q} sound effect short animation"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'extract_flat': True,
    }
    
    try:
        logger.info(f"YouTube search API call: query '{q}'")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=False)
            entries = info.get('entries', [])
            logger.info(f"YouTube search returned {len(entries)} results for query '{q}'")
            
            hits = []
            for entry in entries:
                # Map yt-dlp fields to Pixabay-like fields for the frontend
                title = entry.get('title', '')
                vid_id = entry.get('id', '')
                duration = entry.get('duration') or 0
                
                hits.append({
                    "id": vid_id,
                    "duration": duration,
                    "description": title,                  # Maps to Pixabay 'description'
                    "tags": entry.get('channel', 'YouTube'), # Maps to Pixabay 'tags'
                })
            return {"hits": hits}
    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch from YouTube")

@app.post("/api/sound-effects/download/youtube")
def download_youtube_sfx(video_id: str = Query(...), name: str = Query("New Sound")):
    import yt_dlp
    from download_service import DOWNLOAD_DIR
    import os
    
    se_dir = os.path.join(DOWNLOAD_DIR, "sound_effects")
    os.makedirs(se_dir, exist_ok=True)
    
    filename = f"{uuid.uuid4().hex[:8]}.mp3"
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(se_dir, f"{filename[:-4]}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        from download_service import trim_silence
        trim_silence(os.path.join(se_dir, filename))
    except Exception as e:
        logger.error(f"Failed to download YT sound effect: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download from YouTube: {str(e)}")
        
    effect = SoundEffect(
        name=name,
        local_file=os.path.join("sound_effects", filename).replace('\\', '/'),
        source_url=url
    )
    return sound_effect_repo.create(effect)

@app.get("/api/sound-effects/preview/youtube")
def get_youtube_preview_url(video_id: str):
    import yt_dlp
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'noplaylist': True,
    }
    
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {"url": info.get('url')}
    except Exception as e:
        logger.error(f"Failed to extract direct YouTube audio URL for {video_id}: {e}")
        raise HTTPException(status_code=400, detail="Could not retrieve YouTube audio stream.")

@app.get("/api/sound-effects/play/{effect_id}")
def play_sound_effect(effect_id: str):
    from download_service import DOWNLOAD_DIR
    import os
    
    effect = sound_effect_repo.get_by_id(effect_id)
    if not effect:
        raise HTTPException(status_code=404, detail="Sound effect not found")
        
    file_path = os.path.join(DOWNLOAD_DIR, effect.local_file)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk")
        
    return FileResponse(file_path, media_type="audio/mpeg")

# ─── Custom Playlist helpers ──────────────────────────────────────

def _parse_playlist_text(content: str) -> list[dict]:
    """Parse a BeginPlayList...EndPlayList text file into a list of item dicts."""
    items = []
    current: dict | None = None
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if line == "BeginItem":
            current = {}
        elif line == "EndItem" and current is not None:
            items.append(current)
            current = None
        elif current is not None and line:
            parts = line.split(None, 1)
            if len(parts) == 2:
                key, val = parts
                # Strip surrounding quotes from values like ItemName "foo"
                val = val.strip()
                if val.startswith('"') and val.endswith('"'):
                    val = val[1:-1]
                current[key] = val
    return items


def _match_track(item_name: str, all_tracks: list) -> str | None:
    """Return the track id that best matches item_name, or None."""
    normalized = item_name.replace("\\", "/").lower()
    filename = normalized.split("/")[-1]

    candidates = [
        t for t in all_tracks
        if t.local_file and t.local_file.replace("\\", "/").lower().endswith("/" + filename)
           or (t.local_file and os.path.basename(t.local_file.replace("\\", "/")).lower() == filename)
    ]

    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0].id

    # Multiple matches: score by number of matching trailing path segments
    best_id = None
    best_score = -1
    item_parts = normalized.split("/")
    for t in candidates:
        candidate_parts = t.local_file.replace("\\", "/").lower().split("/")
        score = sum(
            1 for i in range(1, min(len(item_parts), len(candidate_parts)) + 1)
            if item_parts[-i] == candidate_parts[-i]
        )
        if score > best_score:
            best_score = score
            best_id = t.id
    return best_id


def _find_library_root(tracks: list) -> str:
    """Determine the common path prefix of all downloaded tracks."""
    paths = [t.local_file.replace("\\", "/") for t in tracks if t.local_file]
    if not paths:
        return ""
    root = paths[0].rsplit("/", 1)[0] + "/"
    for p in paths[1:]:
        while not p.startswith(root) and root:
            root = root.rsplit("/", 1)[0]
            if root:
                root += "/"
    return root


def _build_playlist_text(playlist: CustomPlaylist, tracks_by_id: dict) -> str:
    lines = ["BeginPlayList"]
    for item in playlist.items:
        track = tracks_by_id.get(item.track_id) if item.track_id else None
        if track and track.local_file:
            # Try to make the path relative to the library root
            root = _find_library_root(list(tracks_by_id.values()))
            rel = track.local_file.replace("\\", "/")
            if root and rel.startswith(root):
                rel = rel[len(root):]
            item_name = rel.replace("/", "\\")
        else:
            item_name = item.item_name
        lines.append("BeginItem")
        lines.append(f'ItemName "{item_name}"')
        lines.append(f"volumeMP3 {item.volume_mp3:.3f}")
        lines.append(f"posMusic {item.pos_music:.3f}")
        lines.append(f"startLoop {item.start_loop:.3f}")
        lines.append(f"endLoop {item.end_loop:.3f}")
        lines.append(f"isLoop {item.is_loop}")
        lines.append("EndItem")
    lines.append("EndPlayList")
    return "\n".join(lines)


# ─── Custom Playlist endpoints ────────────────────────────────────

@app.get("/api/custom-playlists")
def list_custom_playlists(profile_id: Optional[str] = Query(None)):
    playlists = custom_playlist_repo.get_all(profile_id=profile_id)
    return [{"id": p.id, "name": p.name, "item_count": len(p.items), "created_at": p.created_at} for p in playlists]


@app.post("/api/custom-playlists/import")
async def import_custom_playlist(file: UploadFile = File(...), profile_id: Optional[str] = Query(None)):
    content = (await file.read()).decode("utf-8", errors="replace")
    raw_items = _parse_playlist_text(content)
    if not raw_items:
        raise HTTPException(status_code=400, detail="No items found in playlist file")

    all_tracks = repo.get_all(profile_id=profile_id if profile_id else None)
    items = []
    for raw in raw_items:
        item_name = raw.get("ItemName", "")
        track_id = _match_track(item_name, all_tracks)
        items.append(CustomPlaylistItem(
            item_name=item_name,
            track_id=track_id,
            volume_mp3=float(raw.get("volumeMP3", 1.0)),
            pos_music=float(raw.get("posMusic", 0.0)),
            start_loop=float(raw.get("startLoop", 0.0)),
            end_loop=float(raw.get("endLoop", 0.0)),
            is_loop=int(raw.get("isLoop", 0)),
        ))

    name = os.path.splitext(file.filename or "playlist")[0]
    playlist = CustomPlaylist(name=name, items=items, profile_id=profile_id or DEFAULT_PROFILE_ID)
    created = custom_playlist_repo.create(playlist)
    matched = sum(1 for i in items if i.track_id)
    return {"id": created.id, "name": created.name, "total": len(items), "matched": matched}


@app.get("/api/custom-playlists/{playlist_id}")
def get_custom_playlist(playlist_id: str):
    playlist = custom_playlist_repo.get_by_id(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    all_tracks = repo.get_all()
    tracks_by_id = {t.id: t for t in all_tracks}
    result_items = []
    for item in playlist.items:
        track = tracks_by_id.get(item.track_id) if item.track_id else None
        result_items.append({
            **item.dict(),
            "track_title": track.title if track else None,
            "track_author": track.author if track else None,
        })
    return {**playlist.dict(), "items": result_items}


@app.get("/api/custom-playlists/{playlist_id}/export")
def export_custom_playlist(playlist_id: str):
    playlist = custom_playlist_repo.get_by_id(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    all_tracks = repo.get_all()
    tracks_by_id = {t.id: t for t in all_tracks}
    text = _build_playlist_text(playlist, tracks_by_id)
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in playlist.name)
    filename = f"{safe_name}.txt"
    from fastapi.responses import Response
    return Response(
        content=text.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.put("/api/custom-playlists/{playlist_id}")
def update_custom_playlist(playlist_id: str, data: dict):
    playlist = custom_playlist_repo.get_by_id(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if "name" in data:
        playlist.name = data["name"]
    updated = custom_playlist_repo.update(playlist_id, playlist)
    return updated


@app.delete("/api/custom-playlists/{playlist_id}")
def delete_custom_playlist(playlist_id: str):
    deleted = custom_playlist_repo.delete(playlist_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"ok": True}


if __name__ == "__main__":
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(description="EasyMusic backend server")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)), help="Port for uvicorn to bind to")
    parser.add_argument("--user-data-dir", type=str, default=os.environ.get("USER_DATA_DIR"), help="Path to the user data directory")
    args = parser.parse_args()

    if args.user_data_dir:
        os.environ["USER_DATA_DIR"] = args.user_data_dir

    # 3.8 Ensure user data directory exists
    user_data_path = os.environ.get("USER_DATA_DIR", ".")
    if not os.path.exists(user_data_path):
        print(f"Creating missing user data directory: {user_data_path}")
        os.makedirs(user_data_path, exist_ok=True)
    
    # 3.8 Check for database existence
    db_file = os.path.join(user_data_path, "app.db")
    if os.path.exists(db_file):
        print(f"Loading existing database: {db_file}")
    else:
        print(f"No database found. A new one will be created at: {db_file}")

    # Listen on all interfaces if in Docker mode, otherwise localhost for security
    bind_host = "0.0.0.0" if os.environ.get("DOCKER_MODE") == "true" else "127.0.0.1"
    
    print(f"Backend listening on {bind_host}:{args.port}")
    uvicorn.run(app, host=bind_host, port=args.port)

