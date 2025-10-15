# 快速部署指南 - 3 步完成

## 📦 准备工作

确保你已经将整个 `ubuntu-deploy-package` 文件夹上传到服务器的 `/root/` 目录。

## 🚀 部署步骤

### 第 1 步：SSH 登录服务器

```bash
ssh root@43.139.82.12
```

### 第 2 步：重命名并进入目录

```bash
cd /root
mv ubuntu-deploy-package ubuntu-deploy-ready
cd ubuntu-deploy-ready
```

### 第 3 步：执行一键部署

```bash
chmod +x deploy.sh && bash deploy.sh
```

## ✅ 完成！

部署脚本会自动完成所有配置，大约需要 2-3 分钟。

部署成功后访问:
- **管理后台**: https://elontalk.duckdns.org:8443

## 🔍 查看日志

```bash
journalctl -u customer-service -f
```

## 📖 详细文档

查看 `README.md` 获取完整的部署文档、故障排查和管理命令。

---

**重要提示**:
- ✅ 后端已编译为静态二进制，无需安装 Rust
- ✅ 数据库使用 SQLite，自动初始化
- ✅ 已配置 HTTPS 强制模式
- ✅ 已包含自签名证书（建议更换为正式证书）
