@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo Verify Production Files
echo ========================================
echo.

set "PROD_DIR=E:\duihua\customer-service-system\服务器数据库"
set "DEPLOY_DIR=E:\duihua\customer-service-system\ubuntu-deploy-ready"
set "ERROR=0"

REM Calculate file hashes
echo Calculating file hashes...
echo.

REM Check database
if not exist "%DEPLOY_DIR%\customer_service.db" (
    echo [ERROR] Database file missing in deployment package!
    set ERROR=1
) else (
    for %%F in ("%PROD_DIR%\customer_service.db") do set PROD_DB_SIZE=%%~zF
    for %%F in ("%DEPLOY_DIR%\customer_service.db") do set DEPLOY_DB_SIZE=%%~zF
    
    if !PROD_DB_SIZE! neq !DEPLOY_DB_SIZE! (
        echo [ERROR] Database file size mismatch!
        echo   Production: !PROD_DB_SIZE! bytes
        echo   Deployment: !DEPLOY_DB_SIZE! bytes
        set ERROR=1
    ) else (
        echo [OK] Database: !DEPLOY_DB_SIZE! bytes
    )
)

REM Check certificate
if not exist "%DEPLOY_DIR%\certs\server.crt" (
    echo [ERROR] Certificate file missing in deployment package!
    set ERROR=1
) else (
    for %%F in ("%PROD_DIR%\server.crt") do set PROD_CRT_SIZE=%%~zF
    for %%F in ("%DEPLOY_DIR%\certs\server.crt") do set DEPLOY_CRT_SIZE=%%~zF
    
    if !PROD_CRT_SIZE! neq !DEPLOY_CRT_SIZE! (
        echo [ERROR] Certificate file size mismatch!
        echo   Production: !PROD_CRT_SIZE! bytes
        echo   Deployment: !DEPLOY_CRT_SIZE! bytes
        set ERROR=1
    ) else (
        echo [OK] Certificate: !DEPLOY_CRT_SIZE! bytes
    )
)

REM Check key
if not exist "%DEPLOY_DIR%\certs\server.key" (
    echo [ERROR] Key file missing in deployment package!
    set ERROR=1
) else (
    for %%F in ("%PROD_DIR%\server.key") do set PROD_KEY_SIZE=%%~zF
    for %%F in ("%DEPLOY_DIR%\certs\server.key") do set DEPLOY_KEY_SIZE=%%~zF
    
    if !PROD_KEY_SIZE! neq !DEPLOY_KEY_SIZE! (
        echo [ERROR] Key file size mismatch!
        echo   Production: !PROD_KEY_SIZE! bytes
        echo   Deployment: !DEPLOY_KEY_SIZE! bytes
        set ERROR=1
    ) else (
        echo [OK] Key: !DEPLOY_KEY_SIZE! bytes
    )
)

echo.
echo ========================================

if %ERROR% equ 0 (
    echo [SUCCESS] All production files verified!
    echo ========================================
    echo.
    exit /b 0
) else (
    echo [FAILED] Production files verification failed!
    echo ========================================
    echo.
    echo Run this to fix:
    echo   scripts\sync-production-files.bat
    echo.
    exit /b 1
)
