import React from 'react';
import { Building2, CheckCircle2, Crown, ShieldCheck } from 'lucide-react';

export default function TenantCard({ tenantId = "enigma_hq", plan = "Enterprise", status = "active" }) {
    return (
        <div className="glass-card rounded-3xl p-8 relative overflow-hidden group">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-enigma-purple/10 blur-[80px] rounded-full pointer-events-none -z-10 group-hover:bg-enigma-purple/20 transition-colors duration-700" />

            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Enigma Cafe</h2>
                        <p className="text-sm text-enigma-text-secondary font-mono mt-1 flex items-center gap-2">
                            ID: <span className="text-white/70 bg-white/5 px-2 py-0.5 roundedElement">{tenantId}</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 rounded-full bg-enigma-green-glow/20 border border-enigma-green-glow text-enigma-green text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-enigma-green animate-pulse" />
                        {status}
                    </span>
                </div>
            </div>

            <div className="bg-enigma-void/40 rounded-2xl p-6 border border-white/5 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-1">Current Plan</p>
                    <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                        <span className="text-xl font-bold text-white">{plan}</span>
                    </div>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div>
                    <p className="text-xs uppercase text-enigma-text-muted font-bold tracking-widest mb-1">Security Level</p>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium text-white/80">SOC2 Compliant</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
