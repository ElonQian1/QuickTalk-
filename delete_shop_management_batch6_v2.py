#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
精确删除店铺管理和未读数管理函数 (Batch 6)
"""

def delete_functions_batch6_precise():
    file_path = r'e:\kefu\backend\presentation\static\mobile-dashboard.html'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    original_length = len(lines)
    print(f"原始文件行数: {original_length}")
    
    # 找到并删除以下区域:
    # 1. handleShopAction 函数 (从3650行开始)
    # 2. hasActionPermission 函数 (从3709行开始)
    # 3. updateMobileShopUnreadBadges 及其监听器 (从4506行开始)
    
    # 标记要删除的行
    to_delete = set()
    
    # 查找 handleShopAction 函数 (3650-3708)
    in_handle_shop_action = False
    brace_count = 0
    for i in range(len(lines)):
        line = lines[i]
        if 'function handleShopAction(action, shopId' in line:
            in_handle_shop_action = True
            to_delete.add(i)
            brace_count = 0
        elif in_handle_shop_action:
            to_delete.add(i)
            brace_count += line.count('{') - line.count('}')
            if brace_count == 0 and '}' in line:
                in_handle_shop_action = False
    
    # 查找 hasActionPermission 函数 (3709-3747)
    in_has_action_permission = False
    brace_count = 0
    for i in range(len(lines)):
        line = lines[i]
        if 'function hasActionPermission(action, shop' in line:
            in_has_action_permission = True
            to_delete.add(i)
            brace_count = 0
        elif in_has_action_permission:
            to_delete.add(i)
            brace_count += line.count('{') - line.count('}')
            if brace_count == 0 and '}' in line:
                in_has_action_permission = False
    
    # 查找 updateMobileShopUnreadBadges 函数及其初始化代码 (4506-4598)
    in_update_badges = False
    brace_count = 0
    for i in range(len(lines)):
        line = lines[i]
        if 'function updateMobileShopUnreadBadges()' in line:
            in_update_badges = True
            to_delete.add(i)
            brace_count = 0
        elif in_update_badges:
            to_delete.add(i)
            brace_count += line.count('{') - line.count('}')
            if brace_count == 0 and '}' in line:
                # 继续删除后面的初始化代码
                # 直到遇到下一个函数或结束标记
                continue_delete = True
                j = i + 1
                while j < len(lines) and continue_delete:
                    next_line = lines[j]
                    # 如果遇到新的函数定义或 script 标签结束，停止
                    if ('function ' in next_line and not next_line.strip().startswith('//')) or \
                       '</script>' in next_line or \
                       '// ====' in next_line:
                        continue_delete = False
                    else:
                        to_delete.add(j)
                        j += 1
                in_update_badges = False
                break
    
    # 删除标记的行，但保留注释
    new_lines = []
    for i, line in enumerate(lines):
        if i not in to_delete:
            new_lines.append(line)
        elif i == min(to_delete):  # 在第一个删除位置添加注释
            new_lines.append('        // 店铺管理操作和未读数管理已外置至模块文件\n')
    
    new_length = len(new_lines)
    deleted_lines = original_length - new_length
    
    print(f"删除后行数: {new_length}")
    print(f"删除行数: {deleted_lines}")
    print(f"要删除的行数: {len(to_delete)}")
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print("✅ 精确删除完成！")
    return deleted_lines

if __name__ == '__main__':
    delete_functions_batch6_precise()
