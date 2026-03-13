import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

// ── Toast notification (replaces alert) ──────────────────────────────
export function Toast({ message, type = 'error', onClose }: {
    message: string;
    type?: 'error' | 'success' | 'info';
    onClose: () => void;
}) {
    useEffect(() => {
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [onClose]);

    const colors = {
        error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' },
        success: { bg: 'rgba(147,181,157,0.12)', border: 'rgba(147,181,157,0.2)', text: '#93B59D' },
        info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6' },
    };
    const c = colors[type];

    return (
        <div className="fixed top-4 left-4 right-4 z-[200] animate-slide-down"
            style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
            <p className="text-sm font-medium text-center" style={{ color: c.text }}>{message}</p>
        </div>
    );
}

// ── Confirm modal (replaces window.confirm) ──────────────────────────
export function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="fixed inset-0 bg-black/70" onClick={onCancel} />
            <div className="relative z-10 w-full max-w-[320px] rounded-2xl p-5"
                style={{ background: '#1a1d1b', border: '1px solid rgba(244,240,234,0.08)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
                    </div>
                    <h3 className="text-[15px] font-bold" style={{ color: '#F4F0EA' }}>{title}</h3>
                </div>
                <p className="text-sm mb-5 ml-[52px]" style={{ color: 'rgba(244,240,234,0.5)' }}>{message}</p>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium press"
                        style={{ background: 'rgba(244,240,234,0.06)', color: 'rgba(244,240,234,0.6)' }}>
                        Cancelar
                    </button>
                    <button onClick={onConfirm}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold press"
                        style={{
                            background: confirmColor || 'rgba(239,68,68,0.15)',
                            color: confirmColor ? '#F4F0EA' : '#ef4444',
                            border: `1px solid ${confirmColor || 'rgba(239,68,68,0.2)'}`,
                        }}>
                        {confirmLabel || 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
