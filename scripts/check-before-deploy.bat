@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo Pre-Deployment Checklist
echo ========================================
echo.

set "ROOT_DIR=E:\duihua\customer-service-system"
set "DEPLOY_DIR=%ROOT_DIR%\ubuntu-deploy-ready"
set "ERROR=0"

echo Checking deployment package...
echo.

REM 1. Check backend binary
echo [1/5] Backend binary...
if not exist "%DEPLOY_DIR%\customer-service-backend" (
    echo   [FAIL] Backend binary not found!
    set ERROR=1
) else (
    for %%F in ("%DEPLOY_DIR%\customer-service-backend") do set SIZE=%%~zF
    if !SIZE! LSS 5000000 (
        echo   [WARN] Backend binary seems too small: !SIZE! bytes
        set ERROR=1
    ) else (
        echo   [PASS] Backend binary: !SIZE! bytes
    )
)

REM 2. Check frontend files
echo [2/5] Frontend files...
if not exist "%DEPLOY_DIR%\static\index.html" (
    echo   [FAIL] Frontend not compiled!
    set ERROR=1
) else (
    echo   [PASS] Frontend files present
)

REM 3. Check database
echo [3/5] Production database...
if not exist "%DEPLOY_DIR%\customer_service.db" (
    echo   [FAIL] Database not found!
    set ERROR=1
) else (
    for %%F in ("%DEPLOY_DIR%\customer_service.db") do set SIZE=%%~zF
    if !SIZE! LSS 50000 (
        echo   [WARN] Database seems too small: !SIZE! bytes
        echo   [HINT] Make sure you synced production database!
        set ERROR=1
    ) else (
        echo   [PASS] Database: !SIZE! bytes
    )
)

REM 4. Check certificate
echo [4/5] SSL certificate...
if not exist "%DEPLOY_DIR%\certs\server.crt" (
    echo   [FAIL] Certificate not found!
    set ERROR=1
) else (
    for %%F in ("%DEPLOY_DIR%\certs\server.crt") do set SIZE=%%~zF
    echo   [PASS] Certificate: !SIZE! bytes
)

REM 5. Check key
echo [5/5] SSL key...
if not exist "%DEPLOY_DIR%\certs\server.key" (
    echo   [FAIL] Key not found!
    set ERROR=1
) else (
    for %%F in ("%DEPLOY_DIR%\certs\server.key") do set SIZE=%%~zF
    echo   [PASS] Key: !SIZE! bytes
)

echo.
echo ========================================

if %ERROR% equ 0 (
    echo [SUCCESS] Ready to deploy!
    echo ========================================
    echo.
    echo Next steps:
    echo   1. Upload ubuntu-deploy-ready folder to /root/
    echo   2. SSH to server
    echo   3. cd /root/ubuntu-deploy-ready
    echo   4. chmod +x customer-service-backend *.sh
    echo   5. ./start.sh
    echo.
    exit /b 0
) else (
    echo [FAILED] Deployment package incomplete!
    echo ========================================
    echo.
    echo Fix issues:
    echo   - Missing backend: npm run compile:backend
    echo   - Missing frontend: npm run compile:frontend
    echo   - Missing production files: npm run sync:prod
    echo   - Or run: npm run build:production
    echo.
    exit /b 1
)
