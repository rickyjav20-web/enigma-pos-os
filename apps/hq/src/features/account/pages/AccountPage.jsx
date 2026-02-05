import React, { useState } from 'react';
import TenantCard from '../components/TenantCard';
import UsageStats from '../components/UsageStats';
import { ChevronDown, Globe } from 'lucide-react';

export default function AccountPage() {
    const [mockTenant, setMockTenant] = useState("enigma_hq");

    return (
        <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Organization</h1>
                    <p className="text-enigma-text-secondary">Manage your workspace identity and resources.</p>
                </div>

                {/* Quick Switch Mock */}
                <div className="glass-panel p-1 rounded-xl flex items-center gap-2 pr-4 relative group">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-white/50" />
                    </div>
                    <div className="text-xs">
                        <p className="text-white/30 uppercase font-bold tracking-wider mb-0.5">Viewing As</p>
                        <p className="text-white font-mono">{mockTenant}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-white/30 ml-2 group-hover:text-white transition-colors" />

                    {/* Mock Dropdown (Invisible interactive layer for demo) */}
                    <select
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={mockTenant}
                        onChange={(e) => setMockTenant(e.target.value)}
                    >
                        <option value="enigma_hq">enigma_hq (Default)</option>
                        <option value="burger_king_ccs">burger_king_ccs (Demo)</option>
                        <option value="starbucks_vzla">starbucks_vzla (Demo)</option>
                    </select>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Identity */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 pl-1">Identity Provider</h3>
                        <TenantCard tenantId={mockTenant} />
                    </section>

                    <section>
                        <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4 pl-1">Resource Usage</h3>
                        <UsageStats />
                    </section>
                </div>

                {/* Right Column: Settings */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-2 pl-1">Configuration</h3>
                    <div className="glass-panel rounded-2xl p-6 space-y-6">
                        <div className="space-y-4">
                            <SettingToggle label="Public API Access" enabled={true} />
                            <SettingToggle label="Beta Features" enabled={false} />
                            <SettingToggle label="Allow External Guests" enabled={true} />
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-white transition-colors">
                                Advanced Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SettingToggle({ label, enabled }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-white/80">{label}</span>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${enabled ? 'bg-enigma-purple' : 'bg-white/10'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
        </div>
    )
}
