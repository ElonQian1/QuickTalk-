# 解决静态资源404问题

由于缺少favicon.ico和其他静态资源导致的404错误，我们需要添加这些文件到static目录。

## 需要添加的文件：
1. favicon.ico - 网站图标
2. search.png - 搜索图标
3. robots.txt - 搜索引擎指令
4. manifest.json - PWA应用清单

这些文件应该放在 backend/static/ 目录下，并由Rust后端提供服务。