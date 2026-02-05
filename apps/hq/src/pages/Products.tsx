import { useQuery } from '@tanstack/react-query';
import { api, CURRENT_TENANT_ID } from '@/lib/api';
import type { Product } from '@enigma/types';
import { ProductTable } from '@/features/products/ProductTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ProductsPage() {
    const { data, isLoading } = useQuery({
        queryKey: ['products', CURRENT_TENANT_ID],
        queryFn: async () => {
            // Fetch Products from API with typed response
            const response = await api.get<{ data: Product[] }>(`/products?tenant_id=${CURRENT_TENANT_ID}`);
            return response.data.data;
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Products</h2>
                    <p className="text-muted-foreground">Manage the master catalog synced from Loyverse.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Import CSV
                </Button>
            </div>

            <div className="border rounded-md bg-white dark:bg-slate-900 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading catalog...</div>
                ) : (
                    <ProductTable products={data || []} />
                )}
            </div>
        </div>
    );
}
