@echo off
echo Starting EasyMusic Application...

echo.
echo =====================
echo Starting Backend API
echo =====================
cd backend

IF NOT EXIST ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Starting backend service in a new window...
start "EasyMusic-Backend" cmd /c "set LOG_LEVEL=DEBUG && call .venv\Scripts\activate.bat && pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8082 --reload --log-level debug"

cd ..

echo.
echo =====================
echo Starting Frontend
echo =====================
cd frontend

echo Checking frontend configuration...
findstr /C:"YOUR_SERVER_IP" .env >nul
if %errorlevel%==0 (
    echo Setting default API host to localhost in frontend/.env...
    powershell -Command "(gc .env) -replace 'YOUR_SERVER_IP', 'localhost' | Out-File -encoding utf8 .env"
)

echo Installing frontend dependencies if needed...
call npm install

echo Starting frontend service in a new window...
start "EasyMusic-Frontend" cmd /c "npm run dev"

cd ..

echo.
echo Application components are starting in separate windows.
echo - Backend will be available at: http://localhost:8082
echo - Frontend will be available at: http://localhost:5173
echo.
echo You can use stop.bat to close these windows later.
pause
