#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
删除店铺管理和未读数管理函数 (Batch 6)
"""

import re

def delete_functions_batch6():
    file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content.splitlines())
    print(f"原始文件行数: {original_length}")
    
    # 1. 删除 isAdmin 函数 (大约在 3389 行)
    pattern1 = r'function isAdmin\(\) \{[^}]*\}'
    content = re.sub(pattern1, '', content, flags=re.DOTALL)
    
    # 2. 删除 canManageShops 函数 (大约在 3397 行)
    pattern2 = r'function canManageShops\(\) \{[^}]*\}'
    content = re.sub(pattern2, '', content, flags=re.DOTALL)
    
    # 3. 删除 openShopManagement 函数 (大约在 3652 行)
    pattern3 = r'function openShopManagement\(shopId\) \{.*?(?=\n\s*function\s|\n\s*</script>)'
    content = re.sub(pattern3, '', content, flags=re.DOTALL)
    
    # 4. 删除 generateManagementOptions 函数
    pattern4 = r'function generateManagementOptions\(shop\) \{.*?(?=\n\s*function\s|\n\s*</script>)'
    content = re.sub(pattern4, '', content, flags=re.DOTALL)
    
    # 5. 删除 handleShopAction 函数
    pattern5 = r'function handleShopAction\(action, shopId\) \{.*?(?=\n\s*function\s|\n\s*</script>)'
    content = re.sub(pattern5, '', content, flags=re.DOTALL)
    
    # 6. 删除 hasActionPermission 函数
    pattern6 = r'function hasActionPermission\(action, shop\) \{.*?(?=\n\s*function\s|\n\s*</script>)'
    content = re.sub(pattern6, '', content, flags=re.DOTALL)
    
    # 7. 删除 getStatusText 函数
    pattern7 = r'function getStatusText\(status\) \{[^}]*\}'
    content = re.sub(pattern7, '', content, flags=re.DOTALL)
    
    # 8. 删除 updateShopBadgeDisplay 函数
    pattern8 = r'function updateShopBadgeDisplay\(shopCard, unreadCount\) \{.*?(?=\n\s*function\s|\n\s*</script>)'
    content = re.sub(pattern8, '', content, flags=re.DOTALL)
    
    # 9. 删除 updateMobileShopUnreadBadges 函数 (大约在 4709 行)
    pattern9 = r'async function updateMobileShopUnreadBadges\(\) \{.*?(?=\n\s*(?:async\s)?function\s|\n\s*</script>)'
    content = re.sub(pattern9, '', content, flags=re.DOTALL)
    
    # 清理多余的空行
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    new_length = len(content.splitlines())
    deleted_lines = original_length - new_length
    
    print(f"删除后行数: {new_length}")
    print(f"删除行数: {deleted_lines}")
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 删除完成！")
    return deleted_lines

if __name__ == '__main__':
    delete_functions_batch6()
