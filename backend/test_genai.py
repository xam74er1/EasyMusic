import os
from dotenv import load_dotenv
load_dotenv()
from ai_service import parse_youtube_track_description
from google import genai
from google.genai import types
import traceback
import logging

logger = logging.getLogger(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def test_parse():
    text = "Here's a breakdown of the video:\n\n*   **Original Author:** Imagine Dragons\n*   **Original Title:** Believer\n*   **Category:** Pop/Rock\n*   **Tags:** Alternative, Indie, Rock, Pop\n"
    
    title, author, category, tags = parse_youtube_track_description(text)
    
    logger.info(f"Adding {title} by {author} to {category} with {tags}")
    return f"Successfully added {title} by {author}"

try:
    config = types.GenerateContentConfig(tools=[test_parse], temperature=0.7)
    chat = client.chats.create(model="gemini-2.5-flash", config=config)
    try:
        response = chat.send_message("Extract the title, author, appropriate category, and tags for this video string: 'Imagine Dragons - Believer (Official Music Video)'.")
        logger.info(f"Text: {response.text}")
        logger.info(f"Function Calls: {response.function_calls}")
    except Exception as e:
        logger.error(f"Error: {e}")
        traceback.print_exc()
except Exception as e:
    logger.error(f"Outer error: {e}")
    traceback.print_exc()
