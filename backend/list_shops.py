import sqlite3

conn = sqlite3.connect('customer_service.db')
cur = conn.execute('SELECT id, shop_name, api_key FROM shops ORDER BY id')
for row in cur:
    print(f"id={row[0]}, name={row[1]}, api_key={row[2]}")
conn.close()
