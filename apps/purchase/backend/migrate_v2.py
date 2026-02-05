from app import app
from database import db
from sqlalchemy import text

def migrate():
    with app.app_context():
        print("Migrating Database Schema for New Items...")
        
        # Columns to add to purchase_lines
        columns = [
            ("is_new_item", "BOOLEAN DEFAULT 0"),
            ("temp_category", "VARCHAR(100)"),
            ("temp_sku", "VARCHAR(50)"),
            ("temp_is_by_weight", "BOOLEAN DEFAULT 0")
        ]
        
        with db.engine.connect() as conn:
            for col_name, col_type in columns:
                try:
                    # SQLite ALERT TABLE ADD COLUMN
                    conn.execute(text(f"ALTER TABLE purchase_lines ADD COLUMN {col_name} {col_type}"))
                    print(f"✅ Added column: {col_name}")
                except Exception as e:
                    print(f"⚠️ Column {col_name} might already exist or error: {e}")
                    
            conn.commit()
            print("Migration Complete.")

if __name__ == "__main__":
    migrate()
