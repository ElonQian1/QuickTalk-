# ELonTalk 客服系统 - Ubuntu 快速部署指南

## 🎯 部署包信息

- **文件名**: `ELonTalk-Ubuntu-Complete-Deploy.zip`
- **大小**: 3.98 MB
- **架构**: x86_64-linux-musl (兼容所有 Linux 发行版)
- **依赖**: 零依赖，开箱即用

## 🚀 5分钟快速部署

### 1. 上传并解压
```bash
# 上传到服务器后解压
unzip ELonTalk-Ubuntu-Complete-Deploy.zip
cd ubuntu-deploy-package
```

### 2. 一键安装
```bash
chmod +x install.sh
./install.sh
```

### 3. 访问系统
- **HTTP**: `http://您的IP:8080`
- **HTTPS**: `https://您的域名:8443` (配置SSL后)

## 📋 包含文件

```
ubuntu-deploy-package/
├── customer-service-backend    # 7MB Linux二进制程序 (Rust编译)
├── install.sh                 # 一键安装脚本
├── start.sh                   # HTTP启动脚本  
├── start-https.sh             # HTTPS启动脚本
├── setup-ssl.sh               # SSL自动配置脚本
├── README.md                  # 详细使用说明
├── .env.example               # 配置文件模板
├── database_schema.sql        # 数据库架构
└── static/                    # 完整前端文件
    ├── index.html            # 管理后台
    ├── sdk/                  # WebSocket SDK
    └── static/               # React应用
```

## ⚡ 特性亮点

- ✅ **零依赖部署**: 无需安装数据库、Node.js等
- ✅ **HTTPS支持**: 内置SSL/TLS，支持Let's Encrypt自动证书
- ✅ **跨平台兼容**: 支持Ubuntu 16.04+和其他Linux发行版
- ✅ **高性能**: Rust后端，静态链接，内存占用低
- ✅ **完整功能**: 多店铺、实时消息、图片语音、数据统计

## 🔧 高级配置

### 自定义端口
编辑 `.env` 文件修改端口：
```env
SERVER_PORT=8080
HTTPS_PORT=8443
```

### 域名SSL证书
```bash
sudo ./setup-ssl.sh
# 输入您的域名和DuckDNS Token
```

### 系统服务
```bash
# 创建systemd服务实现开机自启
sudo cp install.sh /opt/elontalk/
sudo systemctl enable elontalk
```

## 🌐 SDK集成示例

在您的网站中集成客服功能：

```html
<script src="http://您的服务器IP:8080/sdk/index.js"></script>
<script>
const cs = new CustomerServiceSDK({
    shopId: 'shop-001',
    customerId: 'user-123',
    customerName: '张三',
    serverUrl: 'ws://您的服务器IP:8080'
});
</script>
```

## 📞 技术支持

遇到问题？查看详细文档：
```bash
cat README.md
```

---
**版本**: Ubuntu Complete Deploy v1.0  
**编译日期**: 2025年10月13日  
**包含**: 后端+前端+SDK+SSL+文档  
**支持**: HTTP/HTTPS + 零依赖部署