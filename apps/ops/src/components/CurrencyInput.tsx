import { useState, useEffect } from 'react';
import { Currency } from '../hooks/useCurrencies';

export interface CurrencyValue {
    currency: string;
    amountLocal: number;    // amount in selected currency
    amountUSD: number;      // USD equivalent
    exchangeRate: number;   // rate used
}

interface Props {
    currencies: Currency[];
    allowedCodes?: string[];     // restrict which currencies can be picked
    defaultCurrency?: string;
    placeholder?: string;
    label?: string;
    value?: number | '';         // controlled USD value (optional)
    onChange: (val: CurrencyValue) => void;
    className?: string;
}

export default function CurrencyInput({
    currencies,
    allowedCodes,
    defaultCurrency = 'USD',
    placeholder = '0.00',
    label,
    onChange,
    className = ''
}: Props) {
    const available = allowedCodes
        ? currencies.filter(c => allowedCodes.includes(c.code))
        : currencies;

    const [selectedCode, setSelectedCode] = useState(defaultCurrency);
    const [rawInput, setRawInput] = useState('');

    // If defaultCurrency changes (e.g. on tab switch), update selected
    useEffect(() => {
        setSelectedCode(defaultCurrency);
        setRawInput('');
    }, [defaultCurrency]);

    const selected = available.find(c => c.code === selectedCode) || available[0];

    const handleAmountChange = (val: string) => {
        setRawInput(val);
        const amountLocal = parseFloat(val) || 0;
        const rate = selected?.exchangeRate || 1;
        const amountUSD = selected?.isBase ? amountLocal : amountLocal / rate;
        onChange({
            currency: selectedCode,
            amountLocal,
            amountUSD,
            exchangeRate: rate
        });
    };

    const handleCurrencyChange = (code: string) => {
        setSelectedCode(code);
        setRawInput('');
        onChange({ currency: code, amountLocal: 0, amountUSD: 0, exchangeRate: currencies.find(c => c.code === code)?.exchangeRate || 1 });
    };

    const amountLocal = parseFloat(rawInput) || 0;
    const rate = selected?.exchangeRate || 1;
    const amountUSD = selected?.isBase ? amountLocal : amountLocal / rate;

    return (
        <div className={`space-y-1 ${className}`}>
            {label && <label className="text-xs text-white/50 block">{label}</label>}
            <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-white/10 focus-within:border-emerald-500/40 transition-colors">
                {/* Currency selector */}
                <select
                    value={selectedCode}
                    onChange={e => handleCurrencyChange(e.target.value)}
                    className="bg-white/5 text-white/80 text-sm font-mono px-3 py-3 cursor-pointer focus:outline-none border-r border-white/10"
                >
                    {available.map(c => (
                        <option key={c.code} value={c.code} className="bg-slate-900">
                            {c.code}
                        </option>
                    ))}
                </select>

                {/* Symbol prefix */}
                <span className="flex items-center px-2 bg-white/5 text-white/40 text-sm font-mono border-r border-white/10">
                    {selected?.symbol || '$'}
                </span>

                {/* Amount input */}
                <input
                    type="number"
                    inputMode="decimal"
                    placeholder={placeholder}
                    value={rawInput}
                    onChange={e => handleAmountChange(e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm font-mono px-3 py-3 focus:outline-none placeholder:text-white/20"
                />
            </div>

            {/* USD preview (only if not USD) */}
            {!selected?.isBase && amountLocal > 0 && (
                <p className="text-xs text-white/30 font-mono pl-1">
                    = ${amountUSD.toFixed(2)} USD
                    <span className="ml-2 text-white/20">
                        (tasa: {rate.toLocaleString()} {selected?.symbol || ''}/$1)
                    </span>
                </p>
            )}
        </div>
    );
}
