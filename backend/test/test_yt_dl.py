import os
from yt_dlp import YoutubeDL

url = "https://www.youtube.com/watch?v=7QqdFDlBalU"

print(f"Minimal test for: {url}")
ydl_opts = {
    'quiet': False,
    'nocheckcertificate': True,
}

try:
    with YoutubeDL(ydl_opts) as ydl:
        res = ydl.download([url])
        print(f"Result: {res}")
except Exception as e:
    print(f"Error: {e}")
