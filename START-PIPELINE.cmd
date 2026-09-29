@echo off
setlocal
title SKLOP pipeline
cd /d "%~dp0"
echo.
echo   SKLOP pipeline - ne zatvaraj ovaj prozor. Status: pipeline\STATUS.md
echo.
where pwsh >nul 2>nul
if %errorlevel%==0 goto usepwsh
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pipeline\run-pipeline.ps1" %*
goto done
:usepwsh
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0pipeline\run-pipeline.ps1" %*
:done
echo.
echo   Pipeline je zavrsio ili je zaustavljen. Pogledaj pipeline\STATUS.md
pause
