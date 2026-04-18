#!/usr/bin/env python3
"""
organize_bruitage.py

Find all tracks with "bruitage" in their name, author, or tags and:
1. Copy them to the Sound Effects table so they appear in SFX Setup
2. Move MP3 files to sound_effects/bruitage/ subfolder

Usage:
    python organize_bruitage.py
"""

import os
import sys
import shutil
import uuid
from datetime import datetime
from sqlalchemy import or_
from database import SessionLocal
from models import DBVideo, DBSoundEffect

# Get DOWNLOAD_DIR from download_service or use default
try:
    from download_service import DOWNLOAD_DIR
except:
    DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "downloads")

def organize_bruitage():
    """Find tracks with 'bruitage' in title/author/tags and move to Sound Effects."""
    db = SessionLocal()
    try:
        # Query all videos where title OR author contains "bruitage", or tags include "bruitage"
        bruitage_tracks = db.query(DBVideo).filter(
            or_(
                DBVideo.title.ilike('%bruitage%'),
                DBVideo.author.ilike('%bruitage%'),
                DBVideo.tags.ilike('%bruitage%')
            )
        ).all()

        if not bruitage_tracks:
            print("[OK] No tracks with 'bruitage' found.")
            return

        print(f"Found {len(bruitage_tracks)} track(s) with 'bruitage':")
        print()

        # Ensure sound_effects/bruitage directory exists
        se_dir = os.path.join(DOWNLOAD_DIR, "sound_effects")
        bruitage_dir = os.path.join(se_dir, "bruitage")
        os.makedirs(bruitage_dir, exist_ok=True)

        copied_count = 0
        moved_count = 0

        # Create Sound Effect entries
        for track in bruitage_tracks:
            print(f"  - {track.title}")
            print(f"    Author: {track.author}")
            print(f"    ID: {track.id}")

            # Only process if the track is downloaded
            if not track.is_downloaded or not track.local_file:
                print(f"    [SKIP] Track not downloaded yet")
                print()
                continue

            # Get the source file path
            source_path = os.path.join(DOWNLOAD_DIR, track.local_file)

            # If original path doesn't exist, search for file by basename
            if not os.path.exists(source_path):
                basename = os.path.basename(track.local_file)
                # Search in downloads directory for this file
                for root, dirs, files in os.walk(DOWNLOAD_DIR):
                    if basename in files:
                        source_path = os.path.join(root, basename)
                        break

            if not os.path.exists(source_path):
                print(f"    [SKIP] Source file not found: {track.local_file}")
                print()
                continue

            # Get original filename
            orig_filename = os.path.basename(track.local_file)

            # If filename contains "bruitage", move it to bruitage subfolder
            if "bruitage" in orig_filename.lower():
                dest_path = os.path.join(bruitage_dir, orig_filename)
                try:
                    shutil.move(source_path, dest_path)
                    se_rel_path = f"sound_effects/bruitage/{orig_filename}"
                    print(f"    [MOVE] -> sound_effects/bruitage/{orig_filename}")
                    moved_count += 1
                except Exception as e:
                    print(f"    [ERROR] Failed to move file: {e}")
                    continue
            else:
                # Copy to sound_effects/bruitage/ with original filename
                dest_path = os.path.join(bruitage_dir, orig_filename)
                try:
                    shutil.copy2(source_path, dest_path)
                    se_rel_path = f"sound_effects/bruitage/{orig_filename}"
                    print(f"    [COPY] -> sound_effects/bruitage/{orig_filename}")
                except Exception as e:
                    print(f"    [ERROR] Failed to copy: {e}")
                    continue

            # Create Sound Effect entry
            sound_effect = DBSoundEffect(
                id=str(uuid.uuid4()),
                name=track.title,
                local_file=se_rel_path,
                source_url=track.youtube_url,
                category="Bruitage",
                tags=track.tags if track.tags else ["bruitage"],
                added_at=datetime.utcnow().isoformat()
            )

            db.add(sound_effect)
            copied_count += 1
            print(f"    [ADDED] to Sound Effects table")
            print()

        # Commit all changes
        db.commit()
        print(f"[SUCCESS] Created {copied_count} sound effect(s)")
        print(f"[SUCCESS] Moved {moved_count} files with 'bruitage' in filename")
        print()
        print("These bruitage sounds are now organized in:")
        print(f"  - Database: Sound Effects table (category: 'Bruitage')")
        print(f"  - Folder: downloads/sound_effects/bruitage/")
        print()
        print("Available in SFX Setup panel!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == '__main__':
    organize_bruitage()
