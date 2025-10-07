import sqlite3
import os

# 连接到数据库
db_path = 'customer_service.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 读取SQL文件并执行
sql_file_path = '../database_schema.sql'
with open(sql_file_path, 'r', encoding='utf-8') as f:
    sql_script = f.read()

try:
    cursor.executescript(sql_script)
    conn.commit()
    print("✅ 数据库初始化成功！")
    
    # 验证表是否创建成功
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"📋 创建的表: {[table[0] for table in tables]}")
    
except Exception as e:
    print(f"❌ 数据库初始化失败: {e}")
    
finally:
    conn.close()