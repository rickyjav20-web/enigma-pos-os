import { create } from 'zustand';

interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
    notes?: string;
}

interface CartStore {
    items: CartItem[];
    ticketId: string | null;
    ticketName: string;
    tableId: string | null;
    tableName: string | null;
    orderType: string;
    guestCount: number | null;
    addItem: (product: { id: string; name: string; price: number; category?: string }) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    updateItemNotes: (productId: string, notes: string) => void;
    clearCart: () => void;
    setTicketName: (name: string) => void;
    setTable: (id: string | null, name: string | null) => void;
    setOrderType: (type: string) => void;
    setGuestCount: (count: number | null) => void;
    total: () => number;
    itemCount: () => number;
    loadTicket: (ticket: { id: string; name: string; items: CartItem[]; tableId?: string; tableName?: string; guestCount?: number | null }) => void;
}

export const useCartStore = create<CartStore>((set, get) => ({
    items: [],
    ticketId: null,
    ticketName: 'Ticket',
    tableId: null,
    tableName: null,
    orderType: 'dine_in',
    guestCount: null,

    addItem: (product) => {
        set((state) => {
            const existing = state.items.find(i => i.productId === product.id);
            if (existing) {
                return {
                    items: state.items.map(i =>
                        i.productId === product.id
                            ? { ...i, quantity: i.quantity + 1 }
                            : i
                    ),
                };
            }
            return {
                items: [...state.items, {
                    productId: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: 1,
                    category: product.category,
                }],
            };
        });
    },

    removeItem: (productId) => {
        set((state) => ({
            items: state.items.filter(i => i.productId !== productId),
        }));
    },

    updateQuantity: (productId, quantity) => {
        set((state) => {
            if (quantity <= 0) {
                return { items: state.items.filter(i => i.productId !== productId) };
            }
            return {
                items: state.items.map(i =>
                    i.productId === productId ? { ...i, quantity } : i
                ),
            };
        });
    },

    updateItemNotes: (productId, notes) => {
        set((state) => ({
            items: state.items.map(i =>
                i.productId === productId ? { ...i, notes: notes || undefined } : i
            ),
        }));
    },

    clearCart: () => set({ items: [], ticketId: null, ticketName: 'Ticket', tableId: null, tableName: null, guestCount: null }),

    setTicketName: (name) => set({ ticketName: name }),

    setTable: (id, name) => set({ tableId: id, tableName: name }),

    setOrderType: (type) => set({ orderType: type }),

    setGuestCount: (count) => set({ guestCount: count }),

    total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

    itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

    loadTicket: (ticket) => set({
        ticketId: ticket.id,
        ticketName: ticket.name,
        items: ticket.items,
        tableId: ticket.tableId || null,
        tableName: ticket.tableName || null,
        guestCount: ticket.guestCount || null,
    }),
}));
