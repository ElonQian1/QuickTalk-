ELonTalk 客服系统 - Ubuntu 部署包
===================================

📦 部署包内容
-------------
✓ customer-service-backend  - 后端服务 (10.7MB, Linux x86_64)
✓ static/                   - 前端静态文件 (React SPA)
✓ certs/                    - SSL/TLS 证书目录
✓ .env.production          - 生产环境配置
✓ .env.staging             - 测试环境配置
✓ start-production.sh      - 生产环境启动脚本

🚀 快速部署步骤
--------------

1. 上传到服务器
   scp -r ubuntu-deploy-ready/ root@43.139.82.12:/root/

2. SSH 登录服务器
   ssh root@43.139.82.12

3. 进入部署目录
   cd /root/ubuntu-deploy-ready

4. 启动生产环境
   chmod +x start-production.sh
   ./start-production.sh

🔒 HTTPS 配置
-------------
- 已启用 HTTPS (端口 8443)
- 已配置 Let's Encrypt Production
- 自动申请和续期证书
- 域名: elontalk.duckdns.org
- DNS-01 验证 (通过 DuckDNS)

📝 环境要求
-----------
- Ubuntu 24.04 LTS (或兼容 glibc 2.17+)
- 无需安装额外依赖 (静态编译)
- 需要 80 和 8443 端口开放
- 需要配置 DuckDNS 域名

🗄️ 数据库
----------
- 使用 Sea-ORM 自动迁移
- 首次启动自动创建数据库
- 数据文件: customer_service.db

⚙️ 配置切换
-----------
生产环境: cp .env.production .env
测试环境: cp .env.staging .env

📊 访问地址
-----------
HTTPS: https://elontalk.duckdns.org:8443
HTTP:  http://43.139.82.12:8080

🔧 故障排查
-----------
1. 检查端口占用: netstat -tlnp | grep 8443
2. 查看日志: 直接在终端查看输出
3. 测试证书: openssl s_client -connect elontalk.duckdns.org:8443

✅ 编译信息
-----------
编译时间: 2025-10-17 19:46
编译器: cargo-zigbuild
目标平台: x86_64-unknown-linux-musl
功能特性: HTTPS + ACME + WebSocket
优化级别: release (LTO 启用)

---
生成时间: 2025-10-17
