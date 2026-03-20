# EasyMusic Application

A full-stack application featuring a React/Vite frontend and a FastAPI (Python) backend for managing and playing an improv music playlist.

## Getting Started (Windows)

You can easily start and stop the application using the provided batch scripts:

1. **Start the application**: Double-click `start.bat` from this folder. It will open two new command prompt windows:
   - One for the backend API (running on `http://localhost:8000`)
   - One for the frontend UI (running on `http://localhost:5173`)
   
2. **Stop the application**: Double-click `stop.bat` to gracefully close the command prompt windows opened by the start script.

## Getting Started (Docker)

If you prefer to run the application using Docker, a `docker-compose.yml` file is provided.

1. Make sure you have Docker Desktop installed and running.
2. If you have an environment file, make sure it's placed in `backend/.env`.
3. Open a terminal in this directory and run:
   ```bash
   docker-compose up --build
   ```
4. Access the application at `http://localhost:5173`.
5. To stop the containers, press `Ctrl+C` in the terminal or run:
   ```bash
   docker-compose down
   ```

## Development Requirements
- **Node.js** (v18+)
- **Python** (3.11+)
- **Docker** (optional for containerized runtime)
