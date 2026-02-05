import random
from datetime import datetime, timedelta
from app import app
from database import db
from models import Provider, CatalogItem, Purchase, PurchaseLine, CostHistory

def simulate():
    with app.app_context():
        print("🚀 Starting Data Simulation...")
        
        # 1. Ensure Providers exist
        provider_names = ["Distribuidora Macro", "Mercado Libre", "Abasto Local", "Sysco Import", "La Granja"]
        providers = []
        for name in provider_names:
            norm = name.lower().replace('.', '').strip()
            p = Provider.query.filter_by(normalized_name=norm).first()
            if not p:
                p = Provider(name=name, normalized_name=norm, category="Simulated")
                db.session.add(p)
            providers.append(p)
        db.session.commit()
        
        # 2. Get some Catalog Items
        # We need items that exist. Let's fetch a few common ones.
        # If DB is empty of items, we can't do much. assuming seed ran.
        items = CatalogItem.query.filter(CatalogItem.name.ilike('%Leche%') | 
                                         CatalogItem.name.ilike('%Azucar%') | 
                                         CatalogItem.name.ilike('%Harina%') |
                                         CatalogItem.name.ilike('%Cafe%') |
                                         CatalogItem.name.ilike('%Vaso%')).limit(10).all()
        
        if not items:
            print("❌ No items found. Please run seed_db.py first.")
            return

        print(f"🎯 Simulating purchases for {len(items)} items...")

        # 3. Create Purchases over last 60 days
        start_date = datetime.utcnow() - timedelta(days=60)
        
        for _ in range(30): # 30 Purchases
            # Random Date
            days_offset = random.randint(0, 60)
            p_date = start_date + timedelta(days=days_offset)
            
            # Random Provider
            provider = random.choice(providers)
            
            # Create Header
            purchase = Purchase(
                provider_id=provider.id,
                date=p_date,
                total_amount=0, # Calc later
                status='confirmed', # Simulate history
                invoice_number=f"SIM-{random.randint(1000,9999)}"
            )
            db.session.add(purchase)
            db.session.flush()
            
            total_invoice = 0
            
            # Add 1-4 lines
            num_lines = random.randint(1, 4)
            selected_items = random.sample(items, min(len(items), num_lines))
            
            for item in selected_items:
                qty = random.randint(5, 50)
                
                # Base cost variation +/- 20%
                base_cost = item.current_cost if item.current_cost > 0 else 5.0
                if base_cost == 0: base_cost = 5.0
                
                variance = random.uniform(0.8, 1.2)
                unit_cost = base_cost * variance
                total_cost = unit_cost * qty
                
                line = PurchaseLine(
                    purchase_id=purchase.id,
                    catalog_item_id=item.id,
                    catalog_item_name=item.name,
                    quantity=qty,
                    unit_cost=unit_cost,
                    total_cost=total_cost
                )
                db.session.add(line)
                total_invoice += total_cost
                
                # History Entry (Simulated)
                # In real app, confirm logic does this. Here we manually add valid history points 
                # so the graph/comparison looks good.
                
                history = CostHistory(
                    catalog_item_id=item.id,
                    provider_id=provider.id,
                    purchase_line_id=line.id,
                    old_cost=base_cost,
                    new_cost=unit_cost,
                    changed_at=p_date
                )
                db.session.add(history)
                
                # Update item current cost if this is the 'latest' date we simulated so far?
                # Actually, the logic is simpler: Just update it to the last one processed in loop?
                # No, let's leave curret_cost as whatever it was to show 'last known'.
                item.current_cost = unit_cost

            purchase.total_amount = total_invoice
        
        # 4. Create one DRAFT for testing
        draft = Purchase(
            provider_id=providers[0].id,
            date=datetime.utcnow(),
            total_amount=100.0,
            status='draft',
            notes="Compra simulada pendiente"
        )
        db.session.add(draft)
        db.session.flush()
        # Add a line
        l = PurchaseLine(
            purchase_id=draft.id,
            catalog_item_id=items[0].id,
            catalog_item_name=items[0].name,
            quantity=10,
            unit_cost=10.0,
            total_cost=100.0
        )
        db.session.add(l)

        db.session.commit()
        print("✅ Simulation Complete. created 30 confirmed purchases and 1 draft.")

if __name__ == "__main__":
    simulate()
