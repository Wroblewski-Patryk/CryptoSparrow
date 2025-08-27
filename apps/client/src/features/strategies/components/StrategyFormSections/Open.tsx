import { useEffect, useState } from "react";
import Indicators from "./Indicators";
import { IndicatorMeta, OpenProps, UserIndicator } from "../../types/StrategyForm.type";
import { listStrategyIndicators } from "../../api/strategies.api";
import { toast } from "sonner";

export function Open({ data, setData }: OpenProps) {
	const [availableIndicators, setAvailableIndicators] = useState<IndicatorMeta[]>([]);

	useEffect(() => {
		(async () => {
			try {
				const data = await listStrategyIndicators();
				setAvailableIndicators(data);
			} catch (e: any) {
				toast.error("Nie udało się pobrać listy wskaźników", { description: e?.response?.data?.message });
				setAvailableIndicators([])
			}
		})();
	}, []);

	// Ustawianie direction
	const setDirection = (direction: "both" | "long" | "short") =>
		setData(prev => ({ ...prev, direction }));

	// Settery do przekazania do OpenIndicators
	const setIndicatorsLong = (arr: UserIndicator[]) =>
		setData(prev => ({ ...prev, indicatorsLong: arr }));

	const setIndicatorsShort = (arr: UserIndicator[]) =>
		setData(prev => ({ ...prev, indicatorsShort: arr }));

	const spans = {
		both: { left: "col-span-6", right: "col-span-6" },
		long: { left: "col-span-8", right: "col-span-4 opacity-20" },
		short: { left: "col-span-4 opacity-20", right: "col-span-8" },
	} as const;

	const layout = spans[data.direction];

	return (
		<div className="w-full">
			<div className="form-control mb-6">
				<label className="label mb-2">
					<span className="label-text">Kierunek</span>
				</label>
				<div className="flex flex-row gap-4">
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="direction"
							className="radio radio-success"
							checked={data.direction === "long"}
							onChange={() => setDirection("long")}
						/>
						<span className="label-text">Long</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="direction"
							className="radio radio-primary"
							checked={data.direction === "both"}
							onChange={() => setDirection("both")}
						/>
						<span className="label-text">Oba</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="direction"
							className="radio radio-error"
							checked={data.direction === "short"}
							onChange={() => setDirection("short")}
						/>
						<span className="label-text">Short</span>
					</label>
				</div>
			</div>
			<div className={`grid grid-cols-12 gap-8`}>
				<div className={`${layout.left}  transition-all duration-500 ease-in-out`}>
					<Indicators
						side="LONG"
						indicators={availableIndicators}
						value={data.indicatorsLong}
						setValue={setIndicatorsLong}
					/>
				</div>
				<div className={`${layout.right} transition-all duration-500 ease-in-out`}>
					<Indicators
						side="SHORT"
						indicators={availableIndicators}
						value={data.indicatorsShort}
						setValue={setIndicatorsShort}
					/>
				</div>
			</div>
		</div >
	);
}
