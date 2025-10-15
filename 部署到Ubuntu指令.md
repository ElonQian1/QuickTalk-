# 部署最新代码到Ubuntu生产服务器

## 问题说明
- 本地`npm run dev`热重载只影响Windows开发环境
- Ubuntu生产服务器(43.139.82.12:8443)运行的是旧版本代码
- 需要手动上传并重新编译

## 部署步骤

### 1. 在Windows开发机上打包后端代码
```powershell
cd e:\duihua\customer-service-system

# 确保所有改动已提交
git status

# 打包backend源代码（排除target目录）
tar -czf backend-src.tar.gz --exclude='target' --exclude='*.db' backend/
```

### 2. 上传到Ubuntu服务器
```powershell
scp backend-src.tar.gz root@43.139.82.12:/root/
```

### 3. 登录Ubuntu服务器
```powershell
ssh root@43.139.82.12
```

### 4. 在Ubuntu上解压并编译
```bash
cd /root

# 备份当前版本（可选）
if [ -d "ubuntu-deploy-ready/backend" ]; then
    cp -r ubuntu-deploy-ready/backend ubuntu-deploy-ready/backend.backup.$(date +%Y%m%d_%H%M%S)
fi

# 解压新代码
tar -xzf backend-src.tar.gz -C ubuntu-deploy-ready/

# 进入backend目录编译
cd ubuntu-deploy-ready/backend
cargo build --release

# 停止当前服务
systemctl stop customer-service

# 替换可执行文件
cp target/release/customer-service-backend ../customer-service-backend
chmod +x ../customer-service-backend

# 重启服务
systemctl start customer-service
systemctl status customer-service
```

### 5. 验证部署
```bash
# 查看服务日志
journalctl -u customer-service -f --lines=50

# 测试API
curl -k https://43.139.82.12:8443/api/shops/1/customers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. 同步静态文件（SDK）
```bash
# 如果还没上传embed和sdk文件
cd e:\duihua\customer-service-system
scp -r ubuntu-deploy-ready/static/embed ubuntu-deploy-ready/static/sdk root@43.139.82.12:/root/ubuntu-deploy-ready/static/
```

## 快速重新编译（如果代码已在服务器上）
```bash
ssh root@43.139.82.12
cd /root/ubuntu-deploy-ready/backend
cargo build --release
systemctl restart customer-service
```

## 注意事项
1. ⚠️ **热重载限制**: `npm run dev`只对本地开发环境有效
2. ⚠️ **生产部署**: Ubuntu服务器需要手动上传代码并重新编译
3. ⚠️ **数据库**: 确保不要覆盖生产数据库文件
4. ⚠️ **证书文件**: 确保certs/目录中的证书文件存在

## 最近修改的文件（需要部署）
- `backend/src/handlers/customer.rs` - 修复customers API返回空数据
- `backend/src/handlers/shop.rs` - 店铺统计数据
- `backend/src/services/metrics.rs` - 适配生产数据库schema
- `backend/src/repositories/shop.rs` - 列查询优化
- `backend/src/entities/shops.rs` - 列名映射
- `frontend/src/config/ws.ts` - WebSocket端口适配
- `websocket-sdk/src/core/config.ts` - 服务器检测优先级

## Git同步方式（推荐）
如果Ubuntu服务器上有git仓库：
```bash
ssh root@43.139.82.12
cd /root/ubuntu-deploy-ready
git pull origin main
cd backend
cargo build --release
systemctl restart customer-service
```
