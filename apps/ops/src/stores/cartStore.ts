import { create } from 'zustand';

const genLineId = () => Math.random().toString(36).slice(2, 10);

interface CartItem {
    lineId: string;
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
    removeItem: (lineId: string) => void;
    updateQuantity: (lineId: string, quantity: number) => void;
    updateItemNotes: (lineId: string, notes: string) => void;
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
        set((state) => ({
            items: [...state.items, {
                lineId: genLineId(),
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                category: product.category,
            }],
        }));
    },

    removeItem: (lineId) => {
        set((state) => ({
            items: state.items.filter(i => i.lineId !== lineId),
        }));
    },

    updateQuantity: (lineId, quantity) => {
        set((state) => {
            if (quantity <= 0) {
                return { items: state.items.filter(i => i.lineId !== lineId) };
            }
            return {
                items: state.items.map(i =>
                    i.lineId === lineId ? { ...i, quantity } : i
                ),
            };
        });
    },

    updateItemNotes: (lineId, notes) => {
        set((state) => ({
            items: state.items.map(i =>
                i.lineId === lineId ? { ...i, notes: notes || undefined } : i
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

    loadTicket: (ticket) => {
        // Expand items with qty > 1 into individual lines
        const expanded: CartItem[] = [];
        for (const item of ticket.items) {
            const qty = item.quantity || 1;
            for (let n = 0; n < qty; n++) {
                expanded.push({
                    ...item,
                    lineId: item.lineId || genLineId(),
                    quantity: 1,
                });
            }
        }
        set({
            ticketId: ticket.id,
            ticketName: ticket.name,
            items: expanded,
            tableId: ticket.tableId || null,
            tableName: ticket.tableName || null,
            guestCount: ticket.guestCount || null,
        });
    },
}));
