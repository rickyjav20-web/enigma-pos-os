import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Printer, Monitor, Receipt, Globe,
    ChevronRight, LogOut, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ─── Language options ──────────────────────────────────────────────────── */

const LANGUAGES = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' },
] as const;

function getStoredLang(): string {
    return localStorage.getItem('wave_pos_lang') || 'es';
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function SettingsPage() {
    const navigate = useNavigate();
    const { employee, logout } = useAuth();
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [currentLang, setCurrentLang] = useState(getStoredLang);

    const handleLangChange = (code: string) => {
        setCurrentLang(code);
        localStorage.setItem('wave_pos_lang', code);
        setShowLangPicker(false);
    };

    const selectedLang = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    // ─── Settings sections ─────────────────────────────────────────────
    const sections = [
        {
            title: 'HARDWARE',
            items: [
                { label: 'Printers', icon: Printer, description: 'Receipt & kitchen printers', disabled: true },
                { label: 'Customer displays', icon: Monitor, description: 'External display setup', disabled: true },
            ],
        },
        {
            title: 'STORE',
            items: [
                { label: 'Taxes', icon: Receipt, description: 'Tax rates & rules', disabled: true },
                {
                    label: 'Language',
                    icon: Globe,
                    description: selectedLang.label,
                    action: () => setShowLangPicker(true),
                },
            ],
        },
    ];

    // ─── Language Picker ───────────────────────────────────────────────
    if (showLangPicker) {
        return (
            <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
                <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                    style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                    <button onClick={() => setShowLangPicker(false)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                        <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                    </button>
                    <h1 className="text-lg font-semibold" style={{ color: '#F4F0EA' }}>Language</h1>
                </header>

                <div className="flex-1 overflow-y-auto py-2">
                    {LANGUAGES.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleLangChange(lang.code)}
                            className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:bg-white/5"
                            style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}
                        >
                            <span className="text-xl">{lang.flag}</span>
                            <span className="flex-1 text-sm font-medium" style={{ color: '#F4F0EA' }}>
                                {lang.label}
                            </span>
                            {currentLang === lang.code && (
                                <Check className="w-4.5 h-4.5" style={{ color: '#93B59D' }} />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ─── Main Settings View ────────────────────────────────────────────
    return (
        <div className="fixed inset-0 flex flex-col safe-top safe-bottom" style={{ background: '#121413' }}>
            {/* Header */}
            <header className="px-4 pt-3 pb-3 flex items-center gap-3 shrink-0"
                style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                <button onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                    <ArrowLeft className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                </button>
                <h1 className="text-lg font-semibold" style={{ color: '#F4F0EA' }}>Settings</h1>
            </header>

            <div className="flex-1 overflow-y-auto">
                {/* User / Account section */}
                <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(244,240,234,0.06)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(147,181,157,0.15)', border: '1px solid rgba(147,181,157,0.2)' }}>
                            <span className="text-sm font-bold" style={{ color: '#93B59D' }}>
                                {(employee?.fullName || 'S')[0].toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#F4F0EA' }}>
                                {employee?.fullName || 'Staff'}
                            </p>
                            <p className="text-xs" style={{ color: 'rgba(244,240,234,0.4)' }}>
                                {employee?.role || 'Employee'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Settings sections */}
                {sections.map((section) => (
                    <div key={section.title}>
                        <div className="px-5 pt-5 pb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest"
                                style={{ color: 'rgba(244,240,234,0.25)' }}>
                                {section.title}
                            </p>
                        </div>
                        {section.items.map((item) => {
                            const Icon = item.icon;
                            const disabled = 'disabled' in item && item.disabled;
                            return (
                                <button
                                    key={item.label}
                                    onClick={!disabled ? item.action : undefined}
                                    disabled={!!disabled}
                                    className="w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors active:bg-white/5 disabled:opacity-40"
                                    style={{ borderBottom: '1px solid rgba(244,240,234,0.04)' }}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: 'rgba(244,240,234,0.04)', border: '1px solid rgba(244,240,234,0.06)' }}>
                                        <Icon className="w-4 h-4" style={{ color: 'rgba(244,240,234,0.5)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium" style={{ color: '#F4F0EA' }}>
                                            {item.label}
                                        </p>
                                        {'description' in item && item.description && (
                                            <p className="text-xs mt-0.5" style={{ color: 'rgba(244,240,234,0.35)' }}>
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(244,240,234,0.15)' }} />
                                </button>
                            );
                        })}
                    </div>
                ))}

                {/* Logout section */}
                <div className="px-5 pt-8 pb-4">
                    <button
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                        style={{
                            background: 'rgba(239,68,68,0.06)',
                            border: '1px solid rgba(239,68,68,0.12)',
                            color: '#ef4444',
                        }}
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>

                {/* App version */}
                <div className="px-5 pb-8 text-center">
                    <p className="text-[10px]" style={{ color: 'rgba(244,240,234,0.15)' }}>
                        Wave POS v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
