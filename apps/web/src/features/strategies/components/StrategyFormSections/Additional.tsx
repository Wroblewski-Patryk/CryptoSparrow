import { LuTrash2 } from 'react-icons/lu';
import { AdditionalProps, DcaLevel, TimeUnit } from '../../types/StrategyForm.type';
import {
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from '../../utils/strategyNumericInput';

const getPrimaryDcaLevel = (levels: DcaLevel[]): DcaLevel => levels[0] ?? { percent: -1, multiplier: 2 };
const integerInputProps = numericInputProps(strategyNumericContracts.integer);
const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Additional({ data, setData }: AdditionalProps) {
  const patch = (changes: Partial<typeof data>) => setData((prev) => ({ ...prev, ...changes }));

  const updateLevel = (idx: number, field: keyof DcaLevel, value: number) =>
    setData((prev) => ({
      ...prev,
      dcaLevels: prev.dcaLevels.map((level, i) => (i === idx ? { ...level, [field]: value } : level)),
      dcaTimes:
        prev.dcaMode === 'advanced'
          ? prev.dcaLevels.map((level, i) => (i === idx ? { ...level, [field]: value } : level)).length
          : prev.dcaTimes,
    }));

  const setPrimaryDcaLevel = (changes: Partial<DcaLevel>) =>
    setData((prev) => {
      const current = getPrimaryDcaLevel(prev.dcaLevels);
      const next = { ...current, ...changes };
      const rest = prev.dcaLevels.slice(1);
      return { ...prev, dcaLevels: [next, ...rest] };
    });

  const addLevel = () =>
    setData((prev) => ({
      ...prev,
      dcaLevels: [...prev.dcaLevels, { percent: -1, multiplier: 2 }],
      dcaTimes: prev.dcaMode === 'advanced' ? prev.dcaLevels.length + 1 : prev.dcaTimes,
    }));

  const removeLevel = (idx: number) =>
    setData((prev) => ({
      ...prev,
      dcaLevels: prev.dcaLevels.filter((_, i) => i !== idx),
      dcaTimes: prev.dcaMode === 'advanced' ? Math.max(0, prev.dcaLevels.length - 1) : prev.dcaTimes,
    }));

  const primaryLevel = getPrimaryDcaLevel(data.dcaLevels);

  return (
    <div className='grid grid-cols-1 gap-10 md:grid-cols-2'>
      <div className='card bg-base-200'>
        <div className='card-body space-y-6'>
          <div>
            <div className='mb-2 font-semibold'>Pozycje</div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='form-control gap-2'>
                <label className='label p-0 font-semibold'>Maksymalna ilosc</label>
                <input
                  type='number'
                  min={1}
                  inputMode={integerInputProps.inputMode}
                  step={integerInputProps.step}
                  className='input input-bordered w-full'
                  value={data.maxPositions}
                  onChange={(e) => {
                    const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                    if (parsed == null) return;
                    patch({ maxPositions: parsed });
                  }}
                />
              </div>
              <div className='form-control gap-2'>
                <label className='label p-0 font-semibold'>Dlugosc zycia</label>
                <div className='flex items-center gap-2'>
                  <input
                    type='number'
                    min={1}
                    inputMode={integerInputProps.inputMode}
                    step={integerInputProps.step}
                    className='input input-bordered w-24'
                    value={data.positionLifetime}
                    onChange={(e) => {
                      const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                      if (parsed == null) return;
                      patch({ positionLifetime: parsed });
                    }}
                  />
                  <select
                    className='select select-bordered'
                    value={data.positionUnit}
                    onChange={(e) => patch({ positionUnit: e.target.value as TimeUnit })}
                  >
                    <option value='min'>min</option>
                    <option value='h'>godz.</option>
                    <option value='d'>dni</option>
                    <option value='w'>tygodnie</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className='mb-2 font-semibold'>Zlecenia</div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='form-control gap-2'>
                <label className='label p-0 font-semibold'>Maksymalna ilosc</label>
                <input
                  type='number'
                  min={1}
                  inputMode={integerInputProps.inputMode}
                  step={integerInputProps.step}
                  className='input input-bordered w-full'
                  value={data.maxOrders}
                  onChange={(e) => {
                    const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                    if (parsed == null) return;
                    patch({ maxOrders: parsed });
                  }}
                />
              </div>
              <div className='form-control gap-2'>
                <label className='label p-0 font-semibold'>Dlugosc zycia</label>
                <div className='flex items-center gap-2'>
                  <input
                    type='number'
                    min={1}
                    inputMode={integerInputProps.inputMode}
                    step={integerInputProps.step}
                    className='input input-bordered w-24'
                    value={data.orderLifetime}
                    onChange={(e) => {
                      const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                      if (parsed == null) return;
                      patch({ orderLifetime: parsed });
                    }}
                  />
                  <select
                    className='select select-bordered'
                    value={data.orderUnit}
                    onChange={(e) => patch({ orderUnit: e.target.value as TimeUnit })}
                  >
                    <option value='min'>min</option>
                    <option value='h'>godz.</option>
                    <option value='d'>dni</option>
                    <option value='w'>tygodnie</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='card bg-base-200'>
        <div className='card-body space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='font-semibold text-lg'>DCA</div>
            <label className='cursor-pointer'>
              <input
                type='checkbox'
                className='toggle toggle-primary'
                checked={data.dcaEnabled}
                onChange={(e) => patch({ dcaEnabled: e.target.checked })}
              />
            </label>
          </div>

          {data.dcaEnabled ? (
            <>
              <div className='flex flex-wrap gap-6'>
                <label className='cursor-pointer inline-flex items-center gap-2'>
                  <input
                    type='radio'
                    className='radio radio-primary'
                    name='dcaMode'
                    checked={data.dcaMode === 'basic'}
                    onChange={() =>
                      setData((prev) => ({
                        ...prev,
                        dcaMode: 'basic',
                        dcaTimes: Math.max(1, prev.dcaTimes || prev.dcaLevels.length || 1),
                      }))
                    }
                  />
                  <span>Podstawowe</span>
                </label>
                <label className='cursor-pointer inline-flex items-center gap-2'>
                  <input
                    type='radio'
                    className='radio radio-primary'
                    name='dcaMode'
                    checked={data.dcaMode === 'advanced'}
                    onChange={() =>
                      setData((prev) => ({
                        ...prev,
                        dcaMode: 'advanced',
                        dcaTimes: prev.dcaLevels.length,
                      }))
                    }
                  />
                  <span>Zaawansowane</span>
                </label>
              </div>

              {data.dcaMode === 'basic' ? (
                <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                  <div className='form-control gap-2'>
                    <label className='label p-0 font-semibold'>Ile razy</label>
                    <div className='flex items-center gap-2'>
                      <input
                        type='number'
                        min={1}
                        max={10}
                        step={1}
                        inputMode={integerInputProps.inputMode}
                        className='input input-bordered w-20 text-center'
                        value={data.dcaTimes}
                        onChange={(e) => {
                          const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                          if (parsed == null) return;
                          patch({ dcaTimes: parsed });
                        }}
                      />
                      <input
                        type='range'
                        min={1}
                        max={10}
                        step={1}
                        className='range'
                        value={data.dcaTimes}
                        onChange={(e) => {
                          const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                          if (parsed == null) return;
                          patch({ dcaTimes: parsed });
                        }}
                      />
                    </div>
                  </div>

                  <div className='form-control gap-2'>
                    <label className='label p-0 font-semibold'>Poziom triggera (%)</label>
                    <input
                      type='number'
                      min={-100}
                      max={100}
                      step={decimalInputProps.step}
                      inputMode={decimalInputProps.inputMode}
                      className='input input-bordered'
                      value={primaryLevel.percent}
                      onChange={(e) => {
                        const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                        if (parsed == null) return;
                        setPrimaryDcaLevel({ percent: parsed });
                      }}
                    />
                  </div>

                  <div className='form-control gap-2'>
                    <label className='label p-0 font-semibold'>Mnoznik</label>
                    <input
                      type='number'
                      min={1}
                      step={decimalInputProps.step}
                      inputMode={decimalInputProps.inputMode}
                      className='input input-bordered'
                      value={data.dcaMultiplier}
                      onChange={(e) => {
                        const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                        if (parsed == null) return;
                        patch({ dcaMultiplier: parsed });
                        setPrimaryDcaLevel({ multiplier: parsed });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className='space-y-2'>
                    {data.dcaLevels.map((level, idx) => (
                      <div key={`dca-level-${idx}`} className='grid grid-cols-[1fr_1fr_auto] gap-3 items-end'>
                        <div className='form-control gap-2'>
                          <label className='label p-0'>Poziom (%)</label>
                          <input
                            type='number'
                            step={decimalInputProps.step}
                            inputMode={decimalInputProps.inputMode}
                            className='input input-bordered'
                            value={level.percent}
                            onChange={(e) => {
                              const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                              if (parsed == null) return;
                              updateLevel(idx, 'percent', parsed);
                            }}
                          />
                        </div>
                        <div className='form-control gap-2'>
                          <label className='label p-0'>Mnoznik</label>
                          <input
                            type='number'
                            min={1}
                            step={decimalInputProps.step}
                            inputMode={decimalInputProps.inputMode}
                            className='input input-bordered'
                            value={level.multiplier}
                            onChange={(e) => {
                              const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                              if (parsed == null) return;
                              updateLevel(idx, 'multiplier', parsed);
                            }}
                          />
                        </div>
                        <button type='button' className='btn btn-primary' onClick={() => removeLevel(idx)} title='Usun poziom'>
                          <LuTrash2 className='h-4 w-4' />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type='button' className='btn btn-outline mt-2' onClick={addLevel}>
                    + Dodaj poziom
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
