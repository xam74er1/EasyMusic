import os
from google import genai
from google.genai import types
from models import PlaylistRepo, Video, SoundEffect, SoundEffectRepo
from pydantic import BaseModel, Field
import uuid
import json
import urllib.request
import urllib.parse
from thefuzz import process, fuzz
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Re-configure on startup in main.py, but we can access env vars here
repo = PlaylistRepo()
sfx_repo = SoundEffectRepo()

class VideoMeta(BaseModel):
    title: str = Field(description="The title of the song or video")
    author: str = Field(description="The artist or author")
    gender: str = Field(description="The gender or genre of the song/artist")
    category: str = Field(description="The category for the playlist (e.g. Pop, Rock, Ambient, etc.)")
    tags: list[str] = Field(description="List of tags relevant to this song")

class FilenameAnalysisResult(BaseModel):
    filename: str
    metadata: VideoMeta

# We will store debug logs globally so we can intercept calls
_debug_calls = []

def add_videos_to_playlist(videos: list[VideoMeta]) -> str:
    """
    Adds one or more videos or songs to the playlist.
    Use this when the user wants to add music to their playlist.
    """
    added = []
    
    # Save to debug dump
    _debug_calls.append({
        "function": "add_videos_to_playlist",
        "videos": [v.model_dump() for v in videos]
    })
    
    for v in videos:
        new_video = Video(
            id=str(uuid.uuid4()),
            title=v.title,
            author=v.author,
            youtube_url="", # We don't search YouTube automatically right away
            category=v.category,
            speed="Medium",
            tags=v.tags + [f"Gender/Genre: {v.gender}"],
            duration="Unknown",
            is_downloaded=False
        )
        repo.add_video(new_video)
        added.append(f"'{v.title}' by {v.author}")
        
    return f"Successfully added {len(added)} videos: {', '.join(added)}. [Highlight New Sounds](#new)"

def get_current_playlist() -> str:
    """
    Retrieves the current videos in the playlist. Use this to summarize the playlist or answer questions about what is currently in it.
    """
    _debug_calls.append({"function": "get_current_playlist"})
    videos = repo.get_all()
    if not videos:
        return "The playlist is currently empty."
    
    summary = []
    for v in videos:
        summary.append(f"- {v.title} by {v.author} (Category: {v.category})")
    return "\n".join(summary)


def get_library_hierarchy() -> str:
    """
    Returns a summary of the current library hierarchy.
    It returns a list of all existing categories (folders) and the number of tracks inside them.
    Use this when the user asks what categories they have, or to understand the folder structure before reorganizing.
    """
    _debug_calls.append({"function": "get_library_hierarchy"})
    videos = repo.get_all()
    categories = {}
    for v in videos:
        cat = v.category or "Uncategorized"
        categories[cat] = categories.get(cat, 0) + 1
    
    if not categories:
        return "The library is empty."
        
    summary = ["Library Categories:"]
    for cat, count in sorted(categories.items()):
        summary.append(f"- {cat}: {count} tracks")
    return "\n".join(summary)

def query_tags_availability() -> str:
    """
    Returns a list of all unique tags currently used in the database.
    Use this to see what tags exist before suggesting tags to the user.
    """
    _debug_calls.append({"function": "query_tags_availability"})
    videos = repo.get_all()
    tags = set()
    for v in videos:
        for t in v.tags:
            tags.add(t)
    
    if not tags:
        return "No tags are currently used."
    return f"Available tags: {', '.join(sorted(list(tags)))}"

def update_category_bulk(old_category: str, new_category: str) -> str:
    """
    Changes the category for all tracks that currently belong to 'old_category' (or are inside it as a subcategory)
    to the 'new_category'. 
    Use this to rename folders or move entire categories of music to a different folder structure.
    """
    _debug_calls.append({
        "function": "update_category_bulk",
        "old_category": old_category,
        "new_category": new_category
    })
    
    videos = repo.get_all()
    count = 0
    for v in videos:
        if v.category == old_category or (v.category and v.category.startswith(old_category + "/")):
            new_cat = v.category.replace(old_category, new_category, 1) if v.category else new_category
            v.category = new_cat
            repo.update_video(v.id, v)
            count += 1
            
    return f"Successfully moved {count} tracks from '{old_category}' to '{new_category}'."

class MoveOperation(BaseModel):
    move: str = Field(description="The exact or approximate name of the item (folder, category, or track) to move")
    to: str = Field(description="The precise destination category or folder to move it to")

def batch_reorganize(plan: list[MoveOperation]) -> str:
    """
    Propose a batch reorganization of the library. 
    Use this strictly when the user asks for complex restructuring, like moving multiple tracks or simplifying folders.
    This function DOES NOT execute the changes immediately; it returns a proposal plan for the user to confirm.
    """
    _debug_calls.append({
        "function": "batch_reorganize",
        "plan": [p.model_dump() for p in plan]
    })
    return "Proposed plan generated successfully. Tell the user to review the preview."

def find_and_download_sfx(query: str, category: str = "Uncategorized", tags: Optional[list[str]] = None) -> str:
    """
    Finds and downloads a sound effect from Pixabay based on the query.
    Use this when the user asks to find, get, or download a specific sound effect.
    """
    tags = tags or []
    _debug_calls.append({
        "function": "find_and_download_sfx",
        "query": query,
        "category": category,
        "tags": tags
    })
    
    pixabay_key = os.getenv("PIXABAY_API_KEY", "")
    if not pixabay_key or pixabay_key == "your_key_here":
        return "Failed: PIXABAY_API_KEY is not configured in .env."

    url = f"https://pixabay.com/api/audio/?key={pixabay_key}&q={urllib.parse.quote(query)}&category=sound%20effects"
    try:
        req = urllib.request.Request(url, headers={
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            hits = data.get("hits", [])
            
            if not hits:
                return f"No sound effects found for query: '{query}'"
                
            best_hit = hits[0]
            audio_url = best_hit.get("audio") or best_hit.get("preview")
            if not audio_url:
                return "Failed: Found a match but could not get its audio URL."
                
            # Perform Download
            from download_service import DOWNLOAD_DIR
            se_dir = os.path.join(DOWNLOAD_DIR, "sound_effects")
            os.makedirs(se_dir, exist_ok=True)
            
            filename = f"{uuid.uuid4().hex[:8]}.mp3"
            local_path = os.path.join(se_dir, filename)
            
            dl_req = urllib.request.Request(audio_url, headers={
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
            })
            with urllib.request.urlopen(dl_req) as dl_resp:
                data = dl_resp.read()
                
                # Basic validation: check if the response is actually an HTML page (Cloudflare Block)
                if data.startswith(b'<!DOCTYPE html>') or data.startswith(b'<html'):
                    return "Failed: Pixabay blocked the audio download (returned HTML instead of MP3)."
                    
                with open(local_path, 'wb') as out_file:
                    out_file.write(data)
                    
            from download_service import trim_silence
            trim_silence(local_path)
                
            name = best_hit.get("tags", "").split(',')[0].strip() or f"Sound_{filename[:4]}"
            
            effect = SoundEffect(
                name=name,
                local_file=os.path.join("sound_effects", filename).replace('\\', '/'),
                source_url=audio_url,
                category=category,
                tags=tags
            )
            sfx_repo.create(effect)
            return f"Successfully downloaded '{name}' into category '{category}'. [Highlight New Sounds](#new)"
            
    except Exception as e:
        return f"Failed to download sound effect due to an error: {str(e)}"

def find_and_download_cc(query: str, category: str = "Uncategorized", tags: Optional[list[str]] = None) -> str:
    """
    Finds and downloads a Creative Commons track from the Free Music Archive.
    Use this when the user asks for royalty-free, CC, or copyright-free music.
    """
    tags = tags or []
    _debug_calls.append({
        "function": "find_and_download_cc",
        "query": query,
        "category": category,
        "tags": tags
    })

    from cc_service import search_cc_tracks, download_cc_track, CCSourceUnavailableError, CCTrack

    try:
        tracks = search_cc_tracks(query)
    except CCSourceUnavailableError as e:
        return f"Failed to search Creative Commons tracks: {str(e)}"

    if not tracks:
        return f"No Creative Commons track found for query: '{query}'"

    track = tracks[0]

    # Merge any extra tags provided by the caller
    if tags:
        track = CCTrack(
            id=track.id,
            title=track.title,
            author=track.author,
            license=track.license,
            preview_url=track.preview_url,
            download_url=track.download_url,
            tags=list(track.tags) + [t for t in tags if t not in track.tags],
        )

    try:
        download_cc_track(track, category)
    except Exception as e:
        return f"Failed to download CC track '{track.title}': {str(e)}"

    return (
        f"Successfully downloaded '{track.title}' by {track.author} "
        f"(License: {track.license}) into category '{category}'. [Highlight New Sounds](#new)"
    )


def find_and_download_youtube_sfx(query: str, category: str = "Uncategorized", tags: Optional[list[str]] = None) -> str:
    """
    Finds and downloads a sound effect from YouTube. 
    PRIORITIZE using this over Pixabay by default whenever a user asks for a sound effect, unless they specifically ask for Pixabay.
    """
    _debug_calls.append({"function": "find_and_download_youtube_sfx", "query": query, "category": category, "tags": tags})
    import yt_dlp
    from download_service import DOWNLOAD_DIR
    
    if tags is None:
        tags = ["YouTube", "SFX"]
    elif "YouTube" not in tags:
        tags.append("YouTube")
        
    se_dir = os.path.join(DOWNLOAD_DIR, "sound_effects")
    os.makedirs(se_dir, exist_ok=True)
    
    # Force searching for short SFX. Download first hit.
    search_query = f"ytsearch1:{query} sound effect short animation"
    filename = f"{uuid.uuid4().hex[:8]}.mp3"
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'outtmpl': os.path.join(se_dir, f"{filename[:-4]}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    
    try:
        logger.info(f"YouTube search API call: query '{search_query}'")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(search_query, download=True)
            entries = info.get('entries', [])
            logger.info(f"YouTube search returned {len(entries)} results for query '{query}'")
            if not entries:
                return "Failed: No sound effect found on YouTube for that query."
                
            entry = entries[0]
            title = entry.get('title', 'Unknown YouTube SFX')
            url = entry.get('webpage_url', '') or entry.get('original_url', '') or search_query
            
        from download_service import trim_silence
        trim_silence(os.path.join(se_dir, filename))
            
        effect = SoundEffect(
            name=title,
            local_file=os.path.join("sound_effects", filename).replace('\\', '/'),
            source_url=url,
            category=category,
            tags=tags
        )
        sfx_repo.create(effect)
        return f"Successfully found and downloaded '{title}' from YouTube into category '{category}'. [Highlight New Sounds](#new)"
    except Exception as e:
        return f"Failed to download YT sound effect due to an error: {str(e)}"

def set_download_preference(mode: str) -> str:
    """
    Sets the preferred download mode for the application.
    Valid modes are 'youtube', 'spotify', and 'cc'.
    Use this when the user says they want to change how music is downloaded (e.g. "always use Spotify" or "prefer Creative Commons").
    """
    _debug_calls.append({"function": "set_download_preference", "mode": mode})
    from download_service import set_download_mode
    try:
        set_download_mode(mode)
        return f"Download mode has been set to '{mode}'."
    except ValueError as e:
        return f"Failed to set download mode: {str(e)}"

def analyze_filenames(filenames: list[str]) -> list[FilenameAnalysisResult]:
    """
    Analyzes a list of filenames to extract structured metadata (title, author, genre, category, tags).
    Use this when you need to predict metadata from raw file names.
    """
    # This is a helper for the internal direct call, but we also expose it as a tool if needed
    _debug_calls.append({"function": "analyze_filenames", "filenames": filenames})
    # The actual logic will be handled by the LLM when called via the API
    return []

gemini_tools = [add_videos_to_playlist, get_current_playlist, get_library_hierarchy, query_tags_availability, update_category_bulk, batch_reorganize, find_and_download_sfx, find_and_download_youtube_sfx, find_and_download_cc, analyze_filenames, set_download_preference]

class ChatService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            self.client = genai.Client(api_key=self.api_key)
            self.config = types.GenerateContentConfig(
                tools=gemini_tools,
                temperature=0.7,
                system_instruction="You are an Improv Theater music assistant. Your job is to manage a playlist of songs and audio tracks for improv shows. If a user asks to add songs or sounds (even vaguely like '2 happy pop songs' or 'a scary sound'), you DO NOT ask for clarification. Instead, use your knowledge to pick appropriate real songs or audio tracks that fit the description and immediately call the add_videos_to_playlist function to add them. Unless the user explicitly asks for just one song, ALWAYS try to add multiple songs, not just one. ALWAYS specify the author, title, genre, category, and tags. You are also capable of answering questions about the current tags and library structure, and you can reorganize the users categories by renaming/moving them using the update_category_bulk tool. IF the user asks to find, download, or get a 'sound effect', 'SFX', or specific effect (like 'gunshot' or 'applause'), aggressively use the find_and_download_youtube_sfx tool to download it from YouTube. ONLY use the find_and_download_sfx (Pixabay) tool if the user explicitly mentions Pixabay. You can also analyze filenames to extract metadata using the analyze_filenames tool. When the user asks for royalty-free, Creative Commons, CC, or copyright-free music, use the find_and_download_cc tool to search and download from the Free Music Archive. Use the standard YouTube/Spotify download tools for regular music requests. You can also change the application's global download preference (youtube, spotify, or cc) using the set_download_preference tool if the user asks you to change the source or mode.",
            )
            # Use a dictionary to store lightweight chat sessions
            self.sessions = {}
        else:
            self.client = None

    def get_chat(self, session_id: str = "default"):
        if not self.client:
            return None
            
        if session_id not in self.sessions:
            self.sessions[session_id] = self.client.chats.create(model="gemini-2.5-flash", config=self.config)
            
        return self.sessions[session_id]

    def send_message(self, message: str, session_id: str = "default") -> dict:
        global _debug_calls
        if not self.client:
            return {
                "reply": "Error: Gemini API key is not configured for the backend. Please check your .env file.",
                "debug": {"question": message, "error": "Gemini API key missing", "function_calls": []}
            }
            
        chat = self.get_chat(session_id)
        
        # Reset debug calls for this request
        _debug_calls.clear()
        
        try:
            response = chat.send_message(message)
            
            # If the model only used tools and didn't provide a final text response
            reply_text = response.text
            
            # Check if there is a change plan
            change_plan = None
            for call in _debug_calls:
                if call["function"] == "batch_reorganize":
                    change_plan = call.get("plan", [])
                    
            if not reply_text:
                if _debug_calls:
                    reply_text = f"I've completed {len(_debug_calls)} operations: " + ", ".join([c["function"] for c in _debug_calls])
                else:
                    reply_text = "I've processed your request."
                    
            return {
                "reply": reply_text,
                "change_plan": change_plan,
                "debug": {
                    "question": message,
                    "error": None,
                    "function_calls": list(_debug_calls)
                }
            }
        except Exception as e:
            logger.error(f"Chat completion failed: {e}")
            logger.exception(e)
            return {
                "reply": "An error occurred while communicating with the AI.",
                "debug": {
                    "question": message,
                    "error": str(e),
                    "function_calls": list(_debug_calls)
                }
            }

    async def analyze_metadata_bulk(self, filenames: list[str]) -> list[FilenameAnalysisResult]:
        """ Specialized call to Gemini to extract metadata from filenames without tool calling overhead. """
        if not self.client:
            return []
            
        prompt = f"Analyze these filenames and extract metadata (title, author, gender/genre, category, tags) for each. If a filename is unclear, use your knowledge of music to guess or provide sensible defaults. Return a JSON list of objects matching the FilenameAnalysisResult schema.\n\nFilenames:\n" + "\n".join(filenames)
        
        try:
            response = await self.client.models.generate_content_async(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[FilenameAnalysisResult]
                )
            )
            return response.parsed
        except Exception as e:
            logger.error(f"Metadata analysis failed: {e}")
            return []

# Global instance
chat_service = ChatService()
