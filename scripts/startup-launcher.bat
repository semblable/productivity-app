@echo off
setlocal
cd /d "%~dp0..\"

set "PROJECT_ROOT=%CD%"
set "APP_ENTRY=%PROJECT_ROOT%\build"
if not exist "%APP_ENTRY%" (
  echo [My Local Planner] Build folder not found. Running npm run build first.
  call npm run build
)

start "" /B "%PROJECT_ROOT%\node_modules\.bin\serve.cmd" -s build -l 3000 >NUL 2>&1
start "" "http://localhost:3000/dashboard"
