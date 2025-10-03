# 临时脚本：删除推广和通用工具相关的内联函数
import re

file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 删除推广功能相关函数
patterns_to_remove = [
    # showPromotionModal
    (r'\s*function showPromotionModal\(\)\s*\{[\s\S]*?(?=\s*\n\s*//|\s*\n\s*function\s|\s*\n\s*async function)', 
     '        // 推广功能已外置至 /static/js/usecases/promotion.js：\n        // showPromotionModal, hidePromotionModal, copyPromotionLink, shareToWeChat, generateQRCode, loadPromotionData\n'),
    
    # hidePromotionModal
    (r'\s*function hidePromotionModal\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # copyPromotionLink
    (r'\s*function copyPromotionLink\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # shareToWeChat
    (r'\s*function shareToWeChat\(\)\s*\{[\s\S]*?(?=\s*\n\s*function)', ''),
    
    # generateQRCode
    (r'\s*function generateQRCode\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # loadPromotionData
    (r'\s*async function loadPromotionData\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # formatTime
    (r'\s*function formatTime\(date\)\s*\{[\s\S]*?\n\s*\}', 
     '        // 通用工具已外置至 /static/js/utils/common-utils.js：\n        // formatTime, showToast, fetchShops, openConversation, createNewShop, showShopManagementModal\n'),
    
    # showToast
    (r'\s*function showToast\(message,\s*type\s*=\s*[\'"]info[\'"]\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # fetchShops
    (r'\s*async function fetchShops\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # openConversation
    (r'\s*function openConversation\(conversationId\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # createNewShop
    (r'\s*function createNewShop\(\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # showShopManagementModal
    (r'\s*function showShopManagementModal\(shop\)\s*\{[\s\S]*?\n\s*\}', ''),
    
    # 重复的审批函数（带有额外逻辑的版本）
    (r'\s*//\s*审核操作函数\s*\n\s*async function approveShop\(shopId,\s*event\)\s*\{[\s\S]*?(?=\s*\n\s*async function rejectShop)', 
     '        // 店铺审批操作（含确认对话框版本）已合并至 /static/js/usecases/shop-approval.js\n'),
    
    (r'\s*async function rejectShop\(shopId,\s*event\)\s*\{[\s\S]*?(?=\s*\n\s*async function activateShop)', ''),
    
    (r'\s*async function activateShop\(shopId,\s*event\)\s*\{[\s\S]*?(?=\s*\n\s*async function deactivateShop)', ''),
    
    (r'\s*async function deactivateShop\(shopId,\s*event\)\s*\{[\s\S]*?(?=\s*\n\s*function viewAnalytics)', ''),
]

for pattern, replacement in patterns_to_remove:
    content = re.sub(pattern, replacement, content, count=1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 成功删除推广和通用工具相关函数")
