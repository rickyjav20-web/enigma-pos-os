import React from 'react';
import clsx from 'clsx';

export default function KioskLayout({ children }) {
    return (
        <div className="min-h-screen bg-enigma-black text-white flex flex-col items-center justify-center p-4 selection:bg-enigma-purple selection:text-white overflow-hidden relative">
            {/* Ambient Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-enigma-purple/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <header className="mb-8 text-center">
                    {/* Logo Placeholder */}
                    <div className="w-16 h-16 bg-gradient-to-tr from-enigma-purple to-enigma-green rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-bold shadow-lg shadow-enigma-purple/30">
                        E
                    </div>
                    <h1 className="text-xl font-medium tracking-widest text-white/80 uppercase">Enigma Staff</h1>
                </header>
                <main>
                    {children}
                </main>
            </div>

            <footer className="absolute bottom-4 text-xs text-white/20">
                Enigma OS v2.0 • System Online
            </footer>
        </div>
    );
}
