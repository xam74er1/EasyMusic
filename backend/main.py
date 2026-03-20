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

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
numeric_level = getattr(logging, log_level, logging.INFO)

log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

handlers = [console_handler]

# Disabled by default unless explicitly enabled
if os.getenv("LOG_TO_FILE", "FALSE").upper() == "TRUE":
    os.makedirs("logs", exist_ok=True)
    file_handler = logging.FileHandler("logs/backend.log", encoding='utf-8')
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

# Ensure uvicorn access logs are enabled and at the correct level
logging.getLogger("uvicorn.access").setLevel(numeric_level)

# Load env variables before importing modules that depend on them

from database import engine, Base
from models import Video, PlaylistRepo, Setlist, SetlistRepo, Profile, ProfileRepo, Folder, FolderRepo, MASTER_PROFILE_ID, DEFAULT_PROFILE_ID, SoundEffect, SoundEffectRepo
from ai_service import chat_service
from download_service import start_download_background, batch_download_missing
import import_service
import import_logic
import youtube_service

# Initialize SQLite database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Improv Playlist API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = PlaylistRepo()
setlist_repo = SetlistRepo()
profile_repo = ProfileRepo()
folder_repo = FolderRepo()
sound_effect_repo = SoundEffectRepo()

@app.on_event("startup")
def startup_event():
    logger.info("Application starting, performing initial audio scan...")
    import_service.scan_extra_audio_dir()

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
    all_videos = repo.get_all()
    # No profile filter or master: return all tracks
    if not profile_id or profile_id == MASTER_PROFILE_ID:
        return all_videos
    # For a specific profile, only return tracks in that profile's setlists
    setlists = setlist_repo.get_all(profile_id=profile_id)
    track_ids = set()
    for sl in setlists:
        track_ids.update(sl.tracks)
        for sub in sl.sublists:
            track_ids.update(sub.tracks)
    return [v for v in all_videos if v.id in track_ids]

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
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
    return target

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
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
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
    videos = repo.get_all()
    count = 0
    for v in videos:
        # Exact match or prefix match for children folders
        if v.category == req.old_category or v.category.startswith(req.old_category + "/"):
            new_cat = v.category.replace(req.old_category, req.new_category, 1)
            v.local_file = sync_file_location(v, new_cat)
            v.category = new_cat
            repo.update_video(v.id, v)
            count += 1
    return {"status": "updated", "count": count}

class ReorganizePlan(BaseModel):
    plan: list[dict]

@app.post("/api/library/reorganize")
def execute_reorganization(req: ReorganizePlan):
    videos = repo.get_all()
    # Save undo state
    undo_data = [v.dict() for v in videos]
    with open("undo_history.json", "w", encoding="utf-8") as f:
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
    if not os.path.exists("undo_history.json"):
        raise HTTPException(status_code=404, detail="No undo history found")
        
    with open("undo_history.json", "r", encoding="utf-8") as f:
        undo_data = json.load(f)
        
    for v_data in undo_data:
        v = Video(**v_data)
        repo.update_video(v.id, v)
        
    os.remove("undo_history.json")
    return {"status": "success", "message": "Restored previous state."}

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    result = chat_service.send_message(request.message, session_id=request.session_id)
    return result

@app.post("/api/download/batch")
def download_all_missing():
    return batch_download_missing()

@app.post("/api/download/{video_id}")
def download_single_video(video_id: str, overwrite: bool = False):
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
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
    
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
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
    
    # 1. Gather tracks
    all_videos = repo.get_all()
    tracks_to_zip = []
    
    if folder_id:
        # User wants a specific folder (folder_id is actually the category path string here)
        for v in all_videos:
            if v.category == folder_id or (v.category and v.category.startswith(folder_id + "/")):
                tracks_to_zip.append(v)
    else:
        # User wants the whole library for this profile
        if not profile_id or profile_id == MASTER_PROFILE_ID:
            tracks_to_zip = all_videos
        else:
            setlists = setlist_repo.get_all(profile_id=profile_id)
            track_ids = set()
            for sl in setlists:
                track_ids.update(sl.tracks)
                for sub in sl.sublists:
                    track_ids.update(sub.tracks)
            tracks_to_zip = [v for v in all_videos if v.id in track_ids]
            
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
                    local_file=local_rel_path
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
def sync_with_youtube(video_id: str):
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Perform search if url is missing, or update if user wants to sync
    query = f"{target.title} {target.author}"
    results = youtube_service.search_youtube(query, max_results=1)
    
    if not results:
        raise HTTPException(status_code=404, detail="No matching YouTube videos found with >100k views")
    
    match = results[0]
    target.youtube_url = match.url
    target.thumbnail = match.thumbnail
    target.youtube_data = match.raw_data
    
    repo.update_video(video_id, target)
    return {"status": "synced", "video": target}

from fastapi.responses import FileResponse
import glob

@app.get("/api/play/{video_id}")
def play_video(video_id: str):
    from download_service import DOWNLOAD_DIR
    import os
    
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    
    if not target:
        raise HTTPException(status_code=404, detail="Video not found")
        
    matches = []
    path = sync_get_local_file_path(target, DOWNLOAD_DIR)
    if path:
        matches.append(path)
    
    # Fallback to scanning if still not matched
    if not matches:
        for root, _, files in os.walk(DOWNLOAD_DIR):
            for filename in files:
                if video_id in filename:
                    matches.append(os.path.join(root, filename))
                    break
            if matches:
                break

    if not matches:
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    return FileResponse(matches[0], media_type="audio/mpeg")

from fastapi.responses import StreamingResponse
import subprocess

@app.get("/api/stream/{video_id}")
def stream_video(video_id: str):
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target or not target.youtube_url:
        raise HTTPException(status_code=404, detail="Video or URL not found")

    def generate():
        # Use yt-dlp to stream audio to stdout
        cmd = [
            "yt-dlp",
            "-f", "bestaudio",
            "-o", "-", # output to stdout
            target.youtube_url
        ]
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            while True:
                chunk = process.stdout.read(1024 * 64) # 64kb chunks
                if not chunk:
                    break
                yield chunk
        finally:
            process.terminate()

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

