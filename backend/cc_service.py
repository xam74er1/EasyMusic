import os
import re
import uuid
import logging
import requests
from pathvalidate import sanitize_filename
from pydantic import BaseModel
from mutagen.id3 import ID3, TIT2, TPE1, TCON, COMM, error as ID3Error

from models import PlaylistRepo, Video

logger = logging.getLogger(__name__)

# Resolve DOWNLOAD_DIR the same way download_service.py does
_USER_DATA_DIR = os.environ.get("USER_DATA_DIR", os.path.dirname(os.path.abspath(__file__)))
DOWNLOAD_DIR = os.path.join(_USER_DATA_DIR, "downloads")

FMA_API_BASE = "https://freemusicarchive.org/api/"

repo = PlaylistRepo()


class CCSourceUnavailableError(Exception):
    """Raised when the Free Music Archive API is unreachable or returns an unexpected error."""


class CCTrack(BaseModel):
    id: str
    title: str
    author: str
    license: str          # e.g. "CC BY 4.0"
    preview_url: str
    download_url: str
    tags: list[str] = []


def search_cc_tracks(query: str, limit: int = 10) -> list[CCTrack]:
    """Search the Free Music Archive for CC-licensed tracks.

    Args:
        query: Search keyword, mood, or genre.
        limit: Maximum number of results to return (default 10).

    Returns:
        A list of CCTrack objects matching the query.

    Raises:
        CCSourceUnavailableError: If the FMA API is unreachable or returns an error.
    """
    if not query or not query.strip():
        return []

    params: dict = {"search": query.strip(), "limit": limit}

    api_key = os.environ.get("FMA_API_KEY")
    if api_key:
        params["api_key"] = api_key

    try:
        response = requests.get(
            f"{FMA_API_BASE}tracks/",
            params=params,
            timeout=15,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        logger.error(f"FMA API request failed: {exc}")
        raise CCSourceUnavailableError(f"Free Music Archive is unreachable: {exc}") from exc

    try:
        data = response.json()
    except ValueError as exc:
        logger.error(f"FMA API returned invalid JSON: {exc}")
        raise CCSourceUnavailableError("Free Music Archive returned an invalid response") from exc

    dataset = data.get("dataset", [])
    tracks: list[CCTrack] = []

    for item in dataset:
        try:
            track = CCTrack(
                id=str(item.get("track_id", "")),
                title=item.get("track_title", ""),
                author=item.get("artist_name", ""),
                license=item.get("license_title", ""),
                preview_url=item.get("track_url", ""),
                download_url=item.get("track_file", ""),
                tags=[],
            )
            tracks.append(track)
        except Exception as exc:
            logger.warning(f"Skipping malformed FMA track entry: {exc}")

    return tracks


def download_cc_track(track: CCTrack, category: str, existing_video_id: str = None) -> str:
    """Download a CC track, write ID3 tags, save to disk, and register in PlaylistRepo.

    Args:
        track: The CCTrack to download.
        category: The library category (sub-folder under downloads/).
        existing_video_id: If provided, update this record instead of creating a new one.

    Returns:
        The relative file path (e.g. "Jazz/my_track.mp3").

    Raises:
        Exception: If the download or file write fails.
    """
    cat_dir = os.path.join(DOWNLOAD_DIR, category)
    os.makedirs(cat_dir, exist_ok=True)

    safe_name = sanitize_filename(f"{track.title} - {track.author}")
    if not safe_name:
        safe_name = f"cc_track_{track.id}"
    final_mp3_path = os.path.join(cat_dir, f"{safe_name}.mp3")

    # Download audio
    try:
        response = requests.get(track.download_url, timeout=60, stream=True)
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        logger.error(f"Failed to download CC track '{track.title}': {exc}")
        raise

    with open(final_mp3_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    logger.info(f"CC track saved to {final_mp3_path}")

    # Write ID3 tags
    tags_str = ", ".join(track.tags) if track.tags else ""
    try:
        try:
            audio = ID3(final_mp3_path)
        except ID3Error:
            audio = ID3()

        audio.add(TIT2(encoding=3, text=track.title))
        audio.add(TPE1(encoding=3, text=track.author))
        if tags_str:
            audio.add(TCON(encoding=3, text=tags_str))
        audio.add(COMM(encoding=3, lang="eng", desc="License", text=track.license))
        audio.add(COMM(encoding=3, lang="eng", desc="Source URL", text=track.preview_url))

        audio.save(final_mp3_path, v2_version=4)
        logger.info(f"ID3 tags written for CC track '{track.title}'")
    except Exception as tag_err:
        logger.error(f"Failed to write ID3 tags for CC track '{track.title}': {tag_err}")

    # Build tag list including the license
    video_tags = list(track.tags)
    if track.license and track.license not in video_tags:
        video_tags.append(track.license)

    rel_path = os.path.join(category, f"{safe_name}.mp3").replace("\\", "/")

    if existing_video_id:
        video = next((v for v in repo.get_all() if v.id == existing_video_id), None)
        if video:
            video.title = track.title
            video.author = track.author
            video.category = category
            video.tags = list(set(video.tags + video_tags))
            video.is_downloaded = True
            video.local_file = rel_path
            video.download_error = None
            repo.update_video(existing_video_id, video)
            logger.info(f"CC track '{track.title}' updated in PlaylistRepo with id={existing_video_id}")
            return rel_path

    # Create new record if no existing_video_id or record not found
    video = Video(
        id=str(uuid.uuid4()),
        title=track.title,
        author=track.author,
        youtube_url="",
        category=category,
        tags=video_tags,
        is_downloaded=True,
        local_file=rel_path,
    )

    repo.add_video(video)
    logger.info(f"CC track '{track.title}' added to PlaylistRepo with id={video.id}")

    return rel_path
