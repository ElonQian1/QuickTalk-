# 删除主文件中的 MessageModule 类
import re

file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# MessageModule 类从行 3632 到 4728（行号从1开始，索引从0开始）
start_idx = 3632 - 1
end_idx = 4728 - 1

# 准备替换注释
replacement_comment = '''
        // 消息模块已外置至 /static/js/usecases/message-module.js
        // MessageModule 类：管理三层结构的消息系统（店铺 → 对话 → 消息）
        // 包含 WebSocket 连接管理、消息收发、媒体处理等功能

'''

# 删除类定义，保留注释
new_lines = lines[:start_idx] + [replacement_comment] + lines[end_idx + 1:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"✅ 成功删除 MessageModule 类")
print(f"   - 删除行数: {end_idx - start_idx + 1}")
print(f"   - 新文件行数将减少约 {end_idx - start_idx + 1 - len(replacement_comment.split('\\n'))} 行")
