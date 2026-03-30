import yt_dlp
import os
import shutil
import threading
import json
import subprocess
from datetime import datetime
from pathvalidate import sanitize_filename
from mutagen.id3 import ID3, TIT2, TPE1, TCON, COMM, error as ID3Error
from mutagen.mp3 import MP3
import logging

logger = logging.getLogger(__name__)

from models import PlaylistRepo

# Resolve paths relative to USER_DATA_DIR if set, otherwise fall back to the directory
# containing this file (backward-compatible behavior when running without Electron)
_USER_DATA_DIR = os.environ.get("USER_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))

_CONFIG_LOCK = threading.Lock()
_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app_config.json")

_VALID_DOWNLOAD_MODES = {"youtube", "spotify", "cc"}


def get_download_mode() -> str:
    """Returns the current download mode from app_config.json, defaulting to 'youtube'."""
    with _CONFIG_LOCK:
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
            return config.get("download_mode", "youtube")
        except (FileNotFoundError, json.JSONDecodeError):
            return "youtube"


def get_enable_fallback() -> bool:
    """Returns whether download fallback is enabled from app_config.json, defaulting to True."""
    with _CONFIG_LOCK:
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
            return config.get("enable_fallback", True)
        except (FileNotFoundError, json.JSONDecodeError):
            return True


def set_enable_fallback(enabled: bool) -> None:
    """Persists the fallback setting to app_config.json."""
    with _CONFIG_LOCK:
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            config = {}
        config["enable_fallback"] = enabled
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)


def set_download_mode(mode: str) -> None:
    """Persists the download mode to app_config.json. Raises ValueError for invalid modes."""
    if mode not in _VALID_DOWNLOAD_MODES:
        raise ValueError(f"Invalid download mode '{mode}'. Must be one of: {_VALID_DOWNLOAD_MODES}")
    with _CONFIG_LOCK:
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            config = {}
        config["download_mode"] = mode
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)


DOWNLOAD_DIR = os.path.join(_USER_DATA_DIR, "downloads")
LOGS_DIR = os.path.join(_USER_DATA_DIR, "logs")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

repo = PlaylistRepo()

def trim_silence(mp3_path: str):
    """Trims leading silence from an MP3 file using ffmpeg."""
    if not os.path.exists(mp3_path):
        return

    temp_output = f"{mp3_path}.tmp.mp3"
    trim_cmd = [
        "ffmpeg", "-i", mp3_path,
        "-af", "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB",
        "-y", temp_output
    ]
    
    try:
        subprocess.run(trim_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(temp_output, mp3_path)
        logger.info(f"Silence trimmed for {os.path.basename(mp3_path)}")
    except Exception as trim_err:
        logger.error(f"Trimming failed for {os.path.basename(mp3_path)}: {trim_err}")
        if os.path.exists(temp_output):
            os.remove(temp_output)

def log_download_event(event: str, video_id: str, status: str, error: str = None):
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event": event,
        "track_id": video_id,
        "status": status
    }
    if error:
        log_entry["error"] = error
        
    log_file = os.path.join(LOGS_DIR, "downloads.log")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry) + "\n")
repo = PlaylistRepo()

