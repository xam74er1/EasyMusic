import yt_dlp
import os
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

def download_video_sync(video_id: str, url: str, overwrite: bool = False):
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
        
    logger.info(f"Starting download process for {video_id} ('{target.title}'). Overwrite: {overwrite}")
    
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
    try:
        logger.debug(f"Calling yt_dlp for URL {url} into {output_tmpl}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
            
        if os.path.exists(final_mp3_path):
            logger.info(f"yt_dlp download and conversion to {final_mp3_path} completed.")
            
            # Automatic silence trimming using ffmpeg
            logger.debug(f"Starting silence trimming for {final_mp3_path}")
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
                
    except Exception as e:
        logger.error(f"Failed to download video {video_id}: {str(e)}")
        log_download_event("download_fail", video_id, "failed", str(e))
        
        # Save error to database for frontend polling
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
