@echo off
cd /d "%~dp0\..\receptionist-web"
echo Starting Receptionist Web on port 3005...
npm run dev -- -p 3005
