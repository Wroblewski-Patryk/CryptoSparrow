import { LuTrash2 } from "react-icons/lu";
import { AdditionalProps, TimeUnit, DcaLevel } from "../../types/StrategyForm.type";

export function Additional({ data, setData }: AdditionalProps) {
    // helpery:
    const patch = (changes: Partial<typeof data>) =>
        setData(prev => ({ ...prev, ...changes }));

    const updateLevel = (idx: number, field: keyof DcaLevel, value: number) =>
        setData(prev => ({
            ...prev,
            dcaLevels: prev.dcaLevels.map((el, i) => (i === idx ? { ...el, [field]: value } : el)),
        }));

    const addLevel = () =>
        setData(prev => ({ ...prev, dcaLevels: [...prev.dcaLevels, { percent: 0, multiplier: 2 }] }));

    const removeLevel = (idx: number) =>
        setData(prev => ({ ...prev, dcaLevels: prev.dcaLevels.filter((_, i) => i !== idx) }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Pozycje */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <div className="font-semibold mb-2">Pozycje</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label font-semibold">Maksymalna ilość</label>
                            <input
                                type="number" min={1} className="input input-bordered w-full"
                                value={data.maxPositions}
                                onChange={e => patch({ maxPositions: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="label font-semibold">Długość życia</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number" min={1} className="input input-bordered w-20"
                                    value={data.positionLifetime}
                                    onChange={e => patch({ positionLifetime: Number(e.target.value) })}
                                />
                                <select
                                    className="select select-bordered"
                                    value={data.positionUnit}
                                    onChange={e => patch({ positionUnit: e.target.value as TimeUnit })}
                                >
                                    <option value="min">min</option>
                                    <option value="h">godz.</option>
                                    <option value="d">dni</option>
                                    <option value="w">tygodnie</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Zlecenia */}
                    <div className="font-semibold mb-2 mt-2">Zlecenia</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label font-semibold">Maksymalna ilość</label>
                            <input
                                type="number" min={1} className="input input-bordered w-full"
                                value={data.maxOrders}
                                onChange={e => patch({ maxOrders: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="label font-semibold">Długość życia</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="number" min={1} className="input input-bordered w-20"
                                    value={data.orderLifetime}
                                    onChange={e => patch({ orderLifetime: Number(e.target.value) })}
                                />
                                <select
                                    className="select select-bordered"
                                    value={data.orderUnit}
                                    onChange={e => patch({ orderUnit: e.target.value as TimeUnit })}
                                >
                                    <option value="min">min</option>
                                    <option value="h">godz.</option>
                                    <option value="d">dni</option>
                                    <option value="w">tygodnie</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DCA */}
            <div className="card bg-base-200">
                <div className="card-body">
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-lg">DCA</div>
                        <label className="flex gap-2 items-center cursor-pointer">
                            <input
                                type="checkbox" className="toggle toggle-primary"
                                checked={data.dcaEnabled}
                                onChange={e => patch({ dcaEnabled: e.target.checked })}
                            />
                        </label>
                    </div>

                    {data.dcaEnabled && (
                        <>
                            {/* tryb */}
                            <div className="mb-4 flex gap-6">
                                <label className="cursor-pointer flex items-center gap-2">
                                    <input
                                        type="radio" className="radio radio-primary" name="dcaMode"
                                        checked={data.dcaMode === "basic"}
                                        onChange={() => patch({ dcaMode: "basic" })}
                                    />
                                    <span>Podstawowe</span>
                                </label>
                                <label className="cursor-pointer flex items-center gap-2">
                                    <input
                                        type="radio" className="radio radio-primary" name="dcaMode"
                                        checked={data.dcaMode === "advanced"}
                                        onChange={() => patch({ dcaMode: "advanced" })}
                                    />
                                    <span>Zaawansowane</span>
                                </label>
                            </div>

                            {data.dcaMode === "basic" && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col md:flex-row gap-6 items-end">
                                        {/* Ilość razy (int) */}
                                        <div className="w-full">
                                            <label className="label font-semibold">Ilość razy</label>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={10}
                                                    step={1}
                                                    className="input input-bordered w-20 text-center"
                                                    value={data.dcaTimes}
                                                    onChange={e => patch({ dcaTimes: Number(e.target.value) })}
                                                />
                                                <input
                                                    type="range"
                                                    min={1}
                                                    max={10}
                                                    step={1}
                                                    value={data.dcaTimes}
                                                    className="range"
                                                    onChange={e => patch({ dcaTimes: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>

                                        {/* Mnożnik (float) */}
                                        <div className="w-40">
                                            <label className="label font-semibold">Mnożnik</label>
                                            <input
                                                type="number"
                                                min={1}
                                                step={0.05}
                                                className="input input-bordered"
                                                value={data.dcaMultiplier}
                                                onChange={e => patch({ dcaMultiplier: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {data.dcaMode === "advanced" && (
                                <>
                                    <div className="space-y-2">
                                        {data.dcaLevels.map((level, idx) => (
                                            <div key={idx} className="flex gap-4 items-end">
                                                <div>
                                                    <label className="label">Poziom (%)</label>
                                                    <input
                                                        type="number" className="input input-bordered"
                                                        value={level.percent}
                                                        onChange={e => updateLevel(idx, "percent", Number(e.target.value))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">Mnożnik</label>
                                                    <input
                                                        type="number" min={1} step={1} className="input input-bordered"
                                                        value={level.multiplier}
                                                        onChange={e => updateLevel(idx, "multiplier", Number(e.target.value))}
                                                    />
                                                </div>
                                                <button type="button" className="btn btn-primary" onClick={() => removeLevel(idx)}>
                                                    <LuTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" className="btn btn-outline mt-3" onClick={addLevel}>
                                        + Dodaj poziom
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
