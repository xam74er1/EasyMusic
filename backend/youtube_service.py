import os
from googleapiclient.discovery import build
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

class YouTubeResult(BaseModel):
    title: str
    author: str
    url: str
    duration: str = "Unknown"
    thumbnail: str = ""
    view_count: int = 0
    raw_data: dict = {}

def search_youtube(query: str, max_results: int = 5) -> list[YouTubeResult]:
    if not YOUTUBE_API_KEY or YOUTUBE_API_KEY == "your_youtube_api_key_here":
        logger.warning("YouTube API Key not set.")
        return [YouTubeResult(title=query, author="Unknown", url="", duration="")]
        
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    
    # search for videos
    search_request = youtube.search().list(
        part="snippet",
        q=query + " music", # Append music to improve results
        type="video",
        maxResults=max_results * 2 # get more results to filter by views
    )
    logger.info(f"YouTube Data API search call: query '{query}'")
    search_response = search_request.execute()
    logger.info(f"YouTube Data API search returned {len(search_response.get('items', []))} items")
    
    video_ids = [item["id"]["videoId"] for item in search_response.get("items", [])]
    if not video_ids:
        return []
        
    # get video details including statistics (view count)
    video_request = youtube.videos().list(
        part="snippet,contentDetails,statistics",
        id=",".join(video_ids)
    )
    logger.info(f"YouTube Data API video details call for {len(video_ids)} videos")
    video_response = video_request.execute()
    
    results = []
    for item in video_response.get("items", []):
        stats = item.get("statistics", {})
        view_count = int(stats.get("viewCount", 0))
        
        # Only take videos with more than 100k views as requested
        if view_count < 100000:
            continue
            
        video_id = item["id"]
        title = item["snippet"]["title"]
        author = item["snippet"]["channelTitle"]
        url = f"https://www.youtube.com/watch?v={video_id}"
        thumbnail = item["snippet"]["thumbnails"].get("high", {}).get("url", 
                     item["snippet"]["thumbnails"].get("default", {}).get("url", ""))
        
        results.append(YouTubeResult(
            title=title, 
            author=author, 
            url=url, 
            thumbnail=thumbnail,
            view_count=view_count,
            raw_data=item
        ))
        
        if len(results) >= max_results:
            break
            
    return results
