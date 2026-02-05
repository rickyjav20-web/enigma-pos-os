from app import app
from database import db
from sqlalchemy import text

def migrate():
    with app.app_context():
        print("Migrating Database Schema v3 (Pending Items)...")
        
        try:
            with db.engine.connect() as conn:
                conn.execute(text("ALTER TABLE catalog_items ADD COLUMN is_pending BOOLEAN DEFAULT 0"))
                conn.commit()
                print("✅ Added column: is_pending to catalog_items")
        except Exception as e:
            print(f"⚠️ Column might already exist: {e}")

if __name__ == "__main__":
    migrate()
