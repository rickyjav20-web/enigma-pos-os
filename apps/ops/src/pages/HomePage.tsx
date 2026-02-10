import { Package, ArrowRight, ShoppingCart, TrendingUp, Building2, Sparkles, ArrowLeftRight, DollarSign, ChevronDown, ChevronUp, Wallet, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

interface RecentPurchase {
    id: string;
    supplier?: { name: string };
    totalAmount: number;
    createdAt: string;
}

interface AuditData {
    startingCash: number;
    transactionsTotal: number;
    expectedCash: number;
    breakdown?: {
        sales: number;
        purchases: number;
        expenses: number;
        other: number;
    };
    transactionCount: number;
}

export default function HomePage() {
    const { session, employee } = useAuth();
    const [stats, setStats] = useState({ suppliers: 0, items: 0, recentPurchases: 0 });
    const [recentOrders, setRecentOrders] = useState<RecentPurchase[]>([]);
    const [auditData, setAuditData] = useState<AuditData | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    const TENANT_HEADER = { 'x-tenant-id': 'enigma_hq', 'Content-Type': 'application/json' };

    useEffect(() => {
        Promise.all([
            fetch(`${API_URL}/suppliers`, { headers: TENANT_HEADER }).then(r => r.json()),
            fetch(`${API_URL}/supply-items?limit=1`, { headers: TENANT_HEADER }).then(r => r.json()),
            fetch(`${API_URL}/purchases`, { headers: TENANT_HEADER }).then(r => r.json())
        ]).then(([suppliers, items, purchases]) => {
            setStats({
                suppliers: suppliers?.length || 0,
                items: items?.total || 0,
                recentPurchases: purchases?.length || 0
            });
            setRecentOrders((purchases || []).slice(0, 3));
        }).catch(console.error);
    }, []);

    // Fetch live cash balance
    useEffect(() => {
        if (session?.id) {
            fetch(`${API_URL}/register/audit/${session.id}`, { headers: TENANT_HEADER })
                .then(r => r.json())
                .then(data => setAuditData(data))
                .catch(console.error);
        }
    }, [session]);

    return (
        <div className="p-4 space-y-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Enigma Ops</h1>
                    <p className="text-sm text-white/40">
                        {employee?.name ? `Hola, ${employee.name}` : 'Centro de Operaciones'}
                    </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-enigma-green/20 border border-enigma-green flex items-center justify-center">
                    <span className="text-sm font-mono text-enigma-green">✓</span>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* LIVE CASH BALANCE CARD */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {auditData && (
                <div className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-enigma-gray to-enigma-gray border border-emerald-500/20 overflow-hidden">
                    {/* Main Balance */}
                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-1">
                            <Wallet className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-white/50 uppercase tracking-wider font-medium">Efectivo en Caja</span>
                        </div>
                        <p className="text-4xl font-bold font-mono text-white tracking-tight">
                            ${auditData.expectedCash.toFixed(2)}
                        </p>
                    </div>

                    {/* Breakdown Row */}
                    <div className="grid grid-cols-3 border-t border-white/5">
                        <div className="p-3 text-center border-r border-white/5">
                            <p className="text-xs text-white/40">Fondo</p>
                            <p className="font-mono text-sm text-white/70">${auditData.startingCash.toFixed(2)}</p>
                        </div>
                        <div className="p-3 text-center border-r border-white/5">
                            <p className="text-xs text-white/40">Ventas</p>
                            <p className="font-mono text-sm text-emerald-400">
                                +${(auditData.breakdown?.sales || Math.max(0, auditData.transactionsTotal)).toFixed(2)}
                            </p>
                        </div>
                        <div className="p-3 text-center">
                            <p className="text-xs text-white/40">Salidas</p>
                            <p className="font-mono text-sm text-red-400">
                                ${((auditData.breakdown?.expenses || 0) + (auditData.breakdown?.purchases || 0)).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Transactions Counter */}
                    <div className="px-5 py-2 bg-white/3 flex items-center justify-between">
                        <span className="text-xs text-white/30">{auditData.transactionCount} movimientos esta sesión</span>
                        <Link to="/cash-movements" className="text-xs text-emerald-400 hover:text-emerald-300">
                            Ver detalle →
                        </Link>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <Link to="/suppliers" className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all">
                    <p className="text-2xl font-bold text-emerald-400">{stats.suppliers}</p>
                    <p className="text-xs text-white/50">Proveedores</p>
                </Link>
                <Link to="/inventory" className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all">
                    <p className="text-2xl font-bold text-blue-400">{stats.items}</p>
                    <p className="text-xs text-white/50">Ingredientes</p>
                </Link>
                <Link to="/purchases" className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                    <p className="text-2xl font-bold text-purple-400">{stats.recentPurchases}</p>
                    <p className="text-xs text-white/50">Compras</p>
                </Link>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* EDUCATIONAL GUIDE */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 
                    border border-blue-500/20 hover:border-blue-500/40 transition-all"
            >
                <BookOpen className="w-5 h-5 text-blue-400" />
                <span className="flex-1 text-left text-sm font-medium text-blue-300">¿Cómo funciona la caja?</span>
                {showGuide ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </button>

            {showGuide && (
                <div className="rounded-2xl bg-enigma-gray/70 border border-white/5 p-5 space-y-4 animate-fade-in">
                    <div className="space-y-3">
                        <GuideItem
                            emoji="🔓"
                            title="Apertura de Caja"
                            desc="Al iniciar turno, ingresa el efectivo físico que hay en caja. Este es tu punto de partida."
                        />
                        <GuideItem
                            emoji="💵"
                            title="Registrar Ventas"
                            desc="Cada venta en EFECTIVO se registra aquí. Elige el monto, selecciona 'Efectivo', y se suma a la caja automáticamente. Ventas con tarjeta o transferencia NO afectan el efectivo."
                        />
                        <GuideItem
                            emoji="🛒"
                            title="Compras a Proveedores"
                            desc="Cuando registras una compra pagada en EFECTIVO, el monto se DESCUENTA automáticamente de la caja. No tienes que hacer nada manual."
                        />
                        <GuideItem
                            emoji="📤"
                            title="Gastos y Salidas"
                            desc="Usa 'Movimientos' para registrar cualquier salida de efectivo: hielo, taxi, reparaciones, propinas, etc."
                        />
                        <GuideItem
                            emoji="🔒"
                            title="Cierre Ciego"
                            desc="Al cerrar, PRIMERO cuentas el dinero físico SIN ver el sistema. Luego el sistema te muestra cuánto debería haber. La diferencia revela sobrantes o faltantes."
                        />
                        <GuideItem
                            emoji="✅"
                            title="Tip: Diferencia $0"
                            desc="Si tu conteo coincide con el sistema, la caja cuadra perfecto. Si hay diferencia, anota la razón en las notas de cierre para revisión del administrador."
                        />
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-3">
                <h2 className="text-sm font-medium text-white/50">Acciones Rápidas</h2>

                <Link
                    to="/manual-sale"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-green-500/5 
                        border border-emerald-500/30 hover:border-emerald-500/50 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Registrar Venta</p>
                        <p className="text-sm text-white/40">Ingreso manual de ventas</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                    to="/cash-movements"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/5 
                        border border-emerald-500/30 hover:border-emerald-500/50 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                        <ArrowLeftRight className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Movimientos de Caja</p>
                        <p className="text-sm text-white/40">Gastos, retiros e ingresos</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                    to="/purchases"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-enigma-purple/20 to-enigma-purple/5 
                        border border-enigma-purple/30 hover:border-enigma-purple/50 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-enigma-purple/20 flex items-center justify-center">
                        <ShoppingCart className="w-7 h-7 text-enigma-purple" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Nueva Compra</p>
                        <p className="text-sm text-white/40">Registrar factura de proveedor</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-enigma-purple group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                    to="/smart-shopper"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/5 
                        border border-amber-500/30 hover:border-amber-500/50 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Smart Shopper</p>
                        <p className="text-sm text-white/40">Optimiza tus compras con IA</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                    to="/inventory"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-blue-500/5 
                        border border-blue-500/20 hover:border-blue-500/40 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                        <Package className="w-7 h-7 text-blue-500" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Inventario</p>
                        <p className="text-sm text-white/40">Ver y gestionar ingredientes</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </Link>

                <Link
                    to="/suppliers"
                    className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 
                        border border-emerald-500/20 hover:border-emerald-500/40 transition-all group"
                >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Proveedores</p>
                        <p className="text-sm text-white/40">Directorio de proveedores</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </Link>
            </div>

            {/* Recent Purchases */}
            {recentOrders.length > 0 && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-medium text-white/50">Compras Recientes</h2>
                        <Link to="/purchases" className="text-xs text-enigma-purple">Ver todas →</Link>
                    </div>
                    <div className="space-y-2">
                        {recentOrders.map(order => (
                            <div key={order.id} className="flex items-center gap-3 p-3 bg-enigma-gray/30 rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-enigma-purple/10 flex items-center justify-center">
                                    <ShoppingCart className="w-5 h-5 text-enigma-purple" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate text-sm">
                                        {order.supplier?.name || 'Proveedor'}
                                    </p>
                                    <p className="text-xs text-white/40">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="font-mono text-enigma-green text-sm">
                                    ${order.totalAmount?.toFixed(2) || '0.00'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Data Flow Info */}
            <div className="p-4 rounded-2xl bg-enigma-gray/50 border border-white/5 space-y-3">
                <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Flujo de Datos
                </h3>
                <div className="text-xs text-white/40 space-y-1">
                    <p>💰 Ventas manuales → Suman al efectivo en caja</p>
                    <p>🛒 Compras efectivo → Restan del efectivo automáticamente</p>
                    <p>📤 Gastos → Restan del efectivo</p>
                    <p>🔒 Cierre ciego → Reconciliación con conteo físico</p>
                </div>
            </div>

            {/* Version */}
            <div className="text-center text-xs text-white/20 pt-4">
                Enigma Ops v3.1 • Caja, Compras e Inventario
            </div>
        </div>
    );
}

// Educational Guide Item
function GuideItem({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
    return (
        <div className="flex gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">{emoji}</span>
            <div>
                <p className="text-sm font-medium text-white/80">{title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
