@echo off
setlocal enabledelayedexpansion

REM HTTPS 启动脚本 - Windows版本
REM 专门用于启动 HTTPS 模式的客服系统
REM 包含完整的端口检查、证书验证和故障排除功能

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%"
set "BACKEND_DIR=%PROJECT_ROOT%backend"
set "CERTS_DIR=%PROJECT_ROOT%certs"

REM 颜色代码（Windows 10+ 支持）
set "RED=[31m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "BLUE=[34m"
set "NC=[0m"

echo 🔒 HTTPS 客服系统启动脚本 - Windows版本
echo ==================================================

REM 解析命令行参数
set "FORCE_BUILD=false"
set "GENERATE_CERT_ONLY=false"
set "VERIFY_CERT_ONLY=false"
set "CUSTOM_PORT="

:parse_args
if "%~1"=="" goto :args_parsed
if /I "%~1"=="--help" goto :show_help
if /I "%~1"=="-h" goto :show_help
if /I "%~1"=="--generate-cert" (
    set "GENERATE_CERT_ONLY=true"
    shift
    goto :parse_args
)
if /I "%~1"=="--verify-cert" (
    set "VERIFY_CERT_ONLY=true"
    shift
    goto :parse_args
)
if /I "%~1"=="--force-build" (
    set "FORCE_BUILD=true"
    shift
    goto :parse_args
)
if /I "%~1"=="--port" (
    set "CUSTOM_PORT=%~2"
    shift
    shift
    goto :parse_args
)
echo %RED%错误: 未知参数 %~1%NC%
goto :show_help

:args_parsed

REM 仅生成证书
if "%GENERATE_CERT_ONLY%"=="true" (
    call :generate_ssl_cert
    exit /b 0
)

REM 仅验证证书
if "%VERIFY_CERT_ONLY%"=="true" (
    call :verify_ssl_cert
    if !errorlevel! equ 0 (
        echo %GREEN%[SUCCESS] SSL证书验证通过%NC%
    ) else (
        echo %RED%[ERROR] SSL证书验证失败%NC%
        exit /b 1
    )
    exit /b 0
)

REM 设置自定义端口
if not "%CUSTOM_PORT%"=="" (
    set "HTTPS_PORT=%CUSTOM_PORT%"
    echo %BLUE%[INFO] 使用自定义HTTPS端口: %CUSTOM_PORT%%NC%
)

REM 检查并生成SSL证书
call :verify_ssl_cert
if !errorlevel! neq 0 (
    echo %YELLOW%[WARNING] SSL证书验证失败，尝试生成新证书...%NC%
    call :generate_ssl_cert
    call :verify_ssl_cert
    if !errorlevel! neq 0 (
        echo %RED%[ERROR] SSL证书生成或验证失败%NC%
        exit /b 1
    )
)

REM 设置环境变量
call :setup_https_env

REM 检查端口
if "%HTTPS_PORT%"=="" set "HTTPS_PORT=8443"
call :check_port %HTTPS_PORT% "HTTPS服务器"
if !errorlevel! neq 0 exit /b 1

call :check_port 8080 "HTTP重定向服务器"
if !errorlevel! neq 0 (
    echo %YELLOW%[WARNING] HTTP重定向端口8080被占用，将禁用重定向功能%NC%
    set "ENABLE_HTTP_REDIRECT=false"
)

REM 编译后端
if "%FORCE_BUILD%"=="true" (
    echo %BLUE%[INFO] 强制重新编译后端...%NC%
    cd /d "%BACKEND_DIR%"
    cargo clean
    cd /d "%PROJECT_ROOT%"
)
call :build_backend

REM 启动HTTPS服务器
call :start_https_server

exit /b 0

REM ======= 函数定义 =======

:check_port
set "port=%~1"
set "service_name=%~2"

netstat -an | findstr ":%port% " >nul 2>&1
if !errorlevel! equ 0 (
    echo %RED%[ERROR] 端口 %port% 已被占用！%NC%
    echo 正在使用端口 %port% 的进程:
    netstat -ano | findstr ":%port% "
    
    set /p "response=是否要终止占用端口 %port% 的进程? (y/N): "
    if /I "!response!"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%port% "') do (
            echo %BLUE%[INFO] 终止进程 PID: %%a%NC%
            taskkill /PID %%a /F >nul 2>&1
        )
        timeout /t 2 >nul
        netstat -an | findstr ":%port% " >nul 2>&1
        if !errorlevel! equ 0 (
            echo %RED%[ERROR] 无法释放端口 %port%，请手动处理%NC%
            exit /b 1
        ) else (
            echo %GREEN%[SUCCESS] 端口 %port% 已释放%NC%
        )
    ) else (
        echo %RED%[ERROR] 无法启动 %service_name%，端口 %port% 被占用%NC%
        exit /b 1
    )
) else (
    echo %GREEN%[SUCCESS] 端口 %port% 可用%NC%
)
exit /b 0

:verify_ssl_cert
echo %BLUE%[INFO] 验证SSL证书...%NC%

set "cert_file=%CERTS_DIR%\server.crt"
set "key_file=%CERTS_DIR%\server.key"

if not exist "%cert_file%" (
    echo %RED%[ERROR] SSL证书文件不存在: %cert_file%%NC%
    exit /b 1
)

