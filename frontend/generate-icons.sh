#!/bin/bash

# 生成图标脚本
# 需要安装 ImageMagick: brew install imagemagick (macOS) 或 apt-get install imagemagick (Ubuntu)

echo "正在生成应用图标..."

# 检查是否安装了 ImageMagick
if ! command -v convert &> /dev/null; then
    echo "错误: 需要安装 ImageMagick"
    echo "macOS: brew install imagemagick"
    echo "Ubuntu: sudo apt-get install imagemagick"
    echo "Windows: 下载并安装 ImageMagick"
    exit 1
fi

# 创建一个临时的大尺寸 SVG
cat > temp_icon.svg << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#07C160;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06A94D;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="230" fill="url(#grad)"/>
  
  <!-- Chat bubble -->
  <g fill="white">
    <!-- Main chat bubble -->
    <path d="M140 200 C140 170, 170 140, 200 140 L360 140 C390 140, 420 170, 420 200 L420 280 C420 310, 390 340, 360 340 L260 340 L200 380 L200 340 C170 340, 140 310, 140 280 Z"/>
    
    <!-- Message lines -->
    <rect x="180" y="190" width="160" height="16" rx="8" fill="rgba(7,193,96,0.8)"/>
    <rect x="180" y="220" width="120" height="16" rx="8" fill="rgba(7,193,96,0.8)"/>
    <rect x="180" y="250" width="90" height="16" rx="8" fill="rgba(7,193,96,0.8)"/>
  </g>
</svg>
EOF

# 生成不同尺寸的 PNG
echo "生成 192x192 图标..."
convert temp_icon.svg -resize 192x192 logo192.png

echo "生成 512x512 图标..."
convert temp_icon.svg -resize 512x512 logo512.png

echo "生成 favicon..."
convert temp_icon.svg -resize 32x32 favicon.png

# 生成 ICO 文件 (包含多个尺寸)
echo "生成 favicon.ico..."
convert temp_icon.svg \( -clone 0 -resize 16x16 \) \( -clone 0 -resize 32x32 \) \( -clone 0 -resize 48x48 \) -delete 0 favicon.ico

# 清理临时文件
rm temp_icon.svg

echo "图标生成完成！"
echo "生成的文件："
echo "- logo192.png (192x192)"
echo "- logo512.png (512x512)" 
echo "- favicon.png (32x32)"
echo "- favicon.ico (多尺寸)"