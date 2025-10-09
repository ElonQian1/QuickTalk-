import sqlite3

conn = sqlite3.connect('customer_service.db')
cursor = conn.cursor()

cursor.execute('SELECT id, content, message_type, file_url FROM messages WHERE message_type = "image" ORDER BY created_at DESC LIMIT 5')
rows = cursor.fetchall()

print('最近的图片消息:')
for row in rows:
    print(f'ID: {row[0]}, Content: {row[1]}, Type: {row[2]}, File URL: {row[3]}')

conn.close()