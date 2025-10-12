#!/usr/bin/env python3
import os
import re

def fix_error_strings(file_path):
    """修复 AppError 字符串类型错误"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复 AppError::Internal
    content = re.sub(
        r'AppError::Internal\("([^"]+)"\)',
        r'AppError::Internal("\1".to_string())',
        content
    )
    
    # 修复 AppError::BadRequest  
    content = re.sub(
        r'AppError::BadRequest\("([^"]+)"\)',
        r'AppError::BadRequest("\1".to_string())',
        content
    )
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed: {file_path}")

# 要修复的文件列表
files_to_fix = [
    'src/handlers/customer.rs',
    'src/handlers/message.rs', 
    'src/handlers/shop.rs',
    'src/handlers/stats.rs',
    'src/handlers/upload.rs',
    'src/services/staff.rs'
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        fix_error_strings(file_path)
    else:
        print(f"File not found: {file_path}")

print("All files fixed!")