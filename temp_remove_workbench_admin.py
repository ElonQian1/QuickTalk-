# 临时脚本：删除工作台、用户配置、超级管理员相关函数
import re

file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 定义要删除的函数块（按出现顺序）
patterns_to_remove = [
    # 1. viewAnalytics
    (r'\s*function viewAnalytics\(\)\s*\{[\s\S]*?\n\s*\}', 
     '        // 工作台/报表功能已外置至 /static/js/usecases/workbench.js：\n        // viewAnalytics, loadWorkbenchSummary, renderWorkbench\n'),
    
    # 2. loadWorkbenchSummary
    (r'\s*async function loadWorkbenchSummary\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # 3. renderWorkbench（包含内联样式）
    (r'\s*function renderWorkbench\(summary\)\s*\{[\s\S]*?<\/style>\s*\n\s*`;[\s\S]*?\n\s*\}', ''),
    
    # 4. showUserInfo
    (r'\s*async function showUserInfo\(\)\s*\{[\s\S]*?\n\s*\}', 
     '\n        // 用户配置功能已外置至 /static/js/usecases/user-profile.js：\n        // showUserInfo, changePassword, notificationSettings, systemSettings, aboutApp\n'),
    
    # 5. changePassword
    (r'\s*async function changePassword\(\)\s*\{[\s\S]*?\n\s*\};[\s\S]*?\n\s*\}', ''),
    
    # 6. notificationSettings
    (r'\s*function notificationSettings\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # 7. systemSettings
    (r'\s*function systemSettings\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # 8. aboutApp
    (r'\s*function aboutApp\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # 9. 超级管理员功能块（大段删除）
    (r'\s*//\s*============\s*超级管理员功能\s*============[\s\S]*?(?=\s*async function logout)', 
     '\n        // ============ 超级管理员功能 ============\n        // 已外置至 /static/js/usecases/super-admin.js：\n        // showAdminPanel, loadSystemStats, loadShopOwnersStats, renderOwnersList,\n        // searchShopOwners, viewOwnerDetails, showOwnerDetailsModal, toggleOwnerStatus,\n        // loadAllShopsMonitor, renderShopsMonitor, loadPendingShops, renderPendingShops,\n        // reviewApprove, reviewReject, refreshPendingShops\n\n'),
]

for pattern, replacement in patterns_to_remove:
    content = re.sub(pattern, replacement, content, count=1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 成功删除工作台、用户配置、超级管理员相关函数")
