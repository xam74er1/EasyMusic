import pandas as pd
import os
import uuid
import re
from typing import List
from models import Video, PlaylistRepo
import logging

logger = logging.getLogger(__name__)

repo = PlaylistRepo()

def normalize_column_name(col: str) -> str:
    # Lowercase and remove special characters/spaces to make matching robust
    return re.sub(r'[^a-z0-9]', '', str(col).lower())

def process_file(file_path: str) -> int:
    """ Reads CSV or XLSX, creates Videos, adds to playlist. """
    if file_path.endswith('.csv'):
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)

    # find column names
    col_map = {}
    for col in df.columns:
        norm = normalize_column_name(col)
        if 'titre' in norm or 'title' in norm:
            col_map['title'] = col
        elif 'artist' in norm or 'artis' in norm or 'artise' in norm:
            col_map['author'] = col
        elif 'categor' in norm:
            col_map['category'] = col
        elif 'tag' in norm:
            col_map['tags'] = col
        elif 'tempo' in norm or 'speed' in norm:
            col_map['speed'] = col
        elif 'line' in norm or 'lien' in norm or 'youtube' in norm or 'url' in norm:
            col_map['youtube_url'] = col

    count = 0
    videos = repo.get_all()

    for _, row in df.iterrows():
        title = str(row.get(col_map.get('title', ''), '')).strip() if 'title' in col_map else ""
        if not title or title.lower() == 'nan':
            continue # skip empty rows
        
        author = str(row.get(col_map.get('author', ''), '')).strip() if 'author' in col_map else ""
        if author.lower() == 'nan': author = ""
        
        category = str(row.get(col_map.get('category', ''), '')).strip() if 'category' in col_map else "Uncategorized"
        if category.lower() == 'nan': category = "Uncategorized"
        
        tags_raw = str(row.get(col_map.get('tags', ''), '')).strip() if 'tags' in col_map else ""
        tags = [t.strip() for t in tags_raw.split(',')] if tags_raw and tags_raw.lower() != 'nan' else []
        
        speed = str(row.get(col_map.get('speed', ''), '')).strip() if 'speed' in col_map else "Medium"
        if speed.lower() == 'nan': speed = "Medium"
        
        youtube_url = str(row.get(col_map.get('youtube_url', ''), '')).strip() if 'youtube_url' in col_map else ""
        if youtube_url.lower() == 'nan': youtube_url = ""

        # Check if already exists based on title to avoid exact duplicates
        existing = next((v for v in videos if v.title.lower() == title.lower() and v.author.lower() == author.lower()), None)
        if existing:
            # Maybe update it?
            pass
        else:
            new_video = Video(
                id=str(uuid.uuid4()),
                title=title,
                author=author,
                category=category,
                tags=tags,
                speed=speed,
                youtube_url=youtube_url,
                is_downloaded=False,
                local_file=""
            )
            repo.add_video(new_video)
            count += 1
            
    return count

def scan_extra_audio_dir() -> dict:
    """ Scans EXTRA_AUDIO_DIR for mp3/wav files and tries to match them to Videos. """
    extra_dir = os.getenv("EXTRA_AUDIO_DIR", "")
    if not extra_dir or not os.path.exists(extra_dir):
        logger.warning(f"EXTRA_AUDIO_DIR not found: {extra_dir}")
        return {"error": f"Directory not found or not configured: {extra_dir}"}
        
    videos = repo.get_all()
    matched = 0
    
    # Pre-process videos for faster matching
    unmatched_videos = [v for v in videos if not v.is_downloaded]
    
    if not unmatched_videos:
        return {"matches_found": 0, "total_unmatched_remaining": 0}

    # Recursive scan using os.walk
    for root, _, files in os.walk(extra_dir):
        for filename in files:
            if not (filename.endswith('.mp3') or filename.endswith('.wav') or filename.endswith('.m4a')):
                continue
                
            file_lower = filename.lower()
            
            best_match = None
            best_score = 0
            
            for v in unmatched_videos:
                score = 0
                # Match title
                if v.title and v.title.lower() in file_lower:
                    score += 10
                
                # Match author
                if v.author and v.author.lower() in file_lower:
                    score += 5
                    
                # Match tags
                for t in v.tags:
                    if t and t.lower() in file_lower:
                        score += 1
                        
                if score > best_score and score >= 10:  # Must at least match title mostly
                    best_score = score
                    best_match = v
                    
            if best_match:
                # We found a match
                best_match.is_downloaded = True
                best_match.local_file = os.path.abspath(os.path.join(root, filename))
                repo.update_video(best_match.id, best_match)
                unmatched_videos.remove(best_match)
                matched += 1
                if not unmatched_videos:
                    break
        if not unmatched_videos:
            break
            
    logger.info(f"Scan complete: {matched} matches found.")
    return {"matches_found": matched, "total_unmatched_remaining": len(unmatched_videos)}
