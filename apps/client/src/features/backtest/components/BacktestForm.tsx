'use client';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/** ---- helpers ---- */
const toLocalDatetimeValue = (d = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};
const MAX_SPAN_MS = 14 * 24 * 60 * 60 * 1000; // limit: 14 dni (na start)

/** ---- form schema ---- */
const FormZ = z.object({
    symbol: z.string().min(3, 'Wybierz rynek'),
    from: z.string().min(1, 'Podaj datę od'),
    to: z.string().min(1, 'Podaj datę do'),
    strategy: z.string().min(2),
    initialBalance: z.coerce.number().positive(),
}).superRefine((val, ctx) => {
    const from = new Date(val.from);
    const to = new Date(val.to);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return;

    if (to.getTime() > Date.now()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data „do” nie może być w przyszłości.', path: ['to'] });
    }
    if (to.getTime() <= from.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Zakres dat jest niepoprawny.', path: ['to'] });
    }
    if (to.getTime() - from.getTime() > MAX_SPAN_MS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Maksymalny zakres to 14 dni.', path: ['to'] });
    }
});
type FormData = z.infer<typeof FormZ>;

/** ---- tabs ---- */
const tabs = [
    { label: 'Wykres', key: 'chart' },
    { label: 'Pozycje', key: 'trades' },
    { label: 'Metryki', key: 'metrics' },
    { label: 'Logi', key: 'logs' },
];

/** ---- mock data ---- */
type MockResult = {
    pnl: number; winrate: number; tradesCount: number; profitFactor: number;
    trades: { tIn: string; side: 'Long' | 'Short'; result: 'Wygrana' | 'Przegrana'; pnl: number }[];
    logs: string[];
};
const mock: MockResult = {
    pnl: 1235, winrate: 55.5, tradesCount: 45, profitFactor: 1.85,
    trades: [
        { tIn: '2024-03-21 10:05', side: 'Long', result: 'Wygrana', pnl: 130 },
        { tIn: '2024-03-19 14:15', side: 'Short', result: 'Przegrana', pnl: -35 },
        { tIn: '2024-03-18 09:40', side: 'Long', result: 'Wygrana', pnl: 95 },
        { tIn: '2024-03-17 19:22', side: 'Short', result: 'Wygrana', pnl: 52 },
        { tIn: '2024-03-15 12:31', side: 'Long', result: 'Przegrana', pnl: -21 },
        { tIn: '2024-03-14 08:11', side: 'Short', result: 'Wygrana', pnl: 76 },
    ],
    logs: ['[10:05] Open LONG BTC/USDT @ 65210', '[11:12] TP hit @ 65980 (+1.18%)']
};

