@echo off
setlocal
cd /d "%~dp0..\"

set "PROJECT_ROOT=%CD%"
set "APP_ENTRY=%PROJECT_ROOT%\build"
set "LOG_FILE=%PROJECT_ROOT%\scripts\startup-launcher.log"

:: Ensure Node is on PATH when run at logon (common install locations)
set "NODE_DIR=%ProgramFiles%\nodejs"
if not exist "%NODE_DIR%\node.exe" set "NODE_DIR=%ProgramFiles(x86)%\nodejs"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"

if not exist "%APP_ENTRY%" (
  echo [My Local Planner] Build folder not found. Running npm run build... > "%LOG_FILE%"
  call npm run build >> "%LOG_FILE%" 2>&1
  if errorlevel 1 (
    echo Build failed. Check "%LOG_FILE%" >> "%LOG_FILE%"
    endlocal
    exit /b 1
  )
)

set "NODE_EXE=node"
where node >NUL 2>&1 || (
  echo [My Local Planner] node not found. Add Node to PATH. >> "%LOG_FILE%"
  endlocal
  exit /b 1
)

:: Start backend (serves API + static build on port 3000)
set "SERVER_JS=%PROJECT_ROOT%\server\index.js"
if not exist "%SERVER_JS%" (
  echo [My Local Planner] server\index.js not found. >> "%LOG_FILE%"
  endlocal
  exit /b 1
)

set "PORT=3000"
start "" /B powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/dashboard'"
"%NODE_EXE%" "%SERVER_JS%" >> "%LOG_FILE%" 2>&1
endlocal
