import os
import zipfile
import shutil
import tempfile
import re
from typing import List, Dict, Any
from mutagen.id3 import ID3
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
import logging

logger = logging.getLogger(__name__)

# Regex for filename parsing (same as legacy)
FILENAME_REGEX = re.compile(r"^(?P<title>.+?) - (?P<author>.+?) - (?P<tags>.+)\.(?P<ext>mp3|wav|flac|m4a)$", re.IGNORECASE)

def extract_metadata_from_file(filepath: str) -> Dict[str, Any]:
    """ Extracts metadata from file using both tags and filename. """
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filename)[1].lower()
    
    metadata = {
        "title": os.path.splitext(filename)[0],
        "author": "Unknown Artist",
        "tags": [],
        "category": "Uncategorized",
        "gender": "Unknown"
    }
    
    # 1. Try Filename Regex
    match = FILENAME_REGEX.match(filename)
    if match:
        groups = match.groupdict()
        metadata["title"] = groups.get("title", "").strip()
        metadata["author"] = groups.get("author", "").strip()
        tags_raw = groups.get("tags", "")
        metadata["tags"] = [t.strip() for t in tags_raw.split(",") if t.strip()]

    # 2. Try ID3 Tags for MP3
    if ext == ".mp3":
        try:
            audio = ID3(filepath)
            if "TIT2" in audio:
                metadata["title"] = str(audio["TIT2"])
            if "TPE1" in audio:
                metadata["author"] = str(audio["TPE1"])
            if "TCON" in audio:
                # Often genre is in TCON
                metadata["gender"] = str(audio["TCON"])
            if "COMM::Category" in audio:
                metadata["category"] = str(audio["COMM::Category"])
        except Exception as e:
            logger.debug(f"Could not read ID3 for {filepath}: {e}")
            
    # 3. Try FLAC Tags
    elif ext == ".flac":
        try:
            audio = FLAC(filepath)
            metadata["title"] = audio.get("title", [metadata["title"]])[0]
            metadata["author"] = audio.get("artist", [metadata["author"]])[0]
            metadata["gender"] = audio.get("genre", [metadata["gender"]])[0]
        except Exception as e:
            logger.debug(f"Could not read FLAC for {filepath}: {e}")
            
    return metadata

def process_upload_batch(temp_dir: str) -> List[Dict[str, Any]]:
    """ Scans a temporary directory for audio files and extracts metadata. """
    results = []
    for root, _, files in os.walk(temp_dir):
        for filename in files:
            if filename.lower().endswith(('.mp3', '.wav', '.flac', '.m4a')):
                filepath = os.path.join(root, filename)
                # Store original relative path for category suggestion
                rel_path = os.path.relpath(root, temp_dir)
                suggested_category = "Uncategorized" if rel_path == "." else rel_path.replace("\\", "/")
                
                meta = extract_metadata_from_file(filepath)
                if meta["category"] == "Uncategorized":
                    meta["category"] = suggested_category
                    
                results.append({
                    "temp_path": filepath,
                    "filename": filename,
                    "metadata": meta
                })
    return results

def handle_zip_extraction(zip_path: str, target_dir: str):
    """ Extracts a ZIP file to a target directory. """
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(target_dir)

def finalize_import(track_data: Dict[str, Any], library_dir: str):
    """ Moves a file from temp to library and returns the new local_path. """
    temp_path = track_data["temp_path"]
    filename = track_data["filename"]
    category = track_data["metadata"]["category"]
    
    cat_dir = os.path.join(library_dir, category)
    os.makedirs(cat_dir, exist_ok=True)
    
    # Ensure unique filename in destination
    dest_path = os.path.join(cat_dir, filename)
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(filename)
        dest_path = os.path.join(cat_dir, f"{base}_{os.urandom(4).hex()}{ext}")
    
    shutil.move(temp_path, dest_path)
    # Return relative path for DB
    return os.path.relpath(dest_path, library_dir).replace("\\", "/")
