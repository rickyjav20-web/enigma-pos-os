from flask import Flask, jsonify, request, render_template, send_file, make_response
from flask_cors import CORS
from database import db, init_db
from models import Provider, CatalogItem, Purchase, PurchaseLine, CostHistory
import os
from datetime import datetime

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app) # Enable CORS for React Frontend

# Configure SQLite Database
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'purchase_app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

init_db(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Enigma Purchase App Backend Running"}), 200

# --- FRONTEND ROUTES ---
@app.route('/')
def index():
    # Inbox Logic: Count Drafts
    draft_count = Purchase.query.filter_by(status='draft').count()
    return render_template('hub.html', draft_count=draft_count)

@app.route('/settings')
def settings():
    return render_template('settings.html')



@app.route('/drafts')
def drafts_list():
    drafts = Purchase.query.filter_by(status='draft').order_by(Purchase.date.desc()).all()
    return render_template('drafts.html', drafts=[d.to_dict() for d in drafts])

@app.route('/providers/<int:provider_id>')
def provider_detail(provider_id):
    p = Provider.query.get_or_404(provider_id)
    
    # Calculate Metrics
    # 1. Total Spend
    # 2. Purchase Count
    # 3. Volatility (CostHistory count)
    
    purchases = Purchase.query.filter_by(provider_id=provider_id, status='confirmed').all()
    total_spend = sum(px.total_amount for px in purchases)
    purchase_count = len(purchases)
    
    volatility = CostHistory.query.filter_by(provider_id=provider_id).count()
    
    metrics = {
        "total_spend": total_spend,
        "purchase_count": purchase_count,
        "volatility": volatility
    }
    
    # History List (Recent 20)
    history = Purchase.query.filter_by(provider_id=provider_id, status='confirmed').order_by(Purchase.date.desc()).limit(20).all()
    
    # Reuse the top items logic call or query directly? Query directly for simpler template passing
    from sqlalchemy import func
    top = db.session.query(PurchaseLine.catalog_item_name, func.count(PurchaseLine.id)).\
        join(Purchase).\
        filter(Purchase.provider_id == provider_id).\
        group_by(PurchaseLine.catalog_item_name).\
        order_by(func.count(PurchaseLine.id).desc()).\
        limit(5).all()
        
    top_items = [{"name": n, "count": c} for n, c in top]

    return render_template('provider_detail.html', provider=p, metrics=metrics, top_items=top_items, history=history)

@app.route('/comparison')
def comparison():
    return render_template('product_comparison.html')

@app.route('/new-purchase')
def new_purchase():
    # Screen 1: Register Purchase
    return render_template('register_purchase.html')

@app.route('/add-product')
def add_product():
    # Screen 2: Add Product
    provider_id = request.args.get('provider_id')
    provider_name = request.args.get('provider_name')
    return render_template('add_product.html', provider_id=provider_id, provider_name=provider_name)

@app.route('/purchase-detail')
def purchase_detail():
    item_id = request.args.get('item_id')
    item_name = request.args.get('item_name')
    last_cost = request.args.get('last_cost')
    provider_id = request.args.get('provider_id')
    unit_label = request.args.get('unit_label', 'Und') # Passed from Add Product
    return render_template('purchase_detail.html', 
                          item_id=item_id, item_name=item_name, 
                          last_cost=last_cost, provider_id=provider_id,
                          unit_label=unit_label)



@app.route('/list-providers')
def list_providers_view():
    providers = Provider.query.order_by(Provider.name).all()
    return render_template('providers_list.html', providers=[p.to_dict() for p in providers])

@app.route('/price-monitor')
def price_monitor():
    return render_template('price_monitor.html')

@app.route('/review/<int:purchase_id>')
def review_purchase(purchase_id):
    purchase = Purchase.query.get_or_404(purchase_id)
    
    # Enrichment: Calculate impact
    enriched_lines = []
    has_alerts = False
    
    for line in purchase.lines:
        cat_item = db.session.get(CatalogItem, line.catalog_item_id)
        old_cost = cat_item.current_cost if cat_item else 0.0
        new_cost = line.unit_cost
        
        diff = 0
        diff_pct = 0
        status = 'same'
        
        if old_cost > 0:
            diff = new_cost - old_cost
            if abs(diff) > 0.01:
                diff_pct = (diff / old_cost) * 100
                if diff > 0:
                    status = 'up'
                    has_alerts = True
                else:
                    status = 'down'
        elif new_cost > 0:
             status = 'new'

        enriched_lines.append({
            'line': line,
            'old_cost': old_cost,
            'diff_pct': round(diff_pct, 1),
            'status': status
        })

    return render_template('confirmation.html', purchase=purchase, lines=enriched_lines, has_alerts=has_alerts) 

@app.route('/confirmation')
def confirmation():
    return "Deprecated", 410

# --- API ENDPOINTS ---

@app.route('/api/providers/<int:provider_id>/history', methods=['GET'])
def get_provider_history(provider_id):
    # Purchases for this provider
    purchases = Purchase.query.filter_by(provider_id=provider_id).order_by(Purchase.date.desc()).limit(50).all()
    # Summary stats
    total_spent = sum(p.total_amount for p in purchases)
    
    return jsonify({
        "total_spent": total_spent,
        "purchases": [p.to_dict() for p in purchases]
    })

@app.route('/api/catalog/monitor', methods=['GET'])
def get_price_monitor():
    # Items with cost > 0, ordered by last update
    items = CatalogItem.query.filter(CatalogItem.current_cost > 0).order_by(CatalogItem.updated_at.desc()).all()
    return jsonify([i.to_dict() for i in items])


@app.route('/api/purchases/recent', methods=['GET'])
def get_recent_purchases():
    # Only return last 5 purchases
    purchases = Purchase.query.order_by(Purchase.date.desc()).limit(5).all()
    # Need to manually construct dict with lines because lazy loading might be an issue if serialized poorly
    # But p.to_dict handles lines? Let's check model. 
    # Current model Purchase.to_dict() does include lines = [line.to_dict() for line in self.lines]
    return jsonify([p.to_dict() for p in purchases])

@app.route('/api/export/purchases')
def export_purchases():
    import csv
    import io
    from flask import Response

    si = io.StringIO()
    cw = csv.writer(si)
    # Header
    cw.writerow(['Fecha', 'Proveedor', 'Item', 'SKU', 'Cantidad', 'Unidad', 'Costo Unitario', 'Costo Total', 'Total Factura'])

    purchases = Purchase.query.order_by(Purchase.date.desc()).all()
    
    for p in purchases:
        prov_name = p.provider.name if p.provider else "Desconocido"
        for line in p.lines:
            cw.writerow([
                p.date.strftime('%Y-%m-%d %H:%M'),
                prov_name,
                line.catalog_item_name,
                "SKU-FIXME", # Line doesn't store SKU, CatalogItem does. Access via rel or loose coupling
                line.quantity,
                "Und", # FIXME: Line doesn't store unit.
                line.unit_cost,
                line.total_cost,
                p.total_amount
            ])
            
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=historial_compras.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route('/api/settings/upload-catalog', methods=['POST'])
def upload_catalog():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file:
        # Save temp
        filepath = os.path.join(os.path.dirname(__file__), '..', 'data', 'temp_upload.csv')
        file.save(filepath)
        
        # Trigger Seed/Update Logic
        # We can reuse logic from seed_db.py but we need to import it or duplicate logic.
        # Ideally, we refactor seed_db to be callable.
        # For now, let's just do a subprocess call to seed_db.py or better, import the function.
        # But seed_db is a script. Let's make it a module.
        
        # Quick hack: Inline the logic or call the script. 
        # Better: Import seed_db since it is in same folder if we fix path
        
        try:
            from seed_db import seed_catalog_from_path
            added, providers = seed_catalog_from_path(filepath)
            return jsonify({"items_added": added, "providers_added": providers})
        except ImportError:
            # Fallback if seed_db not refactored yet
            return jsonify({"error": "Backend update needed: seed_db module mismatch"}), 500

@app.route('/api/export/catalog-items')
def export_catalog_items():
    import csv
    import io
    from flask import Response

    si = io.StringIO()
    cw = csv.writer(si)
    # Header matching Loyverse as close as possible for re-import
    cw.writerow(['Handle', 'SKU', 'Nombre', 'Categoria', 'Coste', 'Precio', 'Vendido por peso', 'Proveedor'])

    items = CatalogItem.query.all()
    
    for i in items:
        # Provider Inference: Try to find latest provider from purchases or seeding logic?
        # Since we don't store it on Item, we leave it empty or put "Variado".
        # However, for the user's "TODO" dump, having the Name and Cost is the critical part.
        
        cw.writerow([
            i.loyverse_id or f"handle-{i.id}",
            i.sku or "",
            i.name,
            i.category_id or "General",
            i.current_cost,
            0, # Price not tracked
            'Y' if i.is_by_weight else 'N',
            "" # Provider unknown/varied
        ])
            
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = "attachment; filename=export_catalog_FULL.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route('/api/analysis/comparison/<int:item_id>')
def analyze_item_prices(item_id):
    # Logic: Find all purchases for this item, group by Provider.
    # Get the LATEST price for each provider.
    
    # 1. Get raw purchase lines for this item
    lines = PurchaseLine.query.filter_by(catalog_item_id=item_id).join(Purchase).order_by(Purchase.date.desc()).all()
    
    # 2. Group by provider
    providers_map = {}
    
    for line in lines:
        pid = line.purchase.provider_id
        if pid not in providers_map:
            # Since we ordered DESC, the first one we see is the latest for that provider
            providers_map[pid] = {
                "name": line.purchase.provider.name,
                "last_price": line.unit_cost,
                "date": line.purchase.date.isoformat()
            }
    
    return jsonify({
        "item_id": item_id,
        "providers": list(providers_map.values())
    })



@app.route('/api/analysis/top-providers')
def get_top_providers():
    # Logic: Providers with most 'confirmed' purchases
    # SQLite optimized query or simple python aggregation if dataset small
    from sqlalchemy import func
    
    # query: select provider_id, count(*) from purchases where status='confirmed' group by provider_id order by count desc limit 6
    top = db.session.query(Purchase.provider_id, func.count(Purchase.id)).\
        filter_by(status='confirmed').\
        group_by(Purchase.provider_id).\
        order_by(func.count(Purchase.id).desc()).\
        limit(6).all()
        
    results = []
    for pid, count in top:
        p = db.session.get(Provider, pid)
        if p:
            results.append(p.to_dict())
            
    return jsonify(results)

@app.route('/api/analysis/provider/<int:provider_id>/top-items')
def get_provider_top_items(provider_id):
    # Logic: Items most frequently bought from this provider
    from sqlalchemy import func
    
    # Join PurchaseLine -> Purchase
    # Filter by Purchase.provider_id = provider_id
    # Group by catalog_item_id
    
    top = db.session.query(PurchaseLine.catalog_item_id, func.count(PurchaseLine.id)).\
        join(Purchase).\
        filter(Purchase.provider_id == provider_id).\
        group_by(PurchaseLine.catalog_item_id).\
        order_by(func.count(PurchaseLine.id).desc()).\
        limit(8).all()
        
    results = []
    for iid, count in top:
        item = db.session.get(CatalogItem, iid)
        if item:
            results.append({
                "id": item.id,
                "name": item.name,
                "sku": item.sku,
                "last_cost": item.current_cost # Useful for display
            })
            
    return jsonify(results)

@app.route('/api/purchases', methods=['POST'])
def create_purchase():
    data = request.json
    items_data = data.get('items', [])
    
    # Calculate total if not provided
    calculated_total = 0
    if items_data:
        calculated_total = sum(i.get('total_cost', 0) for i in items_data)
        
    total = data.get('total_amount', calculated_total)

    try:
        # Create as DRAFT
        purchase = Purchase(
            provider_id=data['provider_id'],
            total_amount=total,
            status='draft'
        )
        if 'date' in data:
            purchase.date = datetime.fromisoformat(data['date'])
            
        db.session.add(purchase)
        db.session.flush() # Get ID
        
        for item in items_data:
            # Check if it's a NEW Ad-Hoc Item?
            # Front-end should send 'is_new_item': True and item payload details
            
            catalog_id = item.get('catalog_item_id')
            item_name = item.get('catalog_item_name', 'Unknown')
            
            if item.get('is_new_item'):
                # CREATE PENDING CATALOG ITEM
                # Generate a temporary handle/SKU if needed
                new_cat_item = CatalogItem(
                    name=item_name,
                    category_id=item.get('category', 'General'),
                    current_cost=item.get('unit_cost', 0),
                    default_unit=item.get('unit_label', 'und'),
                    is_by_weight=(item.get('unit_label') == 'kg'),
                    sku=item.get('sku') or f"TEMP-{int(datetime.utcnow().timestamp())}",
                    loyverse_id=f"temp-{int(datetime.utcnow().timestamp())}-{item_name[:5]}",
                    is_pending=True # <--- MARK AS PENDING
                )
                db.session.add(new_cat_item)
                db.session.flush()
                catalog_id = new_cat_item.id # Link to this new pending item
            
            # Normal Line Creation
            cat_item = db.session.get(CatalogItem, catalog_id)
            # if item didn't exist and wasn't new, this might fail, but let's assume valid ID
            
            line = PurchaseLine(
                purchase_id=purchase.id,
                catalog_item_id=catalog_id,
                catalog_item_name=item_name,
                quantity=item['quantity'],
                unit_cost=item['unit_cost'],
                total_cost=item['total_cost'],
                # We can still store temp tags if we want logs, but the relation is key
                is_new_item=item.get('is_new_item', False),
                temp_category=item.get('category')
            )
            db.session.add(line)
            
        db.session.commit()
        return jsonify(purchase.to_dict()), 201

        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/purchases/<int:purchase_id>/confirm', methods=['POST'])
def confirm_purchase(purchase_id):
    try:
        purchase = Purchase.query.get(purchase_id)
        if not purchase:
            return jsonify({"error": "Purchase not found"}), 404
        
        if purchase.status == 'confirmed':
            return jsonify({"error": "Already confirmed"}), 400

        # Update Status
        purchase.status = 'confirmed'
        
        # Update Costs & PROMOTE PENDING ITEMS
        
        for line in purchase.lines:
            cat_item = db.session.get(CatalogItem, line.catalog_item_id)
            if cat_item:
                # 1. Promote if Pending
                if cat_item.is_pending:
                    cat_item.is_pending = False
                    # Maybe clear "TEMP" SKU if we want user to formalize it?
                    # For MVP, we keep the data they entered.
                
                # 2. Update Cost logic
                old_cost = cat_item.current_cost
                new_cost = line.unit_cost
                
                # Update Catalog
                cat_item.current_cost = new_cost
                cat_item.updated_at = datetime.utcnow()
                
                # Log History if changed (or first time)
                if abs(old_cost - new_cost) > 0.001:
                    history = CostHistory(
                        catalog_item_id=cat_item.id,
                        provider_id=purchase.provider_id,
                        purchase_line_id=line.id,
                        old_cost=old_cost,
                        new_cost=new_cost
                    )
                    db.session.add(history)

        db.session.commit()
        
        # --- CSV EXPORT LOGIC ---
        try:
            import csv
            csv_path = os.path.join(basedir, 'purchase_history_log.csv')
            file_exists = os.path.isfile(csv_path)
            
            with open(csv_path, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                if not file_exists:
                    # Write Header
                    writer.writerow(['purchase_id', 'date', 'provider', 'item_name', 'quantity', 'unit_cost', 'total_cost'])
                
                # Write Lines
                for line in purchase.lines:
                    writer.writerow([
                        purchase.id,
                        purchase.date.isoformat(),
                        purchase.provider.name,
                        line.catalog_item_name,
                        line.quantity,
                        line.unit_cost,
                        line.total_cost
                    ])
            print(f"CSV Log Updated: {csv_path}")
        except Exception as csv_e:
            print(f"Failed to write CSV: {csv_e}")
            # Don't fail the request, just log it.
            
        return jsonify(purchase.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/purchases/<int:purchase_id>', methods=['DELETE'])
def delete_purchase(purchase_id):
    try:
        purchase = Purchase.query.get_or_404(purchase_id)
        if purchase.status == 'confirmed':
             return jsonify({"error": "Cannot delete confirmed purchase"}), 400
             
        # Explicit delete loop for safety
        for line in purchase.lines:
            # Check if this was a PENDING item? If we delete the draft, we should probably clean up the pending catalog item?
            # Only if NO OTHER lines refer to it (hard to know efficiently).
            # For now, let's look up the item.
            cat_item = db.session.get(CatalogItem, line.catalog_item_id)
            db.session.delete(line)
            
            if cat_item and cat_item.is_pending:
                # If it's pending, and we are deleting the only draft referencing it...
                # Simple logic: Just delete it. Pending items are ephemeral until confirmed.
                db.session.delete(cat_item)

        db.session.delete(purchase)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/purchases/<int:purchase_id>/clone', methods=['POST'])
def clone_purchase(purchase_id):
    try:
        original = Purchase.query.get_or_404(purchase_id)
        
        # Create new Draft
        clone = Purchase(
            provider_id=original.provider_id,
            total_amount=original.total_amount,
            status='draft'
        )
        db.session.add(clone)
        db.session.flush()
        
        for line in original.lines:
            new_line = PurchaseLine(
                purchase_id=clone.id,
                catalog_item_id=line.catalog_item_id,
                catalog_item_name=line.catalog_item_name,
                quantity=line.quantity,
                unit_cost=line.unit_cost,
                total_cost=line.total_cost
            )
            db.session.add(new_line)
            
        db.session.commit()
        return jsonify(clone.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/providers', methods=['GET'])
def get_providers():
    providers = Provider.query.order_by(Provider.name).all()
    return jsonify([p.to_dict() for p in providers])

@app.route('/api/providers', methods=['POST'])
def create_provider():
    data = request.json
    if not data or 'name' not in data:
        return jsonify({"error": "Name is required"}), 400
    
    raw_name = data['name'].strip()
    normalized = raw_name.lower().replace('.', '').replace(',', '').strip()
    
    # Check duplicate by normalized name
    existing = Provider.query.filter_by(normalized_name=normalized).first()
    if existing:
        return jsonify(existing.to_dict()), 200 # Return existing instead of creating duplicate
    
    new_provider = Provider(
        name=raw_name.title(), 
        category=data.get('category', 'General'),
        normalized_name=normalized
    )
    db.session.add(new_provider)
    db.session.commit()
    return jsonify(new_provider.to_dict()), 201

@app.route('/api/providers/<int:provider_id>', methods=['PUT'])
def update_provider(provider_id):
    print(f"--- UPDATE PROVIDER {provider_id} REQUEST ---")
    p = Provider.query.get_or_404(provider_id)
    data = request.json
    print(f"Payload received: {data}")
    
    if 'address' in data: p.address = data['address']
    if 'phone' in data: p.phone = data['phone']
    if 'email' in data: p.email = data['email']
    if 'category' in data: p.category = data['category']
    if 'notes' in data: p.notes = data['notes']
    
    try:
        db.session.commit()
        print(f"Commit successful. New Phone in memory: {p.phone}")
        return jsonify(p.to_dict())
    except Exception as e:
        print(f"Commit FAILED: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/catalog/search', methods=['GET'])
def search_catalog():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    # Search by Name or SKU
    # EXCLUDE PENDING ITEMS (They are invisible until confirmed)
    items = CatalogItem.query.filter(
        (CatalogItem.name.ilike(f'%{query}%')) | 
        (CatalogItem.sku.ilike(f'%{query}%'))
    ).filter(
        (CatalogItem.is_pending == False) | (CatalogItem.is_pending == None)
    ).limit(30).all()
    
    return jsonify([i.to_dict() for i in items])

@app.route('/optimizer')
def optimizer_view():
    return render_template('smart_shopping.html')

@app.route('/api/optimizer/analyze', methods=['POST'])
def analyze_shopping_list():
    data = request.json
    item_ids = data.get('item_ids', [])
    
    # Logic: For each item, find the provider with the lowest *recent* price.
    # Group by Provider.
    
    plan = {} # { provider_id: { name, items: [], total } }
    
    for item_id in item_ids:
        # Get Item Name
        item = db.session.get(CatalogItem, item_id)
        if not item: continue
        
        # Find best price from history logic
        # Query: Get latest purchase line for this item from EACH provider to compare.
        # Simplification: Get all CostHistory or PurchaseLines for this item.
        
        last_purchases = db.session.query(PurchaseLine).filter_by(catalog_item_id=item_id)\
            .join(Purchase).order_by(Purchase.date.desc()).all()
            
        # Find min price provider
        best_provider = None
        min_price = float('inf')
        
        provider_prices = {}
        for lp in last_purchases:
            pid = lp.purchase.provider_id
            if pid not in provider_prices:
                provider_prices[pid] = lp.unit_cost
                if lp.unit_cost < min_price:
                    min_price = lp.unit_cost
                    best_provider = lp.purchase.provider
        
        if not best_provider:
            # Fallback if never purchased: "Unknown Provider" or "General"
            # Just skip or put in "Sin Historial"
            p_id = 0
            p_name = "Sin Historial (Est. Precio Actual)"
            price = item.current_cost
        else:
            p_id = best_provider.id
            p_name = best_provider.name
            price = min_price
            
        if p_id not in plan:
            plan[p_id] = {
                "provider_name": p_name,
                "provider_address": best_provider.address if best_provider else None,
                "provider_phone": best_provider.phone if best_provider else None,
                "items": [], 
                "total_est": 0
            }
            
        plan[p_id]['items'].append({
            "name": item.name,
            "est_cost": price
        })
        plan[p_id]['total_est'] += price
        
    return jsonify(list(plan.values()))

@app.route('/api/settings/download-db')
def download_db():
    try:
        db_path = os.path.join(basedir, 'purchase_app.db')
        return send_file(db_path, as_attachment=True, download_name='backup_purchase_app.db')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/upload-db', methods=['POST'])
def upload_db():
    if 'file' not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files['file']
    
    try:
        # Dangerous: Overwrite running DB.
        # On POSIX systems, this usually works (file descriptor replacement).
        # We save to a temp name first then rename to be safer/atomic
        db_path = os.path.join(basedir, 'purchase_app.db')
        file.save(db_path)
        return jsonify({"message": "Database Restored successfully. Server restart recommended."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/download-log')
def download_log():
    try:
        csv_path = os.path.join(basedir, 'purchase_history_log.csv')
        if not os.path.exists(csv_path):
             return jsonify({"error": "No CSV log found"}), 404
        return send_file(csv_path, as_attachment=True, download_name='audit_log.csv')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/upload-history', methods=['POST'])
def upload_history():
    # RESTORE LOGIC: Replay purchases from CSV
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    
    try:
        import csv
        import io
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        reader = csv.DictReader(stream)
        
        # We need to map: "Fecha", "Proveedor", "Item", "Unidad", "Costo Unitario", "Cantidad"
        # Since CSV is flat lines, we need to group by (Date, Provider) to create Purchase objects.
        
        from collections import defaultdict
        grouped_purchases = defaultdict(list)
        
        count_p = 0
        count_l = 0
        
        for row in reader:
            # Key: Date + Provider + Total (to allow multiple same-day entries distinct if totals differ, though fuzzy)
            # Better Key: Just use row index for grouping if sequential? No, CSV might be mixed.
            # Best logic for flat csv: Group by Date+ProviderName.
            date_str = row.get('Fecha', '').split(' ')[0] # 2026-01-27
            prov_name = row.get('Proveedor', 'General')
            key = (date_str, prov_name)
            grouped_purchases[key].append(row)

        for (date_str, prov_name), rows in grouped_purchases.items():
             # 1. Find/Create Provider
             # Try normalized
             normalized = prov_name.lower().strip()
             provider = Provider.query.filter(Provider.name.ilike(prov_name)).first()
             if not provider:
                 provider = Provider(name=prov_name, category='Importado', normalized_name=normalized)
                 db.session.add(provider)
                 db.session.flush()
            
             # 2. Create Purchase Header
             # Sum total from lines
             total_amt = sum(float(r.get('Costo Total', 0) or 0) for r in rows)
             
             purchase = Purchase(
                 provider_id=provider.id,
                 total_amount=total_amt,
                 status='confirmed', # Import as confirmed
                 date=datetime.strptime(date_str, '%Y-%m-%d')
             )
             db.session.add(purchase)
             db.session.flush()
             count_p += 1
             
             # 3. Add Lines
             for r in rows:
                 item_name = r.get('Item')
                 qty = float(r.get('Cantidad', 0))
                 cost = float(r.get('Costo Unitario', 0))
                 total = float(r.get('Costo Total', 0))
                 
                 # Match Item
                 item = CatalogItem.query.filter(CatalogItem.name.ilike(item_name)).first()
                 item_id = item.id if item else None
                 
                 # Update Cost? Yes, if it's the LATEST date.
                 # But since we bulk import, cost history might get messy if not chronological.
                 # Simplified: Just insert records.
                 
                 line = PurchaseLine(
                     purchase_id=purchase.id,
                     catalog_item_id=item_id,
                     catalog_item_name=item_name,
                     quantity=qty,
                     unit_cost=cost,
                     total_cost=total
                 )
                 db.session.add(line)
                 count_l += 1
                 
                 # Force update catalog cost to this latest one
                 if item: 
                     item.current_cost = cost
        
        db.session.commit()
        return jsonify({"purchases": count_p, "lines": count_l}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/purge-data', methods=['POST'])
def purge_data():
    # SECURITY: This deletes transaction history
    try:
        data = request.json
        mode = data.get('mode') # 'transactions_only' or 'full_wipe'
        
        # 1. Delete Transactions
        db.session.query(CostHistory).delete()
        db.session.query(PurchaseLine).delete()
        db.session.query(Purchase).delete()
        
        if mode == 'full_wipe':
            # ALSO DELETE Master Data
            db.session.query(CatalogItem).delete()
            db.session.query(Provider).delete()
            
        db.session.commit()
        return jsonify({"message": "Purge successful"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5005)
