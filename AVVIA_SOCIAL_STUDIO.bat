@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python non trovato. Installa Python 3 e riprova.
  pause
  exit /b 1
)
python social_studio_server.py
if errorlevel 1 pause
