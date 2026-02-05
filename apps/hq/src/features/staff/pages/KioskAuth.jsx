// 🔒 PROTECTED FILE: DO NOT EDIT WITHOUT EXPLICIT USER APPROVAL
// Module: Staff Authentication
// Status: STABLE
import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import KioskLayout from '../layouts/KioskLayout';
import { useStore } from '../stores/kioskStore';
import { Smile, Meh, Frown, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const PIN_LENGTH = 4;

export default function KioskAuth() {
    const [pin, setPin] = useState('');
    const [view, setView] = useState('PIN'); // PIN | MOOD | SUCCESS | ERROR | SUCCESS_EXIT | CLOCK_OUT
    const [message, setMessage] = useState('');
    const [mood, setMood] = useState(null);

    const { verifyPin, clockIn, clockOut, employee, activeShift } = useStore();
    const webcamRef = useRef(null);
    const [comment, setComment] = useState('');

    const handleNumPad = (num) => {
        if (pin.length < PIN_LENGTH) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === PIN_LENGTH) {
                attemptLogin(newPin);
            }
        }
    };

    const handleClear = () => {
        setPin('');
        setMessage('');
        setView('PIN');
    };

    const attemptLogin = async (code) => {
        const success = await verifyPin(code);
        if (success) {
            // Check direct from store state to ensure fresh data
            const currentShift = useStore.getState().activeShift;
            if (currentShift) {
                setView('CLOCK_OUT');
            } else {
                setView('MOOD');
            }
            setPin('');
        } else {
            setPin('');
            setMessage('Código Incorrecto');
        }
    };

    const captureAndClockIn = useCallback(async () => {
        let imageSrc = null;
        if (webcamRef.current) {
            imageSrc = webcamRef.current.getScreenshot();
            console.log("📸 Photo Captured:", imageSrc ? "Yes (Base64)" : "No");
        } else {
            console.warn("📷 Camera not ready");
        }

        await clockIn(mood, imageSrc);
        setView('SUCCESS');

        setTimeout(() => {
            setView('PIN');
            setMood(null);
            setPin('');
        }, 3000);

    }, [webcamRef, mood, clockIn]);

    const handleClockOut = async (exitMood) => {
        await clockOut(exitMood, comment);
        setView('SUCCESS_EXIT');
        setTimeout(() => {
            setView('PIN');
            setMood(null);
            setComment('');
            setPin('');
        }, 3000);
    };

    const selectMood = (m) => {
        setMood(m);
        setTimeout(() => {
            captureAndClockIn();
        }, 200);
    };


    return (
        <KioskLayout>
            {view === 'PIN' && (
                <div className="animate-fade-in space-y-8">
                    {/* PIN Display */}
                    <div className="flex justify-center gap-4 mb-8">
                        {[...Array(PIN_LENGTH)].map((_, i) => (
                            <div
                                key={i}
                                className={clsx(
                                    "w-4 h-4 rounded-full transition-all duration-300",
                                    i < pin.length ? "bg-enigma-green scale-110 shadow-[0_0_10px_#10b981]" : "bg-white/10"
                                )}
                            />
                        ))}
                    </div>

                    {message && <p className="text-red-500 text-center -mt-6 animate-pulse">{message}</p>}

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                onClick={() => handleNumPad(num.toString())}
                                className="h-20 bg-enigma-gray/50 rounded-2xl text-2xl font-light hover:bg-enigma-gray hover:scale-105 transition-all text-white border border-white/5 active:scale-95"
                            >
                                {num}
                            </button>
                        ))}
                        <div />
                        <button
                            onClick={() => handleNumPad("0")}
                            className="h-20 bg-enigma-gray/50 rounded-2xl text-2xl font-light hover:bg-enigma-gray hover:scale-105 transition-all text-white border border-white/5 active:scale-95"
                        >
                            0
                        </button>
                        <button
                            onClick={handleClear}
                            className="h-20 bg-red-500/10 rounded-2xl text-lg hover:bg-red-500/20 text-red-400 transition-all flex items-center justify-center active:scale-95"
                        >
                            CLR
                        </button>
                    </div>
                </div>
            )}

            {view === 'MOOD' && (
                <div className="animate-fade-in text-center space-y-6">
                    <h2 className="text-2xl font-semibold text-white">Hola, <span className="text-enigma-purple">{employee?.fullName.split(' ')[0]}</span></h2>
                    <p className="text-white/50">¿Cómo te sientes hoy?</p>

                    <div className="flex gap-4 justify-center py-4">
                        <MoodBtn icon={Smile} color="text-green-400" bg="bg-green-400/10" onClick={() => selectMood('HAPPY')} label="Bien" />
                        <MoodBtn icon={Meh} color="text-yellow-400" bg="bg-yellow-400/10" onClick={() => selectMood('NEUTRAL')} label="Normal" />
                        <MoodBtn icon={Frown} color="text-red-400" bg="bg-red-400/10" onClick={() => selectMood('TIRED')} label="Cansado" />
                    </div>

                    {/* Hidden Camera Preview */}
                    <div className="opacity-0 absolute pointer-events-none">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            width={320}
                            height={240}
                        />
                    </div>
                </div>
            )}

            {view === 'CLOCK_OUT' && (
                <div className="animate-fade-in text-center space-y-6">
                    <h2 className="text-2xl font-semibold text-white">Adiós, <span className="text-enigma-purple">{employee?.fullName.split(' ')[0]}</span></h2>
                    <p className="text-white/50">¿Cómo estuvo tu turno?</p>

                    <input
                        type="text"
                        placeholder="Comentarios (Opcional)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full max-w-xs bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-enigma-purple text-center"
                    />

                    <div className="flex gap-4 justify-center py-4">
                        <MoodBtn icon={Smile} color="text-green-400" bg="bg-green-400/10" onClick={() => handleClockOut('HAPPY')} label="Excelente" />
                        <MoodBtn icon={Meh} color="text-yellow-400" bg="bg-yellow-400/10" onClick={() => handleClockOut('NEUTRAL')} label="Normal" />
                        <MoodBtn icon={Frown} color="text-red-400" bg="bg-red-400/10" onClick={() => handleClockOut('TIRED')} label="Pesado" />
                    </div>
                </div>
            )}

            {view === 'SUCCESS' && (
                <div className="animate-fade-in text-center space-y-6 pt-10">
                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">¡Bienvenido!</h2>
                    <p className="text-white/50">Tu turno ha comenzado.</p>
                </div>
            )}

            {view === 'SUCCESS_EXIT' && (
                <div className="animate-fade-in text-center space-y-6 pt-10">
                    <div className="w-24 h-24 bg-enigma-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-12 h-12 text-enigma-purple" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">¡Hasta Mañana!</h2>
                    <p className="text-white/50">Turno cerrado correctamente.</p>
                </div>
            )}
        </KioskLayout>
    );
}

function MoodBtn({ icon: Icon, color, bg, onClick, label }) {
    return (
        <button onClick={onClick} className={`flex flex-col items-center gap-2 p-6 rounded-2xl transition-all hover:scale-110 ${bg} border border-white/5 hover:border-white/20 active:scale-95 w-24`}>
            <Icon className={`w-10 h-10 ${color}`} />
            <span className="text-xs text-white/50">{label}</span>
        </button>
    )
}
