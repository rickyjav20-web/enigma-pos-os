from datetime import datetime
from database import db

# Providers: Who we buy from
class Provider(db.Model):
    __tablename__ = 'providers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    normalized_name = db.Column(db.String(100)) # For duplicate detection
    category = db.Column(db.String(50)) # e.g. Lácteos, Varios
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Contact Info
    address = db.Column(db.String(200))
    phone = db.Column(db.String(50))
    email = db.Column(db.String(100))
    notes = db.Column(db.String(500))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'normalized_name': self.normalized_name,
            'category': self.category,
            'address': self.address,
            'phone': self.phone,
            'email': self.email,
            'notes': self.notes
        }

# Catalog Items: The 'Memory' of what we can buy (Seeded from Loyverse, updated locally)
class CatalogItem(db.Model):
    __tablename__ = 'catalog_items'
    id = db.Column(db.Integer, primary_key=True)
    loyverse_id = db.Column(db.String(100), unique=True) # UUID from Loyverse, if available
    sku = db.Column(db.String(50))
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.String(100))
    default_unit = db.Column(db.String(20)) # kg, L, und
    is_by_weight = db.Column(db.Boolean, default=False) # New field
    current_cost = db.Column(db.Float, default=0.0) # Local view of cost
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_pending = db.Column(db.Boolean, default=False) # Created ad-hoc, confirmed on purchase

    def to_dict(self):
        return {
            'id': self.id,
            'loyverse_id': self.loyverse_id,
            'sku': self.sku,
            'name': self.name,
            'category_id': self.category_id,
            'default_unit': self.default_unit,
            'is_by_weight': self.is_by_weight,
            'current_cost': self.current_cost,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_pending': self.is_pending
        }

# Purchase Header: The Transaction
class Purchase(db.Model):
    __tablename__ = 'purchases'
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.id'), nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    total_amount = db.Column(db.Float, nullable=False)
    invoice_number = db.Column(db.String(50))
    notes = db.Column(db.String(500))
    status = db.Column(db.String(20), default='draft') # 'draft', 'confirmed', 'cancelled'
    
    provider = db.relationship('Provider', backref='purchases')
    lines = db.relationship('PurchaseLine', backref='purchase', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'provider_id': self.provider_id,
            'provider_name': self.provider.name if self.provider else "Unknown",
            'date': self.date.isoformat(),
            'total_amount': self.total_amount,
            'invoice_number': self.invoice_number,
            'notes': self.notes,
            'status': self.status,
            'lines': [l.to_dict() for l in self.lines]
        }

# Purchase Line: The details
class PurchaseLine(db.Model):
    __tablename__ = 'purchase_lines'
    id = db.Column(db.Integer, primary_key=True)
    purchase_id = db.Column(db.Integer, db.ForeignKey('purchases.id'), nullable=False)
    catalog_item_id = db.Column(db.Integer, db.ForeignKey('catalog_items.id'), nullable=False)
    
    quantity = db.Column(db.Float, nullable=False)
    unit_cost = db.Column(db.Float, nullable=False)
    total_cost = db.Column(db.Float, nullable=False)

    catalog_item_name = db.Column(db.String(200)) # Snapshot of name at time of purchase
    
    # Temp fields for New Items (Deferred Creation)
    is_new_item = db.Column(db.Boolean, default=False)
    temp_category = db.Column(db.String(100))
    temp_sku = db.Column(db.String(50))
    temp_is_by_weight = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'catalog_item_id': self.catalog_item_id,
            'catalog_item_name': self.catalog_item_name,
            'quantity': self.quantity,
            'unit_cost': self.unit_cost,
            'total_cost': self.total_cost,
            'is_new_item': self.is_new_item,
            'temp_category': self.temp_category
        }

class CostHistory(db.Model):
    __tablename__ = 'cost_history'
    id = db.Column(db.Integer, primary_key=True)
    catalog_item_id = db.Column(db.Integer, db.ForeignKey('catalog_items.id'))
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.id'))
    purchase_line_id = db.Column(db.Integer, db.ForeignKey('purchase_lines.id'))
    old_cost = db.Column(db.Float)
    new_cost = db.Column(db.Float)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)
