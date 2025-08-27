import { LuChevronDown, LuChevronRight, LuChevronUp, LuTrash2, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { IndicatorsProps } from "../../types/StrategyForm.type";

export default function Indicators({ side, indicators, value, setValue }: IndicatorsProps) {
    const indicatorGroups = Array.from(new Set(indicators.map(i => i.group)));

    // Dodaj nowy wskaźnik
    const addIndicator = () => {
        if (indicators.length === 0) return;
        const group = indicatorGroups[0];
        const indicatorsInGroup = indicators.filter(i => i.group === group);
        const meta = indicatorsInGroup[0];
        setValue([
            ...value,
            {
                group,
                name: meta.name,
                params: Object.fromEntries(meta.params.map(p => [p.name, p.default])),
                condition: ">",
                value: 0,
                weight: 1,
                expanded: true,
            },
        ]);
    };

    // Funkcje obsługi
    const updateGroup = (idx: number, group: string) => {
        const indicatorsInGroup = indicators.filter(i => i.group === group);
        const meta = indicatorsInGroup[0];
        setValue(value.map((el, i) =>
            i === idx
                ? { ...el, group, name: meta.name, params: Object.fromEntries(meta.params.map(p => [p.name, p.default])) }
                : el
        ));
    };
    const updateIndicatorType = (idx: number, name: string) => {
        const meta = indicators.find(i => i.name === name);
        if (!meta) return;
        setValue(value.map((el, i) =>
            i === idx
                ? { ...el, name, params: Object.fromEntries(meta.params.map(p => [p.name, p.default])) }
                : el
        ));
    };
    const updateParam = (idx: number, param: string, paramValue: number) => {
        setValue(value.map((el, i) =>
            i === idx
                ? { ...el, params: { ...el.params, [param]: paramValue } }
                : el
        ));
    };
    const updateCondition = (idx: number, cond: ">" | "<") => {
        setValue(value.map((el, i) =>
            i === idx ? { ...el, condition: cond } : el
        ));
    };
    const updateValue = (idx: number, val: number) => {
        setValue(value.map((el, i) =>
            i === idx ? { ...el, value: val } : el
        ));
    };
    const updateWeight = (idx: number, val: number) => {
        setValue(value.map((el, i) =>
            i === idx ? { ...el, weight: val } : el
        ));
    };
    const toggleExpand = (idx: number) => {
        setValue(value.map((el, i) =>
            i === idx ? { ...el, expanded: !el.expanded } : el
        ));
    };
    const removeIndicator = (idx: number) => {
        setValue(value.filter((_, i) => i !== idx));
    };
    const moveIndicator = (idx: number, dir: "up" | "down") => {
        const arr = [...value];
        if (dir === "up" && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        if (dir === "down" && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        setValue(arr);
    };

    return (
        <div>
            <h3 className={`text-xl mb-4 flex items-center gap-2
                    ${side === "LONG" ? "text-success" : "text-error"}`}
            >
                {side === "LONG" ?
                    <LuTrendingUp className="w-4 h-4 mt-1" /> :
                    <LuTrendingDown className="w-4 h-4" />}
                {side}
            </h3>

            {value.map((indicator, idx) => {
                const indicatorsInGroup = indicators.filter(i => i.group === indicator.group);
                const meta = indicators.find(i => i.name === indicator.name);

                return (
                    <div key={idx} className="card bg-base-200 shadow-md mb-6">
                        {/* Header: Grupa > Nazwa, przyciski */}
                        <div className="flex justify-between items-center pb-2 px-4 pt-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-xs btn-square"
                                    onClick={() => toggleExpand(idx)}
                                    title={indicator.expanded ? "Zwiń" : "Rozwiń"}
                                >
                                    {indicator.expanded
                                        ? <LuChevronUp className="w-4 h-4" />
                                        : <LuChevronDown className="w-4 h-4" />}
                                </button>
                                <div className="text-lg flex items-center gap-2">
                                    <span className="text-base-content/80">{indicator.group}</span>
                                    <LuChevronRight className="text-base-content/60" />
                                    <span className="text-base-content">{indicator.name}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {/* Kolejność */}
                                <div className="join">
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-square join-item"
                                        disabled={idx === 0}
                                        onClick={() => moveIndicator(idx, "up")}
                                        title="Wyżej"
                                    >
                                        <LuChevronUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-square join-item"
                                        disabled={idx === value.length - 1}
                                        onClick={() => moveIndicator(idx, "down")}
                                        title="Niżej"
                                    >
                                        <LuChevronDown className="w-4 h-4" />
                                    </button>
                                </div>
                                {/* Usuń */}
                                <button
                                    type="button"
                                    className="btn btn-xs btn-square text-error"
                                    onClick={() => removeIndicator(idx)}
                                    title="Usuń wskaźnik"
                                >
                                    <LuTrash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {/* BODY KARTY */}
                        {indicator.expanded && (
                            <div className="card-body pt-2 pb-2">
                                {/* Pierwszy rząd: Grupa/Wskaźnik */}
                                <div className="flex flex-col md:flex-row gap-6 mb-2">
                                    <div className="flex-1">
                                        <label className="label">Grupa</label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={indicator.group}
                                            onChange={e => updateGroup(idx, e.target.value)}
                                        >
                                            {indicatorGroups.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="label">Wskaźnik</label>
                                        <select
                                            className="select select-bordered w-full"
                                            value={indicator.name}
                                            onChange={e => updateIndicatorType(idx, e.target.value)}
                                        >
                                            {indicatorsInGroup.map(i => (
                                                <option key={i.name} value={i.name}>{i.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {/* GŁÓWNY GRID */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Kolumna lewa: parametry */}
                                    <div>
                                        <div className="font-semibold text-base-content/80 mb-2 flex items-center gap-2">
                                            Parametry wskaźnika
                                        </div>
                                        <div className="space-y-2">
                                            {meta?.params.map(param => (
                                                <div key={param.name} className="form-control mb-4">
                                                    <label className="label">
                                                        <span className="label-text">{param.name}</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered"
                                                        min={param.min}
                                                        max={param.max}
                                                        value={indicator.params[param.name]}
                                                        onChange={e => updateParam(idx, param.name, Number(e.target.value))}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Kolumna prawa: warunek/wartość + waga */}
                                    <div className="flex flex-col gap-6">
                                        {/* Warunek i wartość */}
                                        <div>
                                            <div className="grid grid-cols-2 gap-4 items-center">
                                                {/* Kolumna 1: Warunek */}
                                                <div>
                                                    <label className="label mb-1 font-semibold">Warunek</label>
                                                    <div className="join">
                                                        <input
                                                            name={`cond_${side}_${idx}`}
                                                            className="join-item btn"
                                                            type="radio"
                                                            aria-label="<"
                                                            checked={indicator.condition === "<"}
                                                            onChange={() => updateCondition(idx, "<")}
                                                        />
                                                        <input
                                                            name={`cond_${side}_${idx}`}
                                                            className="join-item btn"
                                                            type="radio"
                                                            aria-label=">"
                                                            checked={indicator.condition === ">"}
                                                            onChange={() => updateCondition(idx, ">")}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Kolumna 2: Wartość */}
                                                <div>
                                                    <label className="label mb-1 font-semibold">Wartość</label>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered w-full"
                                                        value={indicator.value}
                                                        onChange={e => updateValue(idx, Number(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Waga */}
                                        <div>
                                            <label className="label font-semibold">
                                                <span className="label-text flex items-center gap-1">
                                                    Waga
                                                </span>
                                            </label>
                                            <div className="flex items-center gap-4">
                                                <div className="w-full max-w-xs">
                                                    <input
                                                        className="range range-xs"
                                                        type="range"
                                                        min={0}
                                                        max="1"
                                                        value={indicator.weight}
                                                        onChange={e => updateWeight(idx, Number(e.target.value))}
                                                        step="0.2" />

                                                    <div className="flex justify-between px-2.5 mt-2 text-xs">
                                                        <span>0</span>
                                                        <span>0.2</span>
                                                        <span>0.4</span>
                                                        <span>0.6</span>
                                                        <span>0.8</span>
                                                        <span>1</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Możesz tu wrzucić stat box albo dodatkowe info */}
                            </div>
                        )}
                    </div>
                );
            })}

            <button
                type="button"
                className="btn btn-outline mt-2"
                onClick={addIndicator}
            > + Dodaj wskaźnik
            </button>
        </div>
    );
}
