import logging
from ytmusicapi import YTMusic
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class SpotifySyncResult(BaseModel):
    title: str
    author: str
    spotify_url: str = ""
    thumbnail: str = ""
    duration: str = "00:00"
    raw_data: dict = {}

def search_spotify_metadata(query: str) -> list[SpotifySyncResult]:
    """
    Search for high-quality music metadata. 
    Uses YouTube Music as a high-fidelity alternative when direct Spotify search is blocked or limited.
    """
    logger.info(f"SpotifySync: Starting search for query: '{query}'")
    try:
        yt = YTMusic()
        logger.debug("SpotifySync: YTMusic client initialized.")
        
        # Search for songs to get clean metadata
        search_results = yt.search(query, filter="songs")
        logger.info(f"SpotifySync: YTMusic search returned {len(search_results)} results.")
        
        results = []
        for i, res in enumerate(search_results):
            # Map thumbnails
            thumbnails = res.get('thumbnails', [])
            best_thumb = thumbnails[-1].get('url') if thumbnails else ""
            
            # Duration formatting
            dur = res.get('duration', '00:00')
            
            title = res.get('title', 'Unknown')
            artists = ", ".join([a.get('name') for a in res.get('artists', [])])
            
            logger.debug(f"SpotifySync: Processing result {i+1}: {title} by {artists}")
            
            results.append(SpotifySyncResult(
                title=title,
                author=artists,
                spotify_url="", 
                thumbnail=best_thumb,
                duration=dur,
                raw_data=res
            ))
            
            if len(results) >= 5:
                break
        
        logger.info(f"SpotifySync: Successfully extracted metadata for {len(results)} tracks.")
        return results
    except Exception as e:
        logger.error(f"SpotifySync: Error searching metadata via YouTube Music: {e}", exc_info=True)
        return []

def get_spotify_track_metadata(track_url: str) -> SpotifySyncResult:
    """Gets metadata for a specific Spotify track. Not implemented yet without API key."""
    # Placeholder
    return None
