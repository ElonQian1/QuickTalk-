# 临时脚本：移除getShopActions函数并添加注释
import re

file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换 getShopActions 函数
pattern = r'(\s*//\s*获取店铺操作按钮\s*\n\s*function getShopActions\(shop\)\s*\{[\s\S]*?return actions\.join\(.*?\);\s*\})'

replacement = '''        // 店铺操作按钮渲染已外置至 /static/js/usecases/shop-actions-render.js：
        // getShopActions(shop)'''

content_new = re.sub(pattern, replacement, content, count=1)

if content != content_new:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content_new)
    print("✅ 成功替换 getShopActions 函数")
else:
    print("⚠️ 未找到匹配的内容")
