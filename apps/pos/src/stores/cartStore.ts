import { create } from 'zustand';

export interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    modifiers?: string[];
    notes?: string;
}

interface CartStore {
    items: CartItem[];
    orderType: 'dine_in' | 'takeaway';
    customerId: string | null;

    // Actions
    addItem: (product: { id: string; name: string; price: number; category?: string }) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, delta: number) => void;
    setOrderType: (type: 'dine_in' | 'takeaway') => void;
    setCustomerId: (id: string | null) => void;
    clearCart: () => void;

    // Computed
    total: () => number;
    itemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    orderType: 'dine_in',
    customerId: null,

    addItem: (product) => {
        set((state) => {
            const existing = state.items.find(i => i.productId === product.id);
            if (existing) {
                return {
                    items: state.items.map(i =>
                        i.productId === product.id
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    )
                };
            }
            return {
                items: [...state.items, {
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                    category: product.category,
                }]
            };
        });
    },

    removeItem: (productId) => {
        set((state) => ({
            items: state.items.filter(i => i.productId !== productId)
        }));
    },

    updateQuantity: (productId, delta) => {
        set((state) => ({
            items: state.items
                .map(i => i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
                .filter(i => i.quantity > 0)
        }));
    },

    setOrderType: (type) => set({ orderType: type }),
    setCustomerId: (id) => set({ customerId: id }),
    clearCart: () => set({ items: [], customerId: null }),

    total: () => get().items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
