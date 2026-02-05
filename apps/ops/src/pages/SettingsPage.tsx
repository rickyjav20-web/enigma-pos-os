import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen p-4 space-y-4 animate-fade-in">
            <header className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="p-2">
                    <ArrowLeft className="w-6 h-6 text-white/70" />
                </button>
                <h1 className="text-xl font-bold">Ajustes</h1>
            </header>

            <div className="space-y-4">
                <SettingItem label="Versión" value="2.0.0" />
                <SettingItem label="Tenant" value="enigma_hq" />
                <SettingItem label="API URL" value="localhost:4000" />
            </div>
        </div>
    );
}

function SettingItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 rounded-xl bg-enigma-gray/50 border border-white/5 flex justify-between items-center">
            <span className="text-white/70">{label}</span>
            <span className="text-white font-mono text-sm">{value}</span>
        </div>
    );
}
