import sqlite3
from pathlib import Path

def main():
    db_path = Path(__file__).resolve().parents[1] / "customer_service.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    print("Users:")
    for row in conn.execute("SELECT id, username, email FROM users ORDER BY id"):
        print(dict(row))

    print("\nShops:")
    for row in conn.execute("SELECT id, owner_id, shop_name, api_key FROM shops ORDER BY id"):
        print(dict(row))

    conn.close()

if __name__ == "__main__":
    main()
