@echo off
setlocal enabledelayedexpansion

echo =========================================
echo   EasyMusic Complete Build Script
echo =========================================

echo.
echo [1/3] Building Python Backend (PyInstaller)...
cd backend
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Installing backend requirements...
pip install -r requirements.txt
pip install pyinstaller

echo Running PyInstaller...
pyinstaller easymusic.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo [ERROR] Backend build failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/3] Building Frontend (Vite)...
cd frontend
echo Installing frontend dependencies...
call npm install
echo Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo [3/3] Packaging Electron Application...
cd electron
echo Installing electron dependencies...
call npm install

echo Building electron app...
call npm run dist
if %errorlevel% neq 0 (
    echo [ERROR] Electron build failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo =========================================
echo   Build Complete!
echo =========================================
echo Your unpacked executable is located at:
echo electron\dist\win-unpacked\EasyMusic.exe
echo.
pause