def _download_via_ytdlp(video_id: str, url: str, overwrite: bool = False) -> bool:
    """Downloads audio via yt-dlp, applies silence trimming and ID3 tags. Returns True on success."""
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target:
        logger.error(f"Target video not found for {video_id}")
        log_download_event("download_fail", video_id, "failed", "video_not_found")
        return

    category = target.category if target.category else "Uncategorized"
    cat_dir = os.path.join(DOWNLOAD_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)
    
    tags_str = ", ".join(target.tags) if target.tags else "NoTags"
    base_name = f"{target.title} - {target.author} - {tags_str}"
    safe_name = sanitize_filename(base_name)
    
    output_tmpl = os.path.join(cat_dir, f"{safe_name}.%(ext)s")
    final_mp3_path = os.path.join(cat_dir, f"{safe_name}.mp3")
    
    if os.path.exists(final_mp3_path) and not overwrite:
        logger.info(f"File {final_mp3_path} already exists and overwrite is False, skipping download.")
        log_download_event("download_skip", video_id, "skipped", "file_exists")
        return
        
    logger.info(f"YTDLP DOWNLOAD START: video_id={video_id}")
    print(f"DEBUG: Starting _download_via_ytdlp for {video_id}", flush=True)
    
    # Robustness flags for VPS/DataCenter environments
    ydl_opts = {
        # Try bestaudio, fall back to best if audio-only isn't available
        'format': 'bestaudio/best',
        'outtmpl': output_tmpl,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': False,  # Turn on more logging for debugging failures
        'no_warnings': False,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'no_color': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        # Use player clients whose stream URLs are pre-signed and need NO JS solving.
        # 'ios' is the most reliable: YouTube serves it raw, unencrypted URLs directly.
        # 'android_music' is a strong secondary fallback.
        # 'tv' / 'mweb' are last resorts.
        'extractor_args': {
            'youtube': {
                'player_client': ['ios', 'android_music', 'tv', 'mweb'],
            }
        },
    }

    # Add JavaScript runtime (Node.js) if found, required by recent yt-dlp versions for YouTube
    node_path = shutil.which("node")
    if node_path:
        logger.info(f"YTDLP: Using Node.js runtime at {node_path}")
        ydl_opts['js_runtimes'] = [f"node:{node_path}"]
    else:
        logger.warning("YTDLP: Node.js not found in PATH. Extraction may fail.")

    # Check for dedicated cookies.txt file first (Preferred for VPS)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    cookies_file = os.path.join(backend_dir, "cookies.txt")
    
    logger.info(f"YTDLP: Checking for cookies at absolute path: {cookies_file}")
    if os.path.exists(cookies_file):
        file_size = os.path.getsize(cookies_file)
        logger.info(f"YTDLP: SUCCESS! cookies.txt found (Size: {file_size} bytes). Using it for download.")
        ydl_opts['cookiefile'] = cookies_file
    else:
        logger.info(f"YTDLP: No cookies.txt found at {cookies_file}. Checking browser fallback...")
        # Fallback to browser-based cookies if specified in .env
        ytdlp_browser = os.getenv("YTDLP_BROWSER")
        ytdlp_profile = os.getenv("YTDLP_BROWSER_PROFILE")
        if ytdlp_browser:
            logger.info(f"YTDLP: Attempting to extract cookies from {ytdlp_browser} (profile: {ytdlp_profile})")
            if ytdlp_profile:
                profile_path = os.path.join(backend_dir, ytdlp_profile) if not os.path.isabs(ytdlp_profile) else ytdlp_profile
                ydl_opts['cookiesfrombrowser'] = (ytdlp_browser, profile_path)
            else:
                ydl_opts['cookiesfrombrowser'] = (ytdlp_browser,)
        else:
            logger.warning("YTDLP: No cookies.txt and no YTDLP_BROWSER set. Download may fail on VPS.")
    
    log_download_event("download_start", video_id, "pending")
    
    # We will try a robust config first, then a "simple" one if it fails.
    attempts = [
        ("Robust (VPS Optimized)", ydl_opts),
        ("Simple (Default)", {
            'format': 'bestaudio/best',
            'outtmpl': output_tmpl,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'nocheckcertificate': True,
            'quiet': False
        })
    ]

    # Inherit cookies if available for the simple attempt too
    if 'cookiefile' in ydl_opts:
        attempts[1][1]['cookiefile'] = ydl_opts['cookiefile']

    success = False
    last_error = ""

    for attempt_name, opts in attempts:
        try:
            logger.info(f"YTDLP: Attempting download using {attempt_name} configuration...")
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            
            if os.path.exists(final_mp3_path):
                logger.info(f"YTDLP: {attempt_name} download successful. File found at {final_mp3_path}")
                success = True
                break
            else:
                logger.warning(f"YTDLP: {attempt_name} finished but {final_mp3_path} was not created.")
                last_error = "File not found after download"
        except Exception as e:
            last_error = str(e)
            logger.error(f"YTDLP: {attempt_name} failed: {last_error}")
            continue

    if not success:
        logger.error(f"YTDLP: All download attempts failed for {video_id}. Last error: {last_error}")
        log_download_event("download_fail", video_id, "failed", last_error)
        
        # Save error to database for frontend polling
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                v.download_error = last_error
                repo.update_video(video_id, v)
                break
        return False

    # Success path continues...
    try:
        logger.info(f"YTDLP: Processing successful download for {video_id}")
        
        # Automatic silence trimming using ffmpeg
        logger.debug(f"YTDLP: Starting silence trimming for {final_mp3_path}")
        trim_silence(final_mp3_path)
        logger.info(f"Silence trimming completed for {video_id}")

        # Apply ID3 Metadata
        try:
            logger.debug(f"Applying ID3 metadata to {final_mp3_path}")
            try:
                audio = ID3(final_mp3_path)
            except ID3Error:
                audio = ID3()
            
            audio.add(TIT2(encoding=3, text=target.title))
            audio.add(TPE1(encoding=3, text=target.author))
            audio.add(TCON(encoding=3, text=tags_str))
            audio.add(COMM(encoding=3, lang='eng', desc='YouTube URL', text=url))
            
            audio.save(final_mp3_path, v2_version=4)
            logger.info(f"ID3 tags successfully added for {video_id}")
        except Exception as tag_err:
            logger.error(f"Failed to add ID3 tags for {video_id}: {tag_err}")

        logger.debug(f"Updating database for {video_id}")
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                # Store relative path so if DOWNLOAD_DIR changes, it remains valid
                rel_path = os.path.join(category, f"{safe_name}.mp3").replace('\\', '/')
                v.local_file = rel_path
                v.is_downloaded = True
                repo.update_video(video_id, v)
                break
                
        logger.info(f"Successfully finished all download tasks for video {video_id}")
        log_download_event("download_success", video_id, "success")
        
        # Clear any previous error flag
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                v.download_error = None
                repo.update_video(video_id, v)
                break
        return True
                
    except Exception as e:
        logger.error(f"Failed to process successful download for {video_id}: {str(e)}")
        log_download_event("download_fail", video_id, "failed", str(e))
        return False


def _download_via_spotdl(video_id: str, url: str) -> bool:
    """Downloads audio via spotdl CLI, applies ID3 tags and updates the DB record on success. Returns True on success."""
    try:
        import shutil
        if shutil.which("spotdl") is None:
            raise ImportError("spotdl not installed")
    except ImportError:
        logger.error(f"spotdl is not installed, cannot download {video_id}")
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                v.download_error = "spotdl not installed"
                repo.update_video(video_id, v)
                break
        log_download_event("download_fail", video_id, "failed", "spotdl not installed")
        return False

    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target:
        logger.error(f"Target video not found for {video_id}")
        log_download_event("download_fail", video_id, "failed", "video_not_found")
        return False

    category = target.category if target.category else "Uncategorized"
    cat_dir = os.path.join(DOWNLOAD_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)

    tags_str = ", ".join(target.tags) if target.tags else "NoTags"
    base_name = f"{target.title} - {target.author} - {tags_str}"
    safe_name = sanitize_filename(base_name)
    final_mp3_path = os.path.join(cat_dir, f"{safe_name}.mp3")

    log_download_event("download_start", video_id, "pending")
    try:
        logger.info(f"Starting spotdl download for {video_id} ('{target.title}')")
        result = subprocess.run(
            ["spotdl", url, "--output", cat_dir, "--format", "mp3"],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "spotdl exited with non-zero status")

        # spotdl names the file itself; find the most recently created mp3 in cat_dir
        mp3_files = [
            os.path.join(cat_dir, f)
            for f in os.listdir(cat_dir)
            if f.endswith(".mp3")
        ]
        if not mp3_files:
            raise RuntimeError("spotdl ran but no MP3 file was found in output directory")

        downloaded_path = max(mp3_files, key=os.path.getmtime)

        # Rename to our canonical name so it matches the DB record
        if downloaded_path != final_mp3_path:
            os.replace(downloaded_path, final_mp3_path)

        # Apply ID3 Metadata
        try:
            logger.debug(f"Applying ID3 metadata to {final_mp3_path}")
            try:
                audio = ID3(final_mp3_path)
            except ID3Error:
                audio = ID3()

            audio.add(TIT2(encoding=3, text=target.title))
            audio.add(TPE1(encoding=3, text=target.author))
            audio.add(TCON(encoding=3, text=tags_str))
            audio.add(COMM(encoding=3, lang='eng', desc='Source URL', text=url))

            audio.save(final_mp3_path, v2_version=4)
            logger.info(f"ID3 tags successfully added for {video_id}")
        except Exception as tag_err:
            logger.error(f"Failed to add ID3 tags for {video_id}: {tag_err}")

        # Update DB record
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                rel_path = os.path.join(category, f"{safe_name}.mp3").replace('\\', '/')
                v.local_file = rel_path
                v.is_downloaded = True
                v.download_error = None
                repo.update_video(video_id, v)
                break

        logger.info(f"Successfully finished spotdl download for {video_id}")
        log_download_event("download_success", video_id, "success")
        return True

    except Exception as e:
        logger.error(f"spotdl failed to download {video_id}: {str(e)}")
        log_download_event("download_fail", video_id, "failed", str(e))

        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                v.download_error = str(e)
                repo.update_video(video_id, v)
                break
        return False


