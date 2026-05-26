@echo off
echo Starting EasyMusic Application (Web Mode)...

echo.
echo =====================
echo Starting Backend API
echo =====================
cd backend

IF NOT EXIST ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Starting backend service on port 8082...
start "EasyMusic-Backend" cmd /c "call .venv\Scripts\activate.bat && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8082 --reload"

timeout /t 3

cd ..

echo.
echo =====================
echo Starting Frontend
echo =====================
cd frontend

echo Installing frontend dependencies if needed...
call npm install

echo Starting frontend dev server on port 5173...
start "EasyMusic-Frontend" cmd /c "npm run dev"

cd ..

echo.
echo =====================
echo Application Starting
echo =====================
echo - Backend API: http://127.0.0.1:8082
echo - Frontend: http://127.0.0.1:5173
echo.
echo Open http://127.0.0.1:5173 in your browser
echo.
pause
