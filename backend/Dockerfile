FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for some Python packages and yt-dlp
# Node.js 20 LTS is required for yt-dlp to solve YouTube's JS challenges (signature + n-parameter)
RUN apt-get update && apt-get install -y curl gnupg ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install -U yt-dlp

COPY . .

# Expose port
EXPOSE 8082

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
