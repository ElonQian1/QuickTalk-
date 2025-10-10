# Ubuntu 部署指南

## 部署文件说明

此文件夹包含了在 Ubuntu 系统上运行客服系统所需的全部文件：

### 文件清单
- `customer-service-backend` - Linux 可执行文件（约6MB，静态链接）
- `static/` - 前端静态文件
- `static/sdk/` - WebSocket SDK 文件
- `database_schema.sql` - 数据库架构
- `.env.example` - 环境变量示例

## 部署步骤

### 1. 上传文件到服务器
```bash
# 将整个 ubuntu-deploy 文件夹上传到 Ubuntu 服务器
scp -r ubuntu-deploy/ user@server:/path/to/deployment/
```

### 2. 在服务器上设置
```bash
cd /path/to/deployment/ubuntu-deploy/

# 给可执行文件权限
chmod +x customer-service-backend

# 复制并编辑环境变量
cp .env.example .env
nano .env  # 修改 JWT_SECRET 等配置
```

### 3. 初始化数据库
```bash
# 创建数据库文件（首次运行时会自动创建表）
touch customer_service.db
```

### 4. 运行服务
```bash
# 前台运行（测试）
./customer-service-backend

# 后台运行（生产）
nohup ./customer-service-backend > server.log 2>&1 &
```

### 5. 验证部署
```bash
# 检查服务状态
curl http://localhost:8080/

# 查看日志
tail -f server.log
```

## 系统要求

- Ubuntu 16.04+ (或其他支持 glibc 2.17+ 的 Linux 发行版)
- 无需安装额外依赖（静态链接二进制）
- 建议内存：512MB+
- 建议存储：1GB+

## 端口配置

- 后端服务：8080 (可在 .env 中修改)
- 前端通过后端静态文件服务提供

## 防火墙设置

```bash
# Ubuntu UFW
sudo ufw allow 8080/tcp

# 或使用 iptables
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

## 系统服务配置（可选）

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/customer-service.service
```

内容：
```ini
[Unit]
Description=Customer Service System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/deployment/ubuntu-deploy
ExecStart=/path/to/deployment/ubuntu-deploy/customer-service-backend
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable customer-service
sudo systemctl start customer-service
sudo systemctl status customer-service
```

## 更新部署

重新编译后，只需替换 `customer-service-backend` 和 `static/` 文件夹即可。

## 故障排查

1. **权限问题**：确保二进制文件有执行权限
2. **端口占用**：检查 8080 端口是否被占用
3. **数据库问题**：确保有权限创建/读写数据库文件
4. **日志查看**：检查 server.log 或使用 `journalctl -u customer-service`