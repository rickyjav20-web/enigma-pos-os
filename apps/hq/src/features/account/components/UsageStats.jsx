import React from 'react';
import { Database, Activity, Users, HardDrive } from 'lucide-react';

export default function UsageStats() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <UsageItem
                icon={Activity}
                label="API Requests"
                value="1.2M"
                subtext="/ 5M Limit"
                color="text-blue-400"
                percent={24}
            />
            <UsageItem
                icon={Database}
                label="Database Storage"
                value="450MB"
                subtext="/ 1GB Limit"
                color="text-enigma-purple"
                percent={45}
            />
            <UsageItem
                icon={Users}
                label="Active Staff"
                value="12"
                subtext="/ 20 Seats"
                color="text-enigma-green"
                percent={60}
            />
        </div>
    );
}

function UsageItem({ icon: Icon, label, value, subtext, color, percent }) {
    return (
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between h-40 relative overflow-hidden group">
            <div className="flex justify-between items-start z-10">
                <div className={`p-2 rounded-lg bg-white/5 ${color} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
            </div>

            <div className="z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm text-enigma-text-secondary font-medium">{label}</span>
                    <span className="text-[10px] text-white/30">{subtext}</span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${color.replace('text-', 'bg-')} transition-all duration-1000 ease-out`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {/* Background Decor */}
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${color.replace('text-', 'bg-')} opacity-5 blur-[40px] rounded-full group-hover:opacity-10 transition-opacity`} />
        </div>
    );
}
