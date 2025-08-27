import { BasicProps } from "../../types/StrategyForm.type";
export function Basic({ data, setData }: BasicProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Lewa kolumna */}
      <div className="w-full md:w-1/2 space-y-6">
        <div className="form-control w-full">
          <label className="label" htmlFor="name">
            <span className="label-text">Nazwa</span>
          </label>
          <input
            id="name"
            type="text"
            className="input input-bordered w-full"
            placeholder="np. RSI+MACD 5m"
            value={data.name}
            onChange={e =>
              setData((prev: any) => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
        <div className="form-control w-full">
          <label className="label" htmlFor="description">
            <span className="label-text">Opis</span>
          </label>
          <textarea
            id="description"
            className="textarea textarea-bordered w-full"
            placeholder="Opis strategii..."
            rows={3}
            value={data.description}
            onChange={e =>
              setData((prev: any) => ({ ...prev, description: e.target.value }))
            }
          />
        </div>
      </div>
      {/* Prawa kolumna */}
      <div className="w-full md:w-1/2 space-y-6">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Interwał</span>
          </label>
          <select
            value={data.interval}
            onChange={e =>
              setData((prev: any) => ({ ...prev, interval: e.target.value }))
            }
            className="select select-bordered w-full"
          >
            <option value="">Wybierz interwał</option>
            <option value="1 min">1 min</option>
            <option value="5 min">5 min</option>
            <option value="10 min">10 min</option>
            <option value="15 min">15 min</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
          </select>
        </div>
        <div className="form-control w-full">
          <label className="label">Dźwignia</label>
          <div className="flex items-center w-full gap-4">
            <input
              type="range"
              min={1}
              max={75}
              step={1}
              value={data.leverage}
              className="range w-full"
              onChange={e =>
                setData((prev: any) => ({
                  ...prev,
                  leverage: Number(e.target.value),
                }))
              }
            />
            <input
              type="number"
              min={1}
              max={75}
              value={data.leverage}
              className="input input-bordered w-20"
              onChange={e => {
                let val = Number(e.target.value);
                if (val < 1) val = 1;
                if (val > 75) val = 75;
                setData((prev: any) => ({
                  ...prev,
                  leverage: val,
                }));
              }}
            />
            <span className="opacity-60">x</span>
          </div>
        </div>
        {/* Wallet risk */}
        <div className="form-control w-full">
          <label className="label">Ryzyko portfela (%)</label>
          <div className="flex items-center w-full gap-4 ">
            <input
              type="range"
              min={0.1}
              max={100}
              step={0.1}
              value={data.walletRisk}
              className="range w-full"
              onChange={e =>
                setData((prev: any) => ({
                  ...prev,
                  walletRisk: Number(e.target.value),
                }))
              }
            />
            <input
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              className="input input-bordered w-20"
              value={data.walletRisk}
              onChange={e =>
                setData((prev: any) => ({
                  ...prev,
                  walletRisk: Number(e.target.value),
                }))
              }
            />
            <span className="opacity-60">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
