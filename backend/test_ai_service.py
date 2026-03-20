import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from ai_service import chat_service
import logging

logger = logging.getLogger(__name__)

logger.info("Testing chat service...")
response = chat_service.send_message("i want to find tracks related to fast animals")
logger.info(f"Reply text: {response['reply']}")
logger.info(f"Debug info: {response['debug']}")
