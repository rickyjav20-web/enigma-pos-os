import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChefHat, Save, Tag } from 'lucide-react';
// @ts-ignore
import { RecipeEditor } from '../components/RecipeEditor';

interface KitchenStation {
    id: string;
    name: string;
    color: string;
    isActive: boolean;
    productIds?: string[] | null;
}

interface ProductSummary {
    id: string;
    categoryId?: string | null;
}

interface ProductDetailsData {
    id: string;
    name: string;
    sku?: string | null;
    price: number;
    cost?: number | null;
    categoryId?: string | null;
    loyverseId?: string | null;
    kdsStation?: string | null;
}

export default function ProductDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: product, isLoading } = useQuery<ProductDetailsData>({
        queryKey: ['product', id],
        queryFn: async () => {
            const res = await api.get(`/products/${id}`);
            return res.data;
        },
        enabled: Boolean(id),
    });

    const { data: stations = [] } = useQuery<KitchenStation[]>({
        queryKey: ['product-kds-stations'],
        queryFn: async () => {
            const res = await api.get('/kitchen-stations');
            return (res.data?.data || []).filter((station: KitchenStation) => station.isActive);
        }
    });

    const { data: products = [] } = useQuery<ProductSummary[]>({
        queryKey: ['product-category-options'],
        queryFn: async () => {
            const res = await api.get('/products?limit=500');
            return res.data?.data || [];
        }
    });

    const [kdsStation, setKdsStation] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!product) return;
        setKdsStation(product.kdsStation || '');
        setCategoryId(product.categoryId || '');
    }, [product]);

    const categoryOptions = useMemo(() => {
        return [...new Set(products.map((item) => item.categoryId).filter(Boolean) as string[])].sort();
    }, [products]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!product) return;

            const normalizedCategory = categoryId.trim();
            const normalizedStation = kdsStation.trim();
            const stationUpdates = stations.map(async (station) => {
                const productIds = new Set((station.productIds as string[]) || []);
                const shouldContain = normalizedStation !== '' && station.name === normalizedStation;

                let changed = false;
                if (shouldContain && !productIds.has(product.id)) {
                    productIds.add(product.id);
                    changed = true;
                }
                if (!shouldContain && productIds.delete(product.id)) {
                    changed = true;
                }

                if (!changed) return;

                await api.put(`/kitchen-stations/${station.id}`, {
                    productIds: Array.from(productIds),
                });
            });

            await Promise.all(stationUpdates);
            await api.put(`/products/${product.id}`, {
                categoryId: normalizedCategory || null,
                kdsStation: normalizedStation || null,
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['product', id] }),
                queryClient.invalidateQueries({ queryKey: ['products'] }),
                queryClient.invalidateQueries({ queryKey: ['kds-products'] }),
                queryClient.invalidateQueries({ queryKey: ['kitchen-stations'] }),
                queryClient.invalidateQueries({ queryKey: ['product-kds-stations'] }),
                queryClient.invalidateQueries({ queryKey: ['product-category-options'] }),
            ]);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
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
                <div className="space-y-6">
                    <div className="p-6 border rounded-lg bg-card space-y-5">
                        <div>
                            <h3 className="font-semibold mb-1">Product Routing</h3>
                            <p className="text-xs text-muted-foreground">
                                Aqui controlas la categoria del menu y la estacion KDS que recibe este producto. Los dos POS siguen leyendo este mismo catalogo.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Tag className="w-4 h-4 text-muted-foreground" />
                                Categoria del Menu
                            </div>
                            <input
                                list="product-category-options"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                placeholder="Ej. Cafes, Postres, Brunch"
                                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                            />
                            {categoryOptions.length > 0 && (
                                <datalist id="product-category-options">
                                    {categoryOptions.map((category) => (
                                        <option key={category} value={category} />
                                    ))}
                                </datalist>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Esta categoria aparece en POS Mobile, POS OPS, goals, analytics y reglas KDS por categoria.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <ChefHat className="w-4 h-4 text-muted-foreground" />
                                <h3 className="font-semibold">KDS Station Routing</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                La asignacion manual por producto prevalece sobre la categoria cuando sincronizas estaciones.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {stations.map((station) => (
                                    <button
                                        key={station.id}
                                        onClick={() => setKdsStation(kdsStation === station.name ? '' : station.name)}
                                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                                            kdsStation === station.name
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                        }`}
                                    >
                                        {station.name}
                                    </button>
                                ))}
                            </div>
                            {!kdsStation && (
                                <p className="text-xs text-muted-foreground">
                                    Sin estacion asignada. Si lo dejas vacio, solo entrara al KDS cuando una estacion lo capture por categoria.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 border-t pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Categoria actual</span>
                                <span>{product.categoryId || 'Sin categoria'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Estacion actual</span>
                                <span>{product.kdsStation || 'Sin KDS manual'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Loyverse ID</span>
                                <span className="font-mono text-xs">{product.loyverseId || 'N/A'}</span>
                            </div>
                        </div>

                        <Button
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending}
                            size="sm"
                            className="w-full"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saved ? 'Guardado' : mutation.isPending ? 'Guardando...' : 'Guardar categoria y routing'}
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <RecipeEditor productId={product.id} initialCost={product.cost || 0} />
                </div>
            </div>
        </div>
    );
}
