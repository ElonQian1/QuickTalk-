@echo off
echo 正在生成应用图标...

REM 检查是否安装了 ImageMagick
where convert >nul 2>nul
if %errorlevel% neq 0 (
    echo 错误: 需要安装 ImageMagick
    echo 请从 https://imagemagick.org/script/download.php#windows 下载并安装
    pause
    exit /b 1
)

REM 创建临时 SVG 文件
(
echo ^<?xml version="1.0" encoding="UTF-8"?^>
echo ^<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"^>
echo   ^<defs^>
echo     ^<linearGradient id="grad" x1="0%%" y1="0%%" x2="100%%" y2="100%%"^>
echo       ^<stop offset="0%%" style="stop-color:#07C160;stop-opacity:1" /^>
echo       ^<stop offset="100%%" style="stop-color:#06A94D;stop-opacity:1" /^>
echo     ^</linearGradient^>
echo   ^</defs^>
echo   
echo   ^<!-- Background circle --^>
echo   ^<circle cx="256" cy="256" r="230" fill="url(#grad)"/^>
echo   
echo   ^<!-- Chat bubble --^>
echo   ^<g fill="white"^>
echo     ^<!-- Main chat bubble --^>
echo     ^<path d="M140 200 C140 170, 170 140, 200 140 L360 140 C390 140, 420 170, 420 200 L420 280 C420 310, 390 340, 360 340 L260 340 L200 380 L200 340 C170 340, 140 310, 140 280 Z"/^>
echo     
echo     ^<!-- Message lines --^>
echo     ^<rect x="180" y="190" width="160" height="16" rx="8" fill="rgba(7,193,96,0.8)"/^>
echo     ^<rect x="180" y="220" width="120" height="16" rx="8" fill="rgba(7,193,96,0.8)"/^>
echo     ^<rect x="180" y="250" width="90" height="16" rx="8" fill="rgba(7,193,96,0.8)"/^>
echo   ^</g^>
echo ^</svg^>
) > temp_icon.svg

echo 生成 192x192 图标...
convert temp_icon.svg -resize 192x192 public\logo192.png

echo 生成 512x512 图标...
convert temp_icon.svg -resize 512x512 public\logo512.png

echo 生成 favicon...
convert temp_icon.svg -resize 32x32 public\favicon.png

echo 生成 favicon.ico...
convert temp_icon.svg ( -clone 0 -resize 16x16 ) ( -clone 0 -resize 32x32 ) ( -clone 0 -resize 48x48 ) -delete 0 public\favicon.ico

REM 清理临时文件
del temp_icon.svg

echo.
echo 图标生成完成！
echo 生成的文件：
echo - public\logo192.png (192x192)
echo - public\logo512.png (512x512)
echo - public\favicon.png (32x32)
echo - public\favicon.ico (多尺寸)
pause