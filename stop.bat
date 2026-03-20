@echo off
echo Stopping EasyMusic Application...

echo Closing Backend window...
taskkill /fi "WINDOWTITLE eq EasyMusic-Backend*" /t /f >nul 2>&1

echo Closing Frontend window...
taskkill /fi "WINDOWTITLE eq EasyMusic-Frontend*" /t /f >nul 2>&1

echo.
echo Application stopped.
pause
