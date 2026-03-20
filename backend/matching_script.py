import os
import sys
import re
import argparse
import hashlib
import uuid
from models import Video, PlaylistRepo
import logging

logger = logging.getLogger(__name__)

repo = PlaylistRepo()

# The regex specified in the requirements
# Group Title, Author, Tags, and Extension
FILE_REGEX = re.compile(r"^(?P<title>.+?) - (?P<author>.+?) - (?P<tags>.+)\.(?P<ext>mp3|wav)$", re.IGNORECASE)

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
        return None

def main():
    parser = argparse.ArgumentParser(description="Match local audio files and import to EasyMusic database.")
    parser.add_argument("--root", type=str, default=os.getcwd(), help="Root directory to search for audio files.")
    args = parser.parse_args()

    root_dir = os.path.abspath(args.root)
    if not os.path.exists(root_dir) or not os.path.isdir(root_dir):
        logger.error(f"Directory '{root_dir}' does not exist.")
        sys.exit(1)

    logger.info(f"Scanning directory: {root_dir}")

    # Load existing videos to prevent duplicates
    videos = repo.get_all()
    
    # Optional: Build a set of existing local files and their hashes if we had hashes stored, 
    # but since local_file holds the absolute path we can check against that first.
    # We will compute hashes of existing ones to prevent duplicates if path changed.
    existing_hashes = set()
    for v in videos:
        if v.local_file and os.path.exists(v.local_file):
            h = get_file_hash(v.local_file)
            if h:
                existing_hashes.add(h)

    matched = 0
    new_imported = 0
    skipped = 0

    for current_root, dirs, files in os.walk(root_dir):
        # Skip the internal downloads folder to avoid reprocessing yt-dlp active downloads
        if "backend\\downloads" in current_root or "backend/downloads" in current_root:
            continue

        for filename in files:
            if not (filename.endswith('.mp3') or filename.endswith('.wav')):
                continue

            filepath = os.path.join(current_root, filename)
            
            # Determine relative category
            rel_path = os.path.relpath(current_root, root_dir)
            category = "Uncategorized" if rel_path == '.' else rel_path.replace('\\', '/')

            match = FILE_REGEX.match(filename)
            if not match:
                skipped += 1
                continue

            matched += 1
            
            # Parse regex groups
            groups = match.groupdict()
            title = groups.get("title", "").strip()
            author = groups.get("author", "").strip()
            tags_raw = groups.get("tags", "")
            
            # Parse comma-separated tags
            tags = [t.strip() for t in tags_raw.split(",") if t.strip()]

            # Check for duplication by hash
            file_hash = get_file_hash(filepath)
            if file_hash and file_hash in existing_hashes:
                # Already imported
                skipped += 1
                continue

            # Create new video
            new_vid = Video(
                id=str(uuid.uuid4()),
                title=title,
                author=author,
                category=category,
                tags=tags,
                is_downloaded=True,
                local_file=filepath
            )
            
            videos.append(new_vid)
            if file_hash:
                existing_hashes.add(file_hash)
            
            new_imported += 1
            logger.info(f"Imported: '{title}' by {author} into category '{category}'")

    if new_imported > 0:
        repo.save_all(videos)
        
    logger.info("--- Summary ---")
    logger.info(f"{matched} files matched pattern")
    logger.info(f"{new_imported} files new and imported")
    logger.info(f"{skipped} files skipped (duplicates or invalid)")

if __name__ == "__main__":
    main()
