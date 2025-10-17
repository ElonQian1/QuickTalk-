# 使用 Screen 启动客服系统

## 🎯 为什么使用 Screen？

当您在 SSH 中直接运行 `./customer-service-backend` 时，关闭终端或 SSH 断开会导致程序被终止。使用 Screen 可以：

- ✅ SSH 断开后程序继续运行
- ✅ 随时重新连接查看实时日志
- ✅ 像在本地终端一样操作
- ✅ 简单易用

## 📖 快速开始

### 1. 安装 Screen（首次使用）

```bash
sudo apt-get update
sudo apt-get install screen -y
```

### 2. 创建 Screen 会话并启动程序

```bash
# 连接到 Ubuntu 服务器
ssh root@43.139.82.12

# 创建名为 'customer-service' 的 screen 会话
screen -S customer-service

# 进入项目目录
cd /root/ubuntu-deploy-ready

# 启动程序（正常启动，可以看到实时日志）
./customer-service-backend
```

### 3. 分离 Screen 会话（保持程序运行）

当程序启动后，按以下键组合分离会话：

1. 按 `Ctrl + A`（同时按）
2. 然后按 `D`（单独按）

您会看到类似这样的提示：
```
[detached from 12345.customer-service]
```

现在您可以：
- 安全地关闭 SSH 连接
- 关闭终端窗口
- 程序继续在后台运行！

### 4. 重新连接到 Screen 会话

随时重新连接查看程序状态：

```bash
# 连接到服务器
ssh root@43.139.82.12

# 重新连接到之前的 screen 会话
screen -r customer-service
```

您会立即看到程序的实时输出！

### 5. 停止程序

重新连接到 screen 后：

1. 按 `Ctrl + C` 停止程序
2. 输入 `exit` 退出 screen 会话

或者从外部终止：

```bash
# 终止 screen 会话（会同时终止程序）
screen -S customer-service -X quit
```

## 🔧 常用命令

### 查看所有 Screen 会话

```bash
screen -ls
```

输出示例：
```
There is a screen on:
    12345.customer-service  (Detached)
1 Socket in /run/screen/S-root.
```

### 创建新会话

```bash
# 创建并命名会话
screen -S my-session-name

# 创建匿名会话
screen
```

### 重新连接会话

```bash
# 连接到指定名称的会话
screen -r customer-service

# 如果只有一个会话，可以简写
screen -r

# 强制连接（即使已经有人连接）
screen -x customer-service
```

### 终止会话

```bash
# 在 screen 内部终止（首选）
exit

# 从外部终止指定会话
screen -S customer-service -X quit

# 终止所有会话
killall screen
```

### 列出会话中的窗口

```bash
# 在 screen 内部按 Ctrl+A，然后按 W
```

## ⌨️ Screen 快捷键

在 Screen 会话内部，所有快捷键都以 `Ctrl+A` 开头：

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+A` `D` | 分离会话（detach） |
| `Ctrl+A` `C` | 创建新窗口 |
| `Ctrl+A` `N` | 切换到下一个窗口 |
| `Ctrl+A` `P` | 切换到上一个窗口 |
| `Ctrl+A` `K` | 关闭当前窗口 |
| `Ctrl+A` `[` | 进入复制模式（滚动查看历史） |
| `Ctrl+A` `?` | 显示帮助 |

## 📝 完整工作流程示例

```bash
# 1. SSH 连接到服务器
ssh root@43.139.82.12

# 2. 创建 screen 会话
screen -S customer-service

# 3. 启动程序
cd /root/ubuntu-deploy-ready
./customer-service-backend

# 4. 等待程序启动完成（看到 "HTTPS服务器启动在..." 等日志）

# 5. 分离会话：Ctrl+A，然后按 D

# 6. 退出 SSH
exit

# ===== 稍后 =====

# 7. 重新连接到服务器
ssh root@43.139.82.12

# 8. 查看 screen 会话
screen -ls

# 9. 重新连接
screen -r customer-service

# 10. 查看实时日志，检查程序状态

# 11. 如需停止程序：Ctrl+C，然后 exit
```

## 🆘 常见问题

### Q: 如何查看程序是否还在运行？

```bash
# 方法1: 查看进程
ps aux | grep customer-service-backend

# 方法2: 检查端口
lsof -ti:8443

# 方法3: 查看 screen 会话状态
screen -ls
```

### Q: Screen 会话意外断开了怎么办？

```bash
# 查看所有会话
screen -ls

# 如果看到 (Attached) 或 (Detached)，可以重新连接
screen -r customer-service

# 如果看到 (Dead)，需要清理
screen -wipe
```

### Q: 如何在不进入 screen 的情况下重启程序？

```bash
# 终止旧的 screen 会话
screen -S customer-service -X quit

# 创建新会话并在其中启动程序
screen -dmS customer-service bash -c 'cd /root/ubuntu-deploy-ready && ./customer-service-backend'

# 重新连接查看
screen -r customer-service
```

### Q: 如何保存 screen 的日志？

```bash
# 在 screen 内部启动日志记录
# Ctrl+A，然后按 H

# 或者在启动程序时就重定向日志
./customer-service-backend 2>&1 | tee server.log
```

## 🎓 最佳实践

### 1. 始终命名您的 Screen 会话

```bash
# 好习惯 ✅
screen -S customer-service

# 不好的习惯 ❌
screen  # 会创建难以识别的会话
```

### 2. 定期检查和清理无用的会话

```bash
# 列出所有会话
screen -ls

# 清理死亡的会话
screen -wipe

# 终止不需要的会话
screen -S old-session -X quit
```

### 3. 使用日志文件

即使使用 screen，仍然建议保存日志：

```bash
# 在 screen 中启动程序时重定向日志
cd /root/ubuntu-deploy-ready
./customer-service-backend 2>&1 | tee server.log

# 这样可以：
# - 在 screen 中看到实时输出
# - 同时保存到 server.log 文件
# - 即使 screen 崩溃也有日志可查
```

### 4. 监控程序健康状态

创建一个简单的监控脚本：

```bash
#!/bin/bash
# 保存为 check-status.sh

echo "🔍 检查客服系统状态..."
echo ""

# 检查进程
if pgrep -f customer-service-backend > /dev/null; then
    echo "✅ 进程运行中"
    ps aux | grep customer-service-backend | grep -v grep
else
    echo "❌ 进程未运行"
fi

echo ""

# 检查端口
if lsof -ti:8443 > /dev/null 2>&1; then
    echo "✅ 端口 8443 监听中"
else
    echo "❌ 端口 8443 未监听"
fi

echo ""

# 检查 screen 会话
echo "📺 Screen 会话:"
screen -ls

echo ""

# 测试 HTTPS 连接
echo "🔗 测试 HTTPS 连接:"
curl -k -s -o /dev/null -w "状态码: %{http_code}\n" https://localhost:8443/health
```

使用方法：
```bash
chmod +x check-status.sh
./check-status.sh
```

## 🔄 从 Screen 迁移到 Systemd

当您对部署感到满意后，建议迁移到 systemd 服务：

```bash
# 1. 停止 screen 中的程序
screen -S customer-service -X quit

# 2. 安装 systemd 服务
sudo cp customer-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable customer-service
sudo systemctl start customer-service

# 3. 验证
sudo systemctl status customer-service
```

这样：
- ✅ 开机自启动
- ✅ 自动重启（崩溃时）
- ✅ 更好的日志管理
- ✅ 更专业的部署方式

---

**祝您使用愉快！如有问题，请参考本文档或联系技术支持。** 🚀
