
import sqlite3

def add_columns():
    # Use absolute path to ensure we hit the right DB
    db_path = 'Apps/purchase-app/backend/purchase_app.db'
    print(f"Updating DB at: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    columns = [
        ("address", "TEXT"),
        ("phone", "TEXT"),
        ("email", "TEXT"),
        ("notes", "TEXT")
    ]
    
    for col_name, col_type in columns:
        try:
            c.execute(f"ALTER TABLE providers ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name}")
        except sqlite3.OperationalError:
            print(f"Column {col_name} likely exists")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_columns()
