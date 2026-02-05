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
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No products found. Import a CSV to get started.
                        </TableCell>
                    </TableRow>
                )}
                {products.map((product) => (
                    <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => window.location.href = `/products/${product.id}`} // Quick hack, should use useNavigate but it's a component
                    >
                        <TableCell className="font-mono text-xs text-muted-foreground">{product.loyverse_id}</TableCell>
                        <TableCell className="font-medium">
                            {product.name}
                        </TableCell>
                        <TableCell>{product.category_id}</TableCell>
                        <TableCell>${product.price.toFixed(2)}</TableCell>
                        <TableCell>
                            <Badge variant={product.is_active ? "default" : "secondary"}>
                                {product.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
