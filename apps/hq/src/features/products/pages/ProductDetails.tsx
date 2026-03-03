import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChefHat, Save } from 'lucide-react';
import { useState } from 'react';
// @ts-ignore
import { RecipeEditor } from '../components/RecipeEditor';

const KDS_STATIONS = ['Cocina', 'Bar', 'Postres', 'Parrilla', 'Frío', 'Bebidas'];

export default function ProductDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: product, isLoading } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            const res = await api.get(`/products/${id}`);
            return res.data;
        }
    });

    const [kdsStation, setKdsStation] = useState<string>('');
    const [stationSaved, setStationSaved] = useState(false);

    // Initialize kdsStation once product loads
    const [initialized, setInitialized] = useState(false);
    if (product && !initialized) {
        setKdsStation(product.kdsStation || '');
        setInitialized(true);
    }

    const mutation = useMutation({
        mutationFn: async (station: string) => {
            await api.put(`/products/${id}`, { kdsStation: station || null });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product', id] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setStationSaved(true);
            setTimeout(() => setStationSaved(false), 2000);
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
                {/* Left: Details + KDS Station */}
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

                    {/* KDS Station Routing */}
                    <div className="p-6 border rounded-lg bg-card">
                        <div className="flex items-center gap-2 mb-4">
                            <ChefHat className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold">KDS Station Routing</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                            Assign this item to a kitchen display station so it only appears where it should be prepared.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {KDS_STATIONS.map(station => (
                                <button
                                    key={station}
                                    onClick={() => setKdsStation(kdsStation === station ? '' : station)}
                                    className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                                        kdsStation === station
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                    }`}
                                >
                                    {station}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="text"
                                placeholder="Custom station name..."
                                value={kdsStation && !KDS_STATIONS.includes(kdsStation) ? kdsStation : ''}
                                onChange={e => setKdsStation(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-md text-sm border bg-background"
                            />
                        </div>
                        {!kdsStation && (
                            <p className="text-xs text-muted-foreground mb-3">
                                No station assigned — item appears on all KDS displays.
                            </p>
                        )}
                        <Button
                            onClick={() => mutation.mutate(kdsStation)}
                            disabled={mutation.isPending}
                            size="sm"
                            className="w-full"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {stationSaved ? '✓ Saved!' : mutation.isPending ? 'Saving...' : 'Save Station'}
                        </Button>
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
