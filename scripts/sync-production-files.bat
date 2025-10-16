@echo off
chcp 65001 >nul
echo.
echo ========================================
echo Sync Production Files
echo ========================================
echo.

set "PROD_DIR=E:\duihua\customer-service-system\服务器数据库"
set "DEPLOY_DIR=E:\duihua\customer-service-system\ubuntu-deploy-ready"

if not exist "%DEPLOY_DIR%\certs" mkdir "%DEPLOY_DIR%\certs"

echo Copying database...
copy /Y "%PROD_DIR%\customer_service.db" "%DEPLOY_DIR%\customer_service.db" >nul

echo Copying certificate...
copy /Y "%PROD_DIR%\server.crt" "%DEPLOY_DIR%\certs\server.crt" >nul

echo Copying key...
copy /Y "%PROD_DIR%\server.key" "%DEPLOY_DIR%\certs\server.key" >nul

echo.
echo ========================================
echo Production files synced successfully!
echo ========================================
echo.

dir "%DEPLOY_DIR%\customer_service.db" | findstr /C:"customer_service.db"
dir "%DEPLOY_DIR%\certs\server.crt" | findstr /C:"server.crt"
dir "%DEPLOY_DIR%\certs\server.key" | findstr /C:"server.key"

echo.
pause