if not exist "%key_file%" (
    echo %RED%[ERROR] SSL密钥文件不存在: %key_file%%NC%
    exit /b 1
)

REM 检查 OpenSSL 是否可用
openssl version >nul 2>&1
if !errorlevel! neq 0 (
    echo %YELLOW%[WARNING] OpenSSL 不可用，跳过详细验证%NC%
    echo %GREEN%[SUCCESS] SSL证书文件存在%NC%
    exit /b 0
)

REM 检查证书有效性
openssl x509 -in "%cert_file%" -noout -checkend 86400 >nul 2>&1
if !errorlevel! equ 0 (
    echo %GREEN%[SUCCESS] SSL证书有效（未过期）%NC%
) else (
    echo %YELLOW%[WARNING] SSL证书可能已过期或无效%NC%
    openssl x509 -in "%cert_file%" -noout -dates 2>nul
)

echo %BLUE%[INFO] 证书详细信息:%NC%
openssl x509 -in "%cert_file%" -noout -subject -issuer -dates 2>nul

echo %GREEN%[SUCCESS] SSL证书验证完成%NC%
exit /b 0

:generate_ssl_cert
echo %BLUE%[INFO] 生成自签名SSL证书...%NC%

if not exist "%CERTS_DIR%" mkdir "%CERTS_DIR%"

REM 检查 OpenSSL 是否可用
openssl version >nul 2>&1
if !errorlevel! neq 0 (
    echo %RED%[ERROR] OpenSSL 不可用，无法生成证书%NC%
    echo 请安装 OpenSSL 或手动提供证书文件
    echo 证书文件路径: %CERTS_DIR%\server.crt
    echo 密钥文件路径: %CERTS_DIR%\server.key
    exit /b 1
)

REM 生成私钥
openssl genrsa -out "%CERTS_DIR%\server.key" 2048

REM 生成证书
openssl req -new -x509 -key "%CERTS_DIR%\server.key" -out "%CERTS_DIR%\server.crt" -days 365 -subj "/C=CN/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost"

echo %GREEN%[SUCCESS] SSL证书已生成%NC%
exit /b 0

:setup_https_env
echo %BLUE%[INFO] 设置HTTPS环境变量...%NC%

set "TLS_MODE=https"
set "HTTPS_PORT=8443"
set "TLS_CERT_PATH=%CERTS_DIR%\server.crt"
set "TLS_KEY_PATH=%CERTS_DIR%\server.key"
set "ENABLE_HTTP_REDIRECT=true"

REM 设置自定义端口
if not "%CUSTOM_PORT%"=="" set "HTTPS_PORT=%CUSTOM_PORT%"

echo %GREEN%[SUCCESS] HTTPS环境变量已设置%NC%
echo   TLS_MODE: %TLS_MODE%
echo   HTTPS_PORT: %HTTPS_PORT%
echo   TLS_CERT_PATH: %TLS_CERT_PATH%
echo   TLS_KEY_PATH: %TLS_KEY_PATH%
echo   ENABLE_HTTP_REDIRECT: %ENABLE_HTTP_REDIRECT%
exit /b 0

:build_backend
echo %BLUE%[INFO] 检查后端编译状态...%NC%

cd /d "%BACKEND_DIR%"

set "binary_path=target\release\customer-service-backend.exe"
if not exist "%binary_path%" (
    echo %BLUE%[INFO] 编译后端（Release模式，包含HTTPS支持）...%NC%
    cargo build --release --features https
    echo %GREEN%[SUCCESS] 后端编译完成%NC%
) else (
    echo %GREEN%[SUCCESS] 后端已是最新版本%NC%
)

cd /d "%PROJECT_ROOT%"
exit /b 0

:start_https_server
echo %BLUE%[INFO] 启动HTTPS服务器...%NC%

cd /d "%BACKEND_DIR%"

echo.
echo ==========================================
echo 🚀 启动HTTPS客服系统
echo ==========================================
echo HTTPS地址: https://localhost:%HTTPS_PORT%
echo HTTP重定向: http://localhost:8080 -^> https://localhost:%HTTPS_PORT%
echo 证书路径: %TLS_CERT_PATH%
echo 密钥路径: %TLS_KEY_PATH%
echo ==========================================
echo.

REM 启动服务器
target\release\customer-service-backend.exe
exit /b 0

:show_help
echo HTTPS启动脚本使用指南 - Windows版本
echo.
echo 用法:
echo   %~nx0 [选项]
echo.
echo 选项:
echo   --help, -h          显示此帮助信息
echo   --generate-cert     仅生成SSL证书
echo   --verify-cert       仅验证SSL证书
echo   --force-build       强制重新编译后端
echo   --port PORT         指定HTTPS端口（默认：8443）
echo.
echo 环境变量:
echo   HTTPS_PORT          HTTPS端口号（默认：8443）
echo   TLS_CERT_PATH       SSL证书路径
echo   TLS_KEY_PATH        SSL密钥路径
echo.
echo 示例:
echo   %~nx0                  # 启动HTTPS服务器
echo   %~nx0 --port 9443      # 使用端口9443启动
echo   %~nx0 --generate-cert  # 仅生成证书
echo.
exit /b 0