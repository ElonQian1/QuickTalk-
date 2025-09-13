# QuickTalk 客服系统部署指南

## 📋 目录

1. [环境要求](#环境要求)
2. [快速部署](#快速部署)
3. [生产环境部署](#生产环境部署)
4. [Docker部署](#docker部署)
5. [负载均衡配置](#负载均衡配置)
6. [数据库配置](#数据库配置)
7. [SSL证书配置](#ssl证书配置)
8. [监控和日志](#监控和日志)
9. [备份和恢复](#备份和恢复)
10. [故障排除](#故障排除)

## 环境要求

### 系统要求
- **操作系统**: Linux (Ubuntu 18.04+, CentOS 7+), Windows Server 2016+, macOS 10.14+
- **Node.js**: 版本 14.0 或更高
- **内存**: 最低 2GB，推荐 4GB 或更高
- **磁盘空间**: 最低 10GB，推荐 50GB 或更高
- **网络**: 稳定的互联网连接

### 依赖服务
- **数据库**: SQLite（默认）/ MySQL 5.7+ / PostgreSQL 10+
- **Redis**: 版本 5.0+ （可选，用于会话存储和缓存）
- **Nginx**: 版本 1.16+ （可选，用于反向代理）

### 浏览器兼容性
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+
- 移动端浏览器支持

## 快速部署

### 1. 获取源代码
```bash
# 从Git仓库克隆
git clone https://github.com/your-org/quicktalk.git
cd quicktalk

# 或下载发布包
wget https://github.com/your-org/quicktalk/releases/latest/download/quicktalk.tar.gz
tar -xzf quicktalk.tar.gz
cd quicktalk
```

### 2. 安装依赖
```bash
# 安装Node.js依赖
npm install

# 或使用yarn
yarn install
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

### 4. 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 5. 验证部署
访问 `http://localhost:3030` 确认系统正常运行。

## 生产环境部署

### 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# 基础配置
NODE_ENV=production
PORT=3030
HOST=0.0.0.0

# 数据库配置
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/database.sqlite

# 或 MySQL 配置
# DATABASE_TYPE=mysql
# DATABASE_HOST=localhost
# DATABASE_PORT=3306
# DATABASE_NAME=quicktalk
# DATABASE_USER=quicktalk_user
# DATABASE_PASSWORD=your_password

# Redis 配置（可选）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 安全配置
SESSION_SECRET=your_session_secret_here
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# CORS 配置
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# 文件上传配置
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=QuickTalk <noreply@yourdomain.com>

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/application.log

# SSL 配置
SSL_CERT_PATH=./certs/cert.pem
SSL_KEY_PATH=./certs/key.pem
```

### 数据库初始化

#### SQLite (默认)
```bash
# 创建数据目录
mkdir -p data

# 运行数据库迁移
npm run db:migrate
```

#### MySQL
```sql
-- 创建数据库
CREATE DATABASE quicktalk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'quicktalk_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON quicktalk.* TO 'quicktalk_user'@'localhost';
FLUSH PRIVILEGES;
```

```bash
# 运行数据库迁移
npm run db:migrate
```

### 安全配置

#### 生成安全密钥
```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 防火墙配置
```bash
# Ubuntu/Debian
sudo ufw allow 3030/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3030/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 进程管理

#### 使用PM2
```bash
# 安装PM2
npm install -g pm2

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'quicktalk',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3030
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js --env production

# 设置开机自启
pm2 startup
pm2 save
```

#### 使用systemd
```bash
# 创建服务文件
sudo cat > /etc/systemd/system/quicktalk.service << EOF
[Unit]
Description=QuickTalk Customer Service System
After=network.target

[Service]
Type=simple
User=quicktalk
WorkingDirectory=/opt/quicktalk
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3030

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl enable quicktalk
sudo systemctl start quicktalk
sudo systemctl status quicktalk
```

## Docker部署

### Dockerfile
```dockerfile
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S quicktalk -u 1001

# 设置权限
RUN chown -R quicktalk:nodejs /app
USER quicktalk

# 暴露端口
EXPOSE 3030

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 启动应用
CMD ["node", "server.js"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  quicktalk:
    build: .
    ports:
      - "3030:3030"
    environment:
      - NODE_ENV=production
      - DATABASE_TYPE=mysql
      - DATABASE_HOST=mysql
      - DATABASE_NAME=quicktalk
      - DATABASE_USER=quicktalk_user
      - DATABASE_PASSWORD=your_password
      - REDIS_HOST=redis
    depends_on:
      - mysql
      - redis
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=root_password
      - MYSQL_DATABASE=quicktalk
      - MYSQL_USER=quicktalk_user
      - MYSQL_PASSWORD=your_password
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass your_redis_password
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - quicktalk
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

### 部署命令
```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f quicktalk

# 停止服务
docker-compose down
```

## 负载均衡配置

### Nginx配置
```nginx
upstream quicktalk_backend {
    least_conn;
    server 127.0.0.1:3030 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3031 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3032 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL配置
    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # 限制请求大小
    client_max_body_size 10M;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket代理
    location /ws {
        proxy_pass http://quicktalk_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API代理
    location /api {
        proxy_pass http://quicktalk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 限制请求频率
        limit_req zone=api burst=20 nodelay;
    }

    # 主应用代理
    location / {
        proxy_pass http://quicktalk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 限制请求频率
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

### HAProxy配置
```
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend quicktalk_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/quicktalk.pem
    redirect scheme https if !{ ssl_fc }
    default_backend quicktalk_backend

backend quicktalk_backend
    balance roundrobin
    option httpchk GET /health
    server app1 127.0.0.1:3030 check
    server app2 127.0.0.1:3031 check
    server app3 127.0.0.1:3032 check
```

## 数据库配置

### MySQL优化配置
```ini
[mysqld]
# 基础配置
port = 3306
socket = /var/run/mysqld/mysqld.sock
datadir = /var/lib/mysql

# 字符集配置
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# 连接配置
max_connections = 200
max_connect_errors = 10
table_open_cache = 2048
max_allowed_packet = 16M

# 内存配置
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 1

# 查询缓存
query_cache_type = 1
query_cache_size = 64M

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# 二进制日志
log-bin = mysql-bin
binlog_format = ROW
expire_logs_days = 7
```

### Redis配置优化
```conf
# 基础配置
port 6379
bind 127.0.0.1
protected-mode yes
requirepass your_strong_password

# 内存配置
maxmemory 512mb
maxmemory-policy allkeys-lru

# 持久化配置
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes

# 日志配置
loglevel notice
logfile /var/log/redis/redis-server.log

# 安全配置
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

## SSL证书配置

### Let's Encrypt证书
```bash
# 安装Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 自签名证书（测试用）
```bash
# 生成私钥
openssl genrsa -out key.pem 2048

# 生成证书
openssl req -new -x509 -key key.pem -out cert.pem -days 365 \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=YourOrg/CN=yourdomain.com"
```

## 监控和日志

### 健康检查端点
```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3030,
  path: '/health',
  method: 'GET',
  timeout: 3000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

### 监控脚本
```bash
#!/bin/bash
# monitor.sh

# 检查服务状态
check_service() {
    local service_name=$1
    local port=$2
    
    if nc -z localhost $port; then
        echo "✅ $service_name is running"
    else
        echo "❌ $service_name is down"
        # 发送告警通知
        curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
             -d chat_id="$CHAT_ID" \
             -d text="⚠️ $service_name is down!"
    fi
}

# 检查各项服务
check_service "QuickTalk" 3030
check_service "MySQL" 3306
check_service "Redis" 6379

# 检查磁盘空间
disk_usage=$(df / | grep -vE '^Filesystem' | awk '{print $5}' | sed 's/%//g')
if [ $disk_usage -gt 80 ]; then
    echo "⚠️ Disk usage is high: ${disk_usage}%"
fi

# 检查内存使用
memory_usage=$(free | grep Mem | awk '{printf("%.2f", $3/$2 * 100.0)}')
if (( $(echo "$memory_usage > 80" | bc -l) )); then
    echo "⚠️ Memory usage is high: ${memory_usage}%"
fi
```

### 日志轮转配置
```bash
# /etc/logrotate.d/quicktalk
/opt/quicktalk/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 quicktalk quicktalk
    postrotate
        systemctl reload quicktalk
    endscript
}
```

## 备份和恢复

### 数据库备份
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/backups/quicktalk"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份MySQL数据库
mysqldump -u quicktalk_user -p quicktalk > $BACKUP_DIR/database_$DATE.sql

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/quicktalk/uploads

# 备份配置文件
cp /opt/quicktalk/.env $BACKUP_DIR/config_$DATE.env

# 清理30天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.env" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### 自动备份计划
```bash
# 添加到crontab
0 2 * * * /opt/scripts/backup.sh
```

### 恢复数据
```bash
# 恢复数据库
mysql -u quicktalk_user -p quicktalk < /opt/backups/quicktalk/database_20231225_020000.sql

# 恢复上传文件
tar -xzf /opt/backups/quicktalk/uploads_20231225_020000.tar.gz -C /

# 恢复配置文件
cp /opt/backups/quicktalk/config_20231225_020000.env /opt/quicktalk/.env
```

## 故障排除

### 常见问题

#### 服务无法启动
```bash
# 检查端口占用
netstat -tlnp | grep :3030

# 检查错误日志
tail -f /opt/quicktalk/logs/error.log

# 检查系统资源
top
df -h
free -m
```

#### WebSocket连接失败
```bash
# 检查防火墙
sudo ufw status
sudo iptables -L

# 检查Nginx配置
nginx -t
systemctl status nginx

# 测试WebSocket连接
wscat -c ws://localhost:3030/ws
```

#### 数据库连接问题
```bash
# 测试数据库连接
mysql -u quicktalk_user -p quicktalk -e "SELECT 1"

# 检查数据库状态
systemctl status mysql

# 查看数据库错误日志
tail -f /var/log/mysql/error.log
```

#### 性能问题
```bash
# 查看系统负载
uptime
iostat 1

# 查看进程状态
ps aux | grep quicktalk
pm2 monit

# 分析慢查询
mysql -u root -p -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10"
```

### 调试工具

#### 启用调试模式
```bash
# 设置环境变量
export DEBUG=quicktalk:*
export NODE_ENV=development

# 启动服务
npm run dev
```

#### 性能分析
```bash
# 安装性能分析工具
npm install -g clinic

# 运行性能分析
clinic doctor -- node server.js
clinic bubbleprof -- node server.js
```

#### 日志分析
```bash
# 分析访问日志
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# 查找错误
grep -i error /opt/quicktalk/logs/*.log | tail -20

# 监控实时日志
tail -f /opt/quicktalk/logs/application.log | grep ERROR
```

### 紧急恢复步骤

1. **服务中断恢复**
   ```bash
   # 快速重启所有服务
   systemctl restart quicktalk
   systemctl restart nginx
   systemctl restart mysql
   systemctl restart redis
   ```

2. **数据丢失恢复**
   ```bash
   # 从最近备份恢复
   ./restore.sh /opt/backups/quicktalk/latest
   ```

3. **性能问题缓解**
   ```bash
   # 临时增加资源限制
   pm2 scale quicktalk 4
   
   # 清理缓存
   redis-cli FLUSHALL
   ```

### 联系支持

如果遇到无法解决的问题，请联系技术支持：

- **邮箱**: support@quicktalk.com
- **电话**: +86-400-xxx-xxxx
- **在线支持**: https://support.quicktalk.com

提供以下信息有助于快速解决问题：
- 系统版本和环境信息
- 错误日志和截图
- 问题复现步骤
- 当前配置文件

---

**部署成功后，请及时更新文档并分享最佳实践！**