# 提取 MessageModule 类到独立文件
import re

# 读取主文件
with open(r'e:\kefu\backend\presentation\static\mobile-dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# MessageModule 类从 3632 行到 4728 行（行号从1开始）
start_line = 3632 - 1  # 转换为0索引
end_line = 4728 - 1

# 提取类定义
class_lines = lines[start_line:end_line + 1]
class_content = ''.join(class_lines)

# 创建模块文件内容
module_content = '''/**
 * MessageModule - 消息模块
 * 管理三层结构的消息系统：店铺 → 对话 → 消息
 * 负责 WebSocket 连接、消息收发、媒体处理
 */
(function() {
    'use strict';

''' + class_content.strip() + '''

    // 将类暴露到全局
    window.MessageModule = MessageModule;

    console.log('✅ 消息模块已加载 (message-module.js)');
})();
'''

# 写入新文件
with open(r'e:\kefu\backend\presentation\static\js\usecases\message-module.js', 'w', encoding='utf-8') as f:
    f.write(module_content)

print(f"✅ 成功提取 MessageModule 类到独立文件")
print(f"   - 行数: {end_line - start_line + 1}")
print(f"   - 字符数: {len(class_content)}")
