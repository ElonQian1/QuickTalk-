#!/bin/bash

# ELonTalk 客服系统 - Ubuntu 部署包使用说明
# ================================================

cat << 'EOF'

🚀 ELonTalk 客服系统 - Ubuntu 部署包
====================================

📦 部署包内容：
- Rust 后端程序 (支持 HTTPS)
- React 前端文件
- SSL 证书文件
- 启动/停止脚本
- 日志分析工具
- 详细部署文档

🎯 快速开始 (3 步骤)：

1️⃣ 设置权限
   chmod +x *.sh scripts/*.sh customer-service-backend

2️⃣ 一键启动
   ./quick-start.sh

3️⃣ 访问系统
   https://[服务器IP]:8443

📖 详细说明：
   请查看 README.md 文件获取完整部署指南

🔧 故障排除：
   ./scripts/analyze-logs.sh

📞 技术支持：
   GitHub: https://github.com/ElonQian1/QuickTalk
   邮箱: siwmm@163.com

EOF

echo
echo "🌟 准备开始部署？"
echo "运行命令: ./quick-start.sh"
echo