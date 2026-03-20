import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from ai_service import chat_service
import logging

logger = logging.getLogger(__name__)

logger.info("Testing tags query...")
response = chat_service.send_message("What tags are currently available in my library?")
logger.info(f"Reply text: {response['reply']}")
logger.info(f"Debug info: {response['debug']}")

logger.info("\nTesting rename query...")
response = chat_service.send_message("Rename the 'Music' category to 'Unsorted Music'.")
logger.info(f"Reply text: {response['reply']}")
logger.info(f"Debug info: {response['debug']}")
