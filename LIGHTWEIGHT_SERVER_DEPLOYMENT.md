# 轻量云服务器部署指南

## 🎯 部署概述

本指南适用于部署到轻量云服务器（如阿里云、腾讯云轻量应用服务器）。

## 📋 系统要求

- **操作系统**：Ubuntu 20.04+ / CentOS 7+
- **内存**：最低 1GB，推荐 2GB+
- **存储**：最低 10GB
- **网络**：需要开放3030端口

## 🚀 快速部署

### 1. 环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js (推荐使用NodeSource仓库)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 上传项目文件

```bash
# 创建项目目录
sudo mkdir -p /opt/quicktalk
sudo chown $USER:$USER /opt/quicktalk

# 上传项目文件到服务器
# 可使用scp、git clone或其他方式
```

### 3. 安装依赖

```bash
cd /opt/quicktalk
npm install
```

### 4. 确保使用SQLite数据库

```bash
# 确认当前数据库配置
grep -n "database-" server.js

# 如果不是SQLite，切换到SQLite
npm run db:sqlite
```

### 5. 创建系统服务

创建服务文件：
```bash
sudo nano /etc/systemd/system/quicktalk.service
```

添加以下内容：
```ini
[Unit]
Description=QuickTalk Customer Service System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/quicktalk
Environment=NODE_ENV=production
Environment=PORT=3030
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6. 启动服务

```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable quicktalk

# 启动服务
sudo systemctl start quicktalk

# 检查服务状态
sudo systemctl status quicktalk

# 查看服务日志
sudo journalctl -u quicktalk -f
```

## 🔧 网络配置

### 防火墙设置

```bash
# Ubuntu (ufw)
sudo ufw allow 3030
sudo ufw reload

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=3030/tcp
sudo firewall-cmd --reload
```

### 云服务器安全组

在云服务器控制台添加安全组规则：
- **协议**：TCP
- **端口**：3030
- **源**：0.0.0.0/0 (允许所有IP访问)

## 📊 数据库管理

### SQLite数据库位置
```bash
/opt/quicktalk/data/customer_service.db
```

### 数据备份
```bash
# 创建数据备份
sudo cp /opt/quicktalk/data/customer_service.db /opt/quicktalk/data/backup_$(date +%Y%m%d_%H%M%S).db

# 自动备份脚本
echo "0 2 * * * cp /opt/quicktalk/data/customer_service.db /opt/quicktalk/data/backup_\$(date +\%Y\%m\%d).db" | sudo crontab -
```

### 查看数据库
```bash
# 安装sqlite3命令行工具
sudo apt install sqlite3

# 连接数据库
sqlite3 /opt/quicktalk/data/customer_service.db

# 常用SQL命令
.tables          # 查看所有表
.schema users    # 查看用户表结构
SELECT * FROM users LIMIT 5;  # 查看用户数据
.quit           # 退出
```

## 🔍 故障排除

### 检查服务状态
```bash
# 查看服务是否运行
sudo systemctl status quicktalk

# 查看错误日志
sudo journalctl -u quicktalk --since today

# 手动运行测试
cd /opt/quicktalk && node server.js
```

### 常见问题

1. **端口被占用**
```bash
# 查看端口占用
sudo netstat -tlnp | grep :3030
sudo lsof -i :3030
```

2. **权限问题**
```bash
# 修复文件权限
sudo chown -R www-data:www-data /opt/quicktalk
sudo chmod -R 755 /opt/quicktalk
```

3. **数据库文件权限**
```bash
# 确保数据目录权限正确
sudo mkdir -p /opt/quicktalk/data
sudo chown -R www-data:www-data /opt/quicktalk/data
sudo chmod -R 775 /opt/quicktalk/data
```

## 🌐 域名配置

### 使用Nginx反向代理（可选）

安装Nginx：
```bash
sudo apt install nginx
```

配置反向代理：
```bash
sudo nano /etc/nginx/sites-available/quicktalk
```

添加配置：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/quicktalk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📈 性能优化

### 系统优化
```bash
# 调整文件描述符限制
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf
```

### Node.js优化
在服务文件中添加内存限制：
```ini
Environment=NODE_OPTIONS="--max-old-space-size=512"
```

## 🔐 安全建议

1. **修改默认密码**
   - 登录管理后台修改默认admin密码

2. **使用HTTPS**
   - 申请SSL证书配置HTTPS

3. **定期备份**
   - 设置自动数据备份

4. **监控日志**
   - 定期查看系统日志

## 📞 技术支持

如遇部署问题，请检查：
1. Node.js版本是否正确
2. 端口是否正确开放
3. 文件权限是否正确
4. 数据库文件是否可访问
