import type { Product } from '@enigma/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`¿Dar de baja "${product.name}"? Esta acción la ocultará del catálogo.`)) return;
    try {
        await api.delete('/products/' + product.id);
        window.location.reload();
    } catch (err: any) {
        alert('Error al dar de baja: ' + (err.message || 'Error desconocido'));
    }
}

export function ProductTable({ products }: { products: Product[] }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Handle</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No products found. Import a CSV to get started.
                        </TableCell>
                    </TableRow>
                )}
                {products.map((product) => (
                    <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => window.location.href = `/products/${product.id}`} // Quick hack, should use useNavigate but it's a component
                    >
                        <TableCell className="font-mono text-xs text-muted-foreground">{product.loyverse_id}</TableCell>
                        <TableCell className="font-medium">
                            {product.name}
                        </TableCell>
                        <TableCell>{product.category_id}</TableCell>
                        <TableCell>${product.price.toFixed(2)}</TableCell>
                        <TableCell>
                            <Badge variant={product.is_active ? "default" : "destructive"}>
                                {product.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                                className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                title="Dar de baja"
                            >
                                <Trash2 size={15} />
                            </button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
