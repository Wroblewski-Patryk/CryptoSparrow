import { CloseProps, CloseConditions, Threshold } from "../../types/StrategyForm.type";

import { LuTrash2 } from "react-icons/lu";

export function Close({ data, setData }: CloseProps) {
    const close = data;

    // Helpery
    const setClose = (changes: Partial<CloseConditions>) =>
        setData(prev => ({ ...prev, ...changes }));


    const addThreshold = (type: "ttp" | "tsl") => {
        setClose({
            [type]: [
                ...(close[type] as Threshold[]),
                { percent: 0, arm: 0 }
            ],
        });
    };

    const removeThreshold = (type: "ttp" | "tsl", idx: number) => {
        setClose({
            [type]: (close[type] as Threshold[]).filter((_, i) => i !== idx),
        });
    };

    const updateThreshold = (
        type: "ttp" | "tsl",
        idx: number,
        field: "percent" | "arm",
        value: number
    ) => {
        setClose({
            [type]: (close[type] as Threshold[]).map((t, i) =>
                i === idx ? { ...t, [field]: value } : t
            ),
        });
    };

    return (
        <div className="space-y-8">
            {/* Radio: wybór trybu */}
            <div className="flex gap-8">
                <label className="cursor-pointer flex items-center gap-2">
                    <input
                        type="radio"
                        name="closeMode"
                        className="radio radio-primary"
                        checked={close.mode === "basic"}
                        onChange={() => setClose({ mode: "basic" })}
                    />
                    <span>Podstawowe (TP/SL)</span>
                </label>
                <label className="cursor-pointer flex items-center gap-2">
                    <input
                        type="radio"
                        name="closeMode"
                        className="radio radio-primary"
                        checked={close.mode === "advanced"}
                        onChange={() => setClose({ mode: "advanced" })}
                    />
                    <span>Zaawansowane (TTP/TSL)</span>
                </label>
            </div>

            {/* BASIC */}
            {close.mode === "basic" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h4 className="font-semibold mb-6 text-lg">Podstawowe ustawienia zamknięcia</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="form-control">
                                <label className="label">Take Profit (%)</label>
                                <input
                                    type="number"
                                    className="input input-bordered w-full"
                                    value={close.tp}
                                    onChange={e =>
                                        setClose({ tp: Number(e.target.value) })
                                    }
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">Stop Loss (%)</label>
                                <input
                                    type="number"
                                    className="input input-bordered w-full"
                                    value={close.sl}
                                    onChange={e =>
                                        setClose({ sl: Number(e.target.value) })
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADVANCED */}
            {close.mode === "advanced" && (
                <div className="card bg-base-200">
                    <div className="card-body">
                        <h4 className="font-semibold mb-6 text-lg">Zaawansowane ustawienia zamknięcia</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* TTP */}
                            <div>
                                <div className="font-semibold mb-2">Trailing Take Profit</div>
                                <div className="space-y-2">
                                    {close.ttp.map((t, idx) => (
                                        <div key={idx} className="flex gap-2 items-end">
                                            <div>
                                                <label className="label">Procent (%)</label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered"
                                                    value={t.percent}
                                                    onChange={e =>
                                                        updateThreshold("ttp", idx, "percent", Number(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Ramię</label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered"
                                                    value={t.arm}
                                                    onChange={e =>
                                                        updateThreshold("ttp", idx, "arm", Number(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                title="Usuń próg"
                                                onClick={() => removeThreshold("ttp", idx)}
                                            >
                                                <LuTrash2 />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline mt-2"
                                    onClick={() => addThreshold("ttp")}
                                >
                                    + Dodaj próg
                                </button>
                            </div>
                            {/* TSL */}
                            <div>
                                <div className="font-semibold mb-2">Trailing Stop Loss</div>
                                <div className="space-y-2">
                                    {close.tsl.map((t, idx) => (
                                        <div key={idx} className="flex gap-2 items-end">
                                            <div>
                                                <label className="label">Procent (%)</label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered"
                                                    value={t.percent}
                                                    onChange={e =>
                                                        updateThreshold("tsl", idx, "percent", Number(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Ramię</label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered"
                                                    value={t.arm}
                                                    onChange={e =>
                                                        updateThreshold("tsl", idx, "arm", Number(e.target.value))
                                                    }
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                title="Usuń próg"
                                                onClick={() => removeThreshold("tsl", idx)}
                                            >
                                                <LuTrash2 />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline mt-2"
                                    onClick={() => addThreshold("tsl")}
                                >
                                    + Dodaj próg
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
