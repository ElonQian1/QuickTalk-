@echo off
chcp 65001 >nul
echo.
echo ========================================
echo Setup Symbolic Links for Production Files
echo ========================================
echo.
echo This will create symbolic links to ensure
echo the deployment package ALWAYS uses the
echo correct production files.
echo.

set "PROD_DIR=E:\duihua\customer-service-system\服务器数据库"
set "DEPLOY_DIR=E:\duihua\customer-service-system\ubuntu-deploy-ready"

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Remove existing files if they exist
if exist "%DEPLOY_DIR%\customer_service.db" del /F "%DEPLOY_DIR%\customer_service.db"
if exist "%DEPLOY_DIR%\certs\server.crt" del /F "%DEPLOY_DIR%\certs\server.crt"
if exist "%DEPLOY_DIR%\certs\server.key" del /F "%DEPLOY_DIR%\certs\server.key"

REM Create symbolic links
echo Creating symbolic link for database...
mklink "%DEPLOY_DIR%\customer_service.db" "%PROD_DIR%\customer_service.db"

echo.
echo Creating symbolic link for certificate...
mklink "%DEPLOY_DIR%\certs\server.crt" "%PROD_DIR%\server.crt"

echo.
echo Creating symbolic link for key...
mklink "%DEPLOY_DIR%\certs\server.key" "%PROD_DIR%\server.key"

echo.
echo ========================================
echo Symbolic Links Created Successfully!
echo ========================================
echo.
echo The deployment package now PHYSICALLY links
echo to the production files. Any changes in
echo either location will be reflected in both.
echo.
echo This guarantees you're always using the
echo correct production files!
echo.

dir "%DEPLOY_DIR%\customer_service.db"
dir "%DEPLOY_DIR%\certs\server.*"

echo.
pause
