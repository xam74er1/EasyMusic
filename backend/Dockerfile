FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for some Python packages and yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install -U yt-dlp

COPY . .

# Expose port
EXPOSE 8082

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
