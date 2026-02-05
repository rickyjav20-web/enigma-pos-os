import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import RecipeEditor from '../components/RecipeEditor';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export default function ProductDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProduct();
    }, [id]);

    const fetchProduct = async () => {
        try {
            const res = await axios.get(`${API_URL}/products/${id}?tenant_id=enigma_hq`);
            setProduct(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to fetch product", error);
            // navigate('/products'); // Redirect if fail?
        }
    };

    if (loading) return <div className="p-10 text-white">Loading Product...</div>;
    if (!product) return <div className="p-10 text-white text-red-500">Product not found.</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <button
                onClick={() => navigate('/products')}
                className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
            >
                ← Back to Menu
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* LEFT: Info */}
                <div>
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-6">
                        <h1 className="text-3xl font-bold text-white mb-2">{product.name}</h1>
                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                            {product.sku || 'No SKU'}
                        </span>

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="text-gray-500 text-sm">Price (Sale)</label>
                                <div className="text-2xl text-white font-mono">${product.price.toFixed(2)}</div>
                            </div>
                            <div>
                                <label className="text-gray-500 text-sm">Automated Cost</label>
                                <div className="text-2xl text-yellow-500 font-mono">${product.cost?.toFixed(2) || '0.00'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Recipe Engine */}
                <div>
                    <RecipeEditor product={product} onUpdate={fetchProduct} />
                </div>
            </div>
        </div>
    );
}
