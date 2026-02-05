import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
// @ts-ignore
import { RecipeEditor } from '../components/RecipeEditor';

export default function ProductDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: product, isLoading } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const res = await api.get(`/products/${id}`);
            return res.data;
        }
    });

    if (isLoading) return <div className="p-8">Loading Product...</div>;
    if (!product) return <div className="p-8">Product not found</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-6">
            <Button variant="ghost" onClick={() => navigate('/products')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold">{product.name}</h1>
                    <p className="text-muted-foreground font-mono">{product.sku}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Selling Price</p>
                    <p className="text-2xl font-bold">${product.price?.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Details */}
                <div className="space-y-6">
                    <div className="p-6 border rounded-lg bg-card">
                        <h3 className="font-semibold mb-4">Product Info</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category</span>
                                <span>{product.categoryId || 'Uncategorized'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Loyverse ID</span>
                                <span className="font-mono text-xs">{product.loyverseId}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Recipe Editor */}
                <div className="space-y-6">
                    <RecipeEditor productId={product.id} initialCost={product.cost} />
                </div>
            </div>
        </div>
    );
}
