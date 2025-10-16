@echo off
chcp 65001 >nul
echo.
echo ========================================
echo Update Ubuntu Deployment Package
echo ========================================
echo.

set "ROOT_DIR=E:\duihua\customer-service-system"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "DEPLOY_DIR=%ROOT_DIR%\ubuntu-deploy-ready"
set "PROD_DIR=%ROOT_DIR%\服务器数据库"

echo Step 1/5: Compiling Rust backend (Linux HTTPS)...
cd "%BACKEND_DIR%"
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
if errorlevel 1 (
    echo ERROR: Backend compilation failed!
    pause
    exit /b 1
)

echo Step 2/5: Copying backend binary...
copy /Y "%BACKEND_DIR%\target\x86_64-unknown-linux-musl\release\customer-service-backend" "%DEPLOY_DIR%\customer-service-backend" >nul

echo Step 3/5: Compiling frontend...
cd "%ROOT_DIR%"
call npm run build:frontend
if errorlevel 1 (
    echo ERROR: Frontend compilation failed!
    pause
    exit /b 1
)

echo Step 4/5: Copying frontend files...
rd /s /q "%DEPLOY_DIR%\static" 2>nul
xcopy /E /I /Y "%FRONTEND_DIR%\build\*" "%DEPLOY_DIR%\static\" >nul
if not exist "%DEPLOY_DIR%\static\sdk" mkdir "%DEPLOY_DIR%\static\sdk"
if not exist "%DEPLOY_DIR%\static\embed" mkdir "%DEPLOY_DIR%\static\embed"
xcopy /E /I /Y "%BACKEND_DIR%\static\sdk\*" "%DEPLOY_DIR%\static\sdk\" >nul
xcopy /E /I /Y "%BACKEND_DIR%\static\embed\*" "%DEPLOY_DIR%\static\embed\" >nul

echo Step 5/5: Syncing production files...
if not exist "%DEPLOY_DIR%\certs" mkdir "%DEPLOY_DIR%\certs"
copy /Y "%PROD_DIR%\customer_service.db" "%DEPLOY_DIR%\customer_service.db" >nul
copy /Y "%PROD_DIR%\server.crt" "%DEPLOY_DIR%\certs\server.crt" >nul
copy /Y "%PROD_DIR%\server.key" "%DEPLOY_DIR%\certs\server.key" >nul

echo.
echo ========================================
echo Deployment Package Updated Successfully!
echo ========================================
echo.

cd "%ROOT_DIR%"
pause
