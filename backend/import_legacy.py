import os
import sys
import re
import uuid
import hashlib
import logging
from typing import List
from mutagen.id3 import ID3, TIT2, TPE1, TCON, COMM
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from models import Video, PlaylistRepo

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
SOURCE_DIR = r"C:\Users\xam74\PycharmProjects\LaBriqueMusique\completed"
REPO = PlaylistRepo()

# Regex for filename parsing: song name - artist - tag 1, tag 2 etc
# Example: "Bohemian Rhapsody - Queen - rock, classic, epic.mp3"
FILENAME_REGEX = re.compile(r"^(?P<title>.+?) - (?P<artist>.+?) - (?P<tags>.+)\.(?P<ext>mp3|wav|flac|m4a)$", re.IGNORECASE)

def get_file_hash(filepath: str) -> str:
    """Calculates the MD5 hash of a file."""
    hasher = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception as e:
        logger.error(f"Error hashing {filepath}: {e}")
        return ""

def update_metadata(filepath: str, title: str, artist: str, tags: List[str], category: str):
    """Updates the file's ID3 tags or metadata."""
    ext = os.path.splitext(filepath)[1].lower()
    try:
        if ext == '.mp3':
            try:
                audio = ID3(filepath)
            except Exception:
                audio = ID3()
            
            audio["TIT2"] = TIT2(encoding=3, text=title)
            audio["TPE1"] = TPE1(encoding=3, text=artist)
            audio["TCON"] = TCON(encoding=3, text=", ".join(tags))
            # Store category in a comment or custom field if needed
            audio["COMM"] = COMM(encoding=3, lang='eng', desc='Category', text=category)
            audio.save(filepath)
            logger.info(f"Updated MP3 metadata for: {filepath}")
            
        elif ext == '.flac':
            audio = FLAC(filepath)
            audio["title"] = title
            audio["artist"] = artist
            audio["genre"] = ", ".join(tags)
            audio["comment"] = f"Category: {category}"
            audio.save()
            logger.info(f"Updated FLAC metadata for: {filepath}")
        # Add other formats if necessary (wav metadata is more complex without specific libs)
    except Exception as e:
        logger.error(f"Failed to update metadata for {filepath}: {e}")

def main():
    if not os.path.exists(SOURCE_DIR):
        logger.error(f"Source directory not found: {SOURCE_DIR}")
        return

    logger.info(f"Starting legacy import from: {SOURCE_DIR}")

    # Load existing videos
    videos = REPO.get_all()
    existing_paths = {v.local_file for v in videos if v.local_file}
    
    # We might want to check hashes too, but let's stick to paths for now as requested
    # Or hashes to be safer
    existing_hashes = set()
    for v in videos:
        if v.local_file and os.path.exists(v.local_file):
            h = get_file_hash(v.local_file)
            if h: existing_hashes.add(h)

    new_imported = 0
    updated_metadata_count = 0
    skipped = 0

    for root, dirs, files in os.walk(SOURCE_DIR):
        for filename in files:
            if not filename.lower().endswith(('.mp3', '.wav', '.flac', '.m4a')):
                continue

            filepath = os.path.join(root, filename)
            
            # Determine category from relative path
            rel_path = os.path.relpath(root, SOURCE_DIR)
            category = "Uncategorized" if rel_path == '.' else rel_path.replace('\\', '/')

            match = FILENAME_REGEX.match(filename)
            if not match:
                logger.warning(f"Skipping file (regex mismatch): {filename}")
                skipped += 1
                continue

            groups = match.groupdict()
            title = groups.get("title", "").strip()
            artist = groups.get("artist", "").strip()
            tags_raw = groups.get("tags", "")
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()]

            # Hash check
            file_hash = get_file_hash(filepath)
            
            # Metadata update (always update if matched)
            update_metadata(filepath, title, artist, tags, category)
            updated_metadata_count += 1

            # Check if exists in DB
            if filepath in existing_paths or (file_hash and file_hash in existing_hashes):
                logger.info(f"Track already in database: {title}")
                # We might want to update the entry if it exists but metadata changed?
                # For now, let's just ensure it's marked as downloaded
                existing_video = next((v for v in videos if v.local_file == filepath), None)
                if existing_video:
                    existing_video.title = title
                    existing_video.author = artist
                    existing_video.tags = tags
                    existing_video.category = category
                    existing_video.is_downloaded = True
                continue

            # Create new Video entry
            new_vid = Video(
                id=str(uuid.uuid4()),
                title=title,
                author=artist,
                category=category,
                tags=tags,
                is_downloaded=True,
                local_file=filepath
            )
            
            videos.append(new_vid)
            new_imported += 1
            if file_hash: existing_hashes.add(file_hash)
            logger.info(f"Imported: '{title}' by {artist} in '{category}'")

    if new_imported > 0 or updated_metadata_count > 0:
        REPO.save_all(videos)
        logger.info(f"Saved {len(videos)} tracks to playlist.json")

    logger.info("--- Import Summary ---")
    logger.info(f"Files matched and updated: {updated_metadata_count}")
    logger.info(f"New tracks imported: {new_imported}")
    logger.info(f"Files skipped: {skipped}")

if __name__ == "__main__":
    main()
