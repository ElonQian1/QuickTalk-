@echo off
setlocal enableextensions enabledelayedexpansion

REM Auto free port 8080 if occupied
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  echo [dev] Port 8080 in use by PID %%p, killing...
  taskkill /F /PID %%p >nul 2>nul
)

set DATABASE_URL=sqlite:customer_service.db
set JWT_SECRET=your-super-secret-jwt-key
set SERVER_HOST=0.0.0.0
set SERVER_PORT=8080

echo [dev] Starting backend on %SERVER_HOST%:%SERVER_PORT%
customer-service-final.exe

endlocal
