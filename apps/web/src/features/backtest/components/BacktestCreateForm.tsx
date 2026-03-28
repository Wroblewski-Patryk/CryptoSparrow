'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { listStrategies } from '../../strategies/api/strategies.api';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';
import { CreateBacktestRunInput } from '../types/backtest.type';
import { FieldWrapper, TextInputField } from '../../markets/components/FieldControls';
import { listMarketUniverses } from '../../markets/services/markets.service';
import { MarketUniverse } from '../../markets/types/marketUniverse.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

type BacktestCreateFormProps = {
  submitting: boolean;
  submitLabel: string;
  onSubmit: (payload: CreateBacktestRunInput) => Promise<void>;
};

const MAX_CANDLES_MIN = 100;
const MAX_CANDLES_MAX = 2500;

export default function BacktestCreateForm({ submitting, submitLabel, onSubmit }: BacktestCreateFormProps) {
  const [name, setName] = useState('MVP Backtest Run');
  const [strategyId, setStrategyId] = useState('');
  const [marketUniverseId, setMarketUniverseId] = useState('');
  const [notes, setNotes] = useState('');
  const [maxCandles, setMaxCandles] = useState('1200');

  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketUniverses, setMarketUniverses] = useState<MarketUniverse[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(true);
  const [universesLoading, setUniversesLoading] = useState(true);

  useEffect(() => {
    const loadStrategies = async () => {
      setStrategiesLoading(true);
      try {
        const data = await listStrategies();
        setStrategies(data);
        setStrategyId((prev) => prev || data[0]?.id || '');
      } catch (error: unknown) {
        toast.error('Nie udalo sie pobrac listy strategii', {
          description: getAxiosMessage(error),
        });
        setStrategies([]);
      } finally {
        setStrategiesLoading(false);
      }
    };

    void loadStrategies();
  }, []);

  useEffect(() => {
    const loadUniverses = async () => {
      setUniversesLoading(true);
      try {
        const data = await listMarketUniverses();
        setMarketUniverses(data);
        setMarketUniverseId((prev) => prev || data[0]?.id || '');
      } catch (error: unknown) {
        toast.error('Nie udalo sie pobrac grup rynkow', {
          description: getAxiosMessage(error),
        });
        setMarketUniverses([]);
      } finally {
        setUniversesLoading(false);
      }
    };

    void loadUniverses();
  }, []);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId) ?? null,
    [strategies, strategyId]
  );

  const selectedUniverse = useMemo(
    () => marketUniverses.find((item) => item.id === marketUniverseId) ?? null,
    [marketUniverses, marketUniverseId]
  );

  const selectedStrategyMarginMode = useMemo(() => {
    const config = (selectedStrategy?.config ?? null) as { additional?: { marginMode?: unknown } } | null;
    return config?.additional?.marginMode === 'ISOLATED' ? 'ISOLATED' : 'CROSSED';
  }, [selectedStrategy]);
  const parsedMaxCandles = Number.parseInt(maxCandles, 10);
  const hasValidMaxCandles =
    Number.isFinite(parsedMaxCandles) &&
    parsedMaxCandles >= MAX_CANDLES_MIN &&
    parsedMaxCandles <= MAX_CANDLES_MAX;

  const canSubmit =
    name.trim().length > 0 &&
    strategyId.trim().length > 0 &&
    marketUniverseId.trim().length > 0 &&
    hasValidMaxCandles &&
    !submitting &&
    !universesLoading &&
    !strategiesLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !selectedStrategy) return;

    await onSubmit({
      name: name.trim(),
      timeframe: selectedStrategy.interval,
      strategyId,
      marketUniverseId,
      seedConfig: {
        maxCandles: parsedMaxCandles,
      },
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='rounded-xl border border-base-300 bg-base-100 p-4 space-y-3'>
        <div className='flex items-center gap-2'>
          <h2 className='text-2xl'>Kreator backtestu</h2>
          <button type='submit' className='btn btn-success ml-auto btn-sm' disabled={!canSubmit}>
            {submitting ? 'Tworzenie...' : submitLabel}
          </button>
        </div>

        <div className='grid gap-3 md:grid-cols-2'>
          <TextInputField label='Nazwa runa' value={name} onChange={setName} placeholder='MVP Backtest Run' />

          <FieldWrapper label='Strategia'>
            <select
              className='select select-bordered'
              value={strategyId}
              onChange={(event) => setStrategyId(event.target.value)}
              disabled={strategiesLoading}
            >
              {strategies.length === 0 ? <option value=''>Brak strategii</option> : null}
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </FieldWrapper>

          <FieldWrapper label='Grupa rynkow'>
            <select
              className='select select-bordered'
              value={marketUniverseId}
              onChange={(event) => setMarketUniverseId(event.target.value)}
              disabled={universesLoading}
            >
              {marketUniverses.length === 0 ? <option value=''>Brak grup rynkow</option> : null}
              {marketUniverses.map((universe) => (
                <option key={universe.id} value={universe.id}>
                  {universe.name} ({universe.marketType}/{universe.baseCurrency})
                </option>
              ))}
            </select>
          </FieldWrapper>

          <FieldWrapper label='Interwal (ze strategii)'>
            <input
              className='input input-bordered'
              value={selectedStrategy?.interval ?? '-'}
              disabled
              readOnly
            />
          </FieldWrapper>

          <FieldWrapper label='Maksymalna liczba swiec na rynek (auto-limit)'>
            <input
              className='input input-bordered'
              value={maxCandles}
              onChange={(event) => setMaxCandles(event.target.value)}
              inputMode='numeric'
              min={MAX_CANDLES_MIN}
              max={MAX_CANDLES_MAX}
              placeholder='1200'
            />
            {!hasValidMaxCandles ? (
              <p className='mt-1 text-xs text-error'>
                Podaj liczbe z zakresu {MAX_CANDLES_MIN} - {MAX_CANDLES_MAX}.
              </p>
            ) : null}
          </FieldWrapper>

          <FieldWrapper label='Notatki (opcjonalnie)'>
            <textarea
              className='textarea textarea-bordered min-h-24'
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder='Opis zalozen runa, wersja danych, komentarz...'
            />
          </FieldWrapper>
        </div>

        <div className='rounded-box border border-base-300 bg-base-200 p-3 text-sm'>
          <p>
            <span className='opacity-70'>Strategia:</span> <span className='font-medium'>{selectedStrategy?.name ?? '-'}</span>
          </p>
          <p>
            <span className='opacity-70'>Interwal:</span> <span className='font-medium'>{selectedStrategy?.interval ?? '-'}</span>
          </p>
          <p>
            <span className='opacity-70'>Leverage:</span> <span className='font-medium'>{selectedStrategy?.leverage ?? 1}x</span>
          </p>
          <p>
            <span className='opacity-70'>Margin mode:</span> <span className='font-medium'>{selectedStrategyMarginMode}</span>
          </p>
          <p>
            <span className='opacity-70'>Grupa rynkow:</span> <span className='font-medium'>{selectedUniverse?.name ?? '-'}</span>
          </p>
          <p>
            <span className='opacity-70'>Whitelist/Blacklist:</span>{' '}
            <span className='font-medium'>
              {(selectedUniverse?.whitelist?.length ?? 0)}/{selectedUniverse?.blacklist?.length ?? 0}
            </span>
          </p>
          <p>
            <span className='opacity-70'>Tryb:</span> <span className='font-medium'>symbol po symbolu</span>
          </p>
        </div>
      </div>
    </form>
  );
}