def download_video_sync(video_id: str, url: str, overwrite: bool = False):
    mode = get_download_mode()
    fallback_enabled = get_enable_fallback()
    
    success = False
    if mode == "spotify":
        success = _download_via_spotdl(video_id, url)
        if not success and fallback_enabled:
            logger.info(f"Spotify failed for {video_id}, falling back to YouTube")
            _download_via_ytdlp(video_id, url, overwrite)
    elif mode == "cc":
        _download_via_cc_by_metadata(video_id)
    else:
        success = _download_via_ytdlp(video_id, url, overwrite)
        if not success and fallback_enabled:
            logger.info(f"YouTube failed for {video_id}, falling back to Spotify")
            _download_via_spotdl(video_id, url)

def _download_via_cc_by_metadata(video_id: str):
    """Searches for a Creative Commons match on FMA and downloads it, updating the record."""
    from cc_service import search_cc_tracks, download_cc_track, CCSourceUnavailableError
    
    videos = repo.get_all()
    target = next((v for v in videos if v.id == video_id), None)
    if not target:
        logger.error(f"Target video not found for CC download: {video_id}")
        return

    query = f"{target.title} {target.author}"
    logger.info(f"Starting CC search for '{query}' (video_id={video_id})")
    log_download_event("download_start", video_id, "pending")

    try:
        tracks = search_cc_tracks(query, limit=1)
        if not tracks:
            raise ValueError(f"No Creative Commons tracks found for '{query}'")
        
        track = tracks[0]
        logger.info(f"Found CC match: '{track.title}' by {track.author}. Starting download.")
        
        category = target.category if target.category else "Uncategorized"
        download_cc_track(track, category, existing_video_id=video_id)
        
        log_download_event("download_success", video_id, "success")
        logger.info(f"Successfully downloaded CC track for {video_id}")

    except Exception as e:
        logger.error(f"CC download failed for {video_id}: {str(e)}")
        log_download_event("download_fail", video_id, "failed", str(e))
        
        # Save error to database
        videos = repo.get_all()
        for v in videos:
            if v.id == video_id:
                v.download_error = str(e)
                repo.update_video(video_id, v)
                break

def start_download_background(video_id: str, url: str, overwrite: bool = False):
    """Starts the download in a separate thread so it doesn't block the API."""
    logger.info(f"Dispatching background download thread for {video_id}")
    
    # Store initial status
    videos = repo.get_all()
    for v in videos:
        if v.id == video_id:
            v.download_error = "downloading..."
            repo.update_video(video_id, v)
            break
            
    thread = threading.Thread(target=download_video_sync, args=(video_id, url, overwrite))
    thread.daemon = True
    thread.start()

def batch_download_missing():
    """Downloads all missing videos from the playlist."""
    videos = repo.get_all()
    count = 0
    for v in videos:
        if not v.is_downloaded and v.youtube_url:
            start_download_background(v.id, v.youtube_url)
            count += 1
    logger.info(f"Started batch download for {count} missing videos.")
    return {"message": "Batch download started in the background."}
