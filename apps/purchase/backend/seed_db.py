import csv
import os
from database import db
from models import CatalogItem, Provider

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Points to ../data/items.csv relative to this backend script
CSV_PATH = os.path.join(BASE_DIR, '..', 'data', 'items.csv')

def seed_catalog_from_path(csv_path_arg=None):
    target_path = csv_path_arg if csv_path_arg else CSV_PATH
    print(f"Reading CSV from: {target_path}")
    
    if not os.path.exists(target_path):
        print("Error: CSV file not found.")
        return 0, 0

    count = 0
    new_providers_count = 0
    
    try:
        new_providers = set()
        
        # Ensure we are in transaction
        # If run from script, we need explicit commit.
        # If run from app route, session usage is fine, but we return counts.
        
        with open(target_path, mode='r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                name = row.get('Nombre', '').strip()
                if not name:
                    continue

                handle = row.get('Handle', '')
                sku = row.get('SKU', '') 
                
                try:
                    cost = float(row.get('Coste', 0.0))
                except ValueError:
                    cost = 0.0
                    
                category_id = row.get('Categoria', '')
                
                # Unit Logic
                sold_by_weight_str = row.get('Vendido por peso', 'N').upper()
                is_by_weight = (sold_by_weight_str == 'Y')
                default_unit = 'kg' if is_by_weight else 'und'

                # Check existence by Loyverse ID (Handle)
                existing = CatalogItem.query.filter_by(loyverse_id=handle).first()
                if not existing:
                    item = CatalogItem(
                        loyverse_id=handle,
                        sku=sku,
                        name=name[:199],
                        category_id=category_id,
                        current_cost=cost,
                        default_unit=default_unit,
                        is_by_weight=is_by_weight
                    )
                    db.session.add(item)
                    count += 1
                else:
                     existing.is_by_weight = is_by_weight
                     existing.default_unit = default_unit
                    
                # Provider logic
                prov_name = row.get('Proveedor', '').strip()
                if prov_name and prov_name.lower() != 'nan':
                    # Use normalized check if possible, or simple check
                    # Models.py has normalized_name now.
                    # We should probably normalize here too or update Provider model logic?
                    # For seeding, let's keep it simple or align with new model.
                    # Let's align.
                    normalized = prov_name.lower().replace('.', '').replace(',', '').strip()
                    existing_prov = Provider.query.filter_by(normalized_name=normalized).first()
                    
                    if not existing_prov:
                         db.session.add(Provider(
                             name=prov_name.title(), 
                             category='Scanner Import',
                             normalized_name=normalized
                         ))
                         new_providers_count += 1
                            
        db.session.commit()
        return count, new_providers_count
        
    except Exception as e:
        print(f"Error reading CSV: {e}")
        db.session.rollback()
        return 0, 0

if __name__ == "__main__":
    from app import app
    with app.app_context():
        print("Migrating Database...")
        db.create_all()
        seed_catalog_from_path()
