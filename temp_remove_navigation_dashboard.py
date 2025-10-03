# 临时脚本：删除页面导航、仪表板、认证、店铺列表相关函数
import re

file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 定义要删除的函数块
patterns_to_remove = [
    # 1. 页面切换相关 (switchPage + loadPageData + initializePageStates + initializeProfilePage)
    (r'\s*//\s*防抖计时器[\s\S]*?let switchPageTimer\s*=\s*null;\s*\n\s*\n\s*//\s*页面切换[\s\S]*?(?=\s*\n\s*//\s*加载仪表板数据)', 
     '\n        // 页面导航功能已外置至 /static/js/usecases/page-navigation.js：\n        // switchPage, loadPageData, initializePageStates, initializeProfilePage\n\n'),
    
    # 2. 仪表板数据加载 (loadDashboardData + fetchDashboardStats)
    (r'\s*//\s*加载仪表板数据[\s\S]*?async function loadDashboardData\(\)[\s\S]*?\n\s*\}[\s\S]*?async function fetchDashboardStats\(\)[\s\S]*?\n\s*\}',
     '\n        // 仪表板数据功能已外置至 /static/js/usecases/dashboard.js：\n        // loadDashboardData, fetchDashboardStats\n'),
    
    # 3. 对话列表加载 (loadConversations + fetchConversations)
    (r'\s*//\s*加载对话列表[\s\S]*?async function loadConversations\(\)[\s\S]*?\n\s*\}[\s\S]*?//\s*获取对话列表[\s\S]*?async function fetchConversations\(\)[\s\S]*?\];[\s\S]*?\n\s*\}',
     '\n        // 对话列表功能已外置至 /static/js/usecases/shops-list.js：\n        // loadConversations, fetchConversations\n'),
    
    # 4. 店铺列表加载 (loadShops + getShopStatusClass)
    (r'\s*//\s*加载店铺列表[\s\S]*?async function loadShops\(\)[\s\S]*?\n\s*\}[\s\S]*?//\s*获取店铺状态CSS类[\s\S]*?function getShopStatusClass\(status\)[\s\S]*?\n\s*\}',
     '\n        // 店铺列表加载功能已外置至 /static/js/usecases/shops-list.js：\n        // loadShops, getShopStatusClass\n'),
    
    # 5. 登出和消息辅助函数 (logout + goBackInMessages + sendMessage + 键盘事件)
    (r'\s*async function logout\(\)[\s\S]*?\n\s*\}[\s\S]*?//\s*消息页面相关全局函数[\s\S]*?function goBackInMessages\(\)[\s\S]*?\n\s*\}[\s\S]*?function sendMessage\(\)[\s\S]*?\n\s*\}[\s\S]*?//\s*添加键盘事件监听[\s\S]*?document\.addEventListener\([\'"]DOMContentLoaded[\'"]\,[\s\S]*?\}\);',
     '\n        // 认证与会话功能已外置至 /static/js/usecases/auth-session.js：\n        // logout, goBackInMessages, sendMessage, 键盘事件监听\n'),
]

for pattern, replacement in patterns_to_remove:
    content = re.sub(pattern, replacement, content, count=1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 成功删除页面导航、仪表板、认证、店铺列表相关函数")