/** ---- searchable market select (mini) ---- */
const marketsMock = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT', 'DOGE/USDT',
    'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LTC/USDT', 'LINK/USDT'
];
function SearchableMarketSelect({
    value, onChange, options
}: { value: string; onChange: (v: string) => void; options: string[] }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const list = useMemo(
        () => options.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 50),
        [q, options]
    );
    return (
        <div className="dropdown w-full">
            <button
                type="button"
                className="btn w-full justify-between"
                onClick={() => setOpen(v => !v)}
            >
                {value || 'Wybierz rynek'}
                <span className="opacity-60">⌄</span>
            </button>
            {open && (
                <div tabIndex={0} className="dropdown-content z-10 mt-2 w-full bg-base-300 rounded-xl p-3 shadow">
                    <div className="mb-2 w-full">
                        <label className="input input-bordered flex items-center gap-2">
                            <input
                                type="text" className="grow" placeholder="Szukaj rynku…"
                                value={q} onChange={e => setQ(e.target.value)}
                            />
                        </label>
                    </div>
                    <ul className="menu bg-base-200 rounded-box max-h-64 overflow-auto w-full">
                        {list.map(opt => (
                            <li key={opt}>
                                <button type="button" onClick={() => { onChange(opt); setOpen(false); }}>
                                    {opt}
                                </button>
                            </li>
                        ))}
                        {list.length === 0 && <li className="opacity-60 p-2">Brak wyników</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** ---- main form ---- */
export function BacktestForm() {
    const [activeTab, setActiveTab] = useState<'chart' | 'trades' | 'metrics' | 'logs'>('chart');
    const [result, setResult] = useState<MockResult | null>(mock);

    const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } =
        useForm<FormData>({
            // resolver: zodResolver(FormZ),
            defaultValues: {
                symbol: 'BTC/USDT',
                from: '',
                to: '',
                strategy: 'reversal',
                initialBalance: 1000,
            }
        });

    const initialBalance = watch('initialBalance');
    const nowLocal = toLocalDatetimeValue();

    const onSubmit = async (data: FormData) => {
        console.log('Backtest submit', data);
        setActiveTab('metrics');
    };

    // wygrane/przegrane do metryk
    const winLoss = useMemo(() => {
        const wins = result?.trades.filter(t => t.pnl > 0).length ?? 0;
        const losses = (result?.trades.length ?? 0) - wins;
        return { wins, losses };
    }, [result]);

    return (
        <form>
            <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* 1/4 – konfiguracja */}
                <aside className="md:col-span-1 bg-base-200 rounded-xl p-4 space-y-4">
                    <h2 className="text-2xl font-semibold">Konfiguracja testu</h2>

                    <div className="form-control">
                        <span className="label-text mb-1">Rynek</span>
                        {/* hidden input spięty z RHF */}
                        <input type="hidden" {...register('symbol')} />
                        <SearchableMarketSelect
                            value={watch('symbol')}
                            options={marketsMock} // TODO: zastąp listą z backendu
                            onChange={(v) => setValue('symbol', v, { shouldValidate: true })}
                        />
                        {errors.symbol && <span className="text-error text-sm mt-1">{errors.symbol.message}</span>}
                    </div>

                    <label className="form-control">
                        <span className="label-text">Zakres dat – od</span>
                        <input type="datetime-local" {...register('from')} className="input input-bordered" max={nowLocal} />
                        {errors.from && <span className="text-error text-sm">{errors.from.message}</span>}
                    </label>

                    <label className="form-control">
                        <span className="label-text">Zakres dat – do</span>
                        <input type="datetime-local" {...register('to')} className="input input-bordered" max={nowLocal} />
                        {errors.to && <span className="text-error text-sm">{errors.to.message}</span>}
                    </label>

                    <label className="form-control">
                        <span className="label-text">Strategia</span>
                        <select {...register('strategy')} className="select select-bordered">
                            <option value="reversal">Reversal</option>
                            <option value="trend">Trend Following</option>
                            <option value="ema4x16">EMA(4/16) + MACD + ADX</option>
                            <option value="ichimoku">Ichimoku</option>
                        </select>
                    </label>

                    <div className="form-control">
                        <span className="label-text">Saldo początkowe</span>
                        <label className="input input-bordered flex items-center gap-2">
                            <input type="number" step="0.01" className="grow"
                                {...register('initialBalance')} />
                            <span className="opacity-70">USDT</span>
                        </label>
                        {errors.initialBalance && <span className="text-error text-sm">{errors.initialBalance.message}</span>}
                    </div>
                </aside>

                {/* 3/4 – wyniki + taby */}
                <section className="md:col-span-3">
                    <div className="flex gap-2 items-center mb-3">
                        <h2 className="text-2xl">Wyniki backtestu</h2>
                        <button type="submit" className={`btn btn-success ml-auto ${isSubmitting ? 'btn-disabled' : ''}`}>
                            {isSubmitting ? 'Uruchamiam…' : 'Uruchom test'}
                        </button>
                    </div>

                    <div role="tablist" className="tabs tabs-bordered mb-3">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                role="tab"
                                type="button"
                                onClick={() => setActiveTab(t.key as any)}
                                className={`tab ${activeTab === t.key ? 'tab-active' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-base-200 rounded-xl p-4">
                        {/* Wykres (placeholder) + metryki + skrócona lista 5 pozycji */}
                        {activeTab === 'chart' && (
                            <div className="space-y-4">
                                <div className="h-64 w-full rounded-lg skeleton" />
                                <div className="stats shadow">
                                    <div className="stat">
                                        <div className="stat-title">PnL (USDT)</div>
                                        <div className="stat-value">{result ? `+${result.pnl}` : '-'}</div>
                                    </div>
                                    <div className="stat">
                                        <div className="stat-title">Winrate</div>
                                        <div className="stat-value">{result ? `${result.winrate}%` : '-'}</div>
                                    </div>
                                    <div className="stat">
                                        <div className="stat-title">PF</div>
                                        <div className="stat-value">{result ? result.profitFactor : '-'}</div>
                                    </div>
                                    <div className="stat">
                                        <div className="stat-title">Transakcje</div>
                                        <div className="stat-value">{result ? result.tradesCount : '-'}</div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">Ostatnie transakcje</h3>
                                    <div className="overflow-x-auto">
                                        <table className="table">
                                            <thead><tr><th>Wejście</th><th>Typ</th><th>Wynik</th><th>PnL</th></tr></thead>
                                            <tbody>
                                                {result?.trades.slice(0, 4).map((t, i) => (
                                                    <tr key={i}>
                                                        <td>{t.tIn}</td>
                                                        <td>{t.side}</td>
                                                        <td className={t.result === 'Wygrana' ? 'text-success' : 'text-error'}>{t.result}</td>
                                                        <td className={t.pnl >= 0 ? 'text-success' : 'text-error'}>{t.pnl >= 0 ? `+${t.pnl}` : t.pnl}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pozycje */}
                        {activeTab === 'trades' && (
                            <div className="overflow-x-auto">
                                <table className="table">
                                    <thead>
                                        <tr><th>Wejście</th><th>Typ</th><th>Wynik</th><th>PnL (USDT)</th></tr>
                                    </thead>
                                    <tbody>
                                        {result?.trades.map((t, i) => (
                                            <tr key={i}>
                                                <td>{t.tIn}</td>
                                                <td>{t.side}</td>
                                                <td className={t.result === 'Wygrana' ? 'text-success' : 'text-error'}>{t.result}</td>
                                                <td className={t.pnl >= 0 ? 'text-success' : 'text-error'}>
                                                    {t.pnl >= 0 ? `+${t.pnl}` : t.pnl}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Metryki */}
                        {activeTab === 'metrics' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">Start balance</div>
                                    <div className="stat-value">{initialBalance} USDT</div>
                                </div>
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">PnL</div>
                                    <div className="stat-value">{result ? `+${result.pnl}` : '-'}</div>
                                </div>
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">Winrate</div>
                                    <div className="stat-value">{result ? `${result.winrate}%` : '-'}</div>
                                </div>
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">Profit Factor</div>
                                    <div className="stat-value">{result ? result.profitFactor : '-'}</div>
                                </div>
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">Liczba transakcji</div>
                                    <div className="stat-value">{result ? result.tradesCount : '-'}</div>
                                </div>
                                <div className="stat bg-base-100 rounded-xl">
                                    <div className="stat-title">Wygrane / Przegrane</div>
                                    <div className="stat-value">{winLoss.wins} / {winLoss.losses}</div>
                                </div>
                            </div>
                        )}

                        {/* Logi */}
                        {activeTab === 'logs' && (
                            <pre className="mockup-code whitespace-pre-wrap px-4">
                                {result?.logs.join('\n') ?? '—'}
                            </pre>
                        )}
                    </div>
                </section>
            </div>
        </form>
    );
}
