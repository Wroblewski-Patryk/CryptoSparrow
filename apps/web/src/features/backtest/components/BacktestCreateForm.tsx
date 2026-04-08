'use client';

import { type FormEvent, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { listStrategies } from '../../strategies/api/strategies.api';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';
import { CreateBacktestRunInput } from '../types/backtest.type';
import { FieldWrapper, TextInputField } from '../../markets/components/FieldControls';
import { listMarketUniverses } from '../../markets/services/markets.service';
import { MarketUniverse } from '../../markets/types/marketUniverse.type';
import { I18nContext } from '../../../i18n/I18nProvider';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return (err.response?.data as { message?: string } | undefined)?.message;
};

type BacktestCreateFormProps = {
  formId?: string;
  submitting: boolean;
  onSubmit: (payload: CreateBacktestRunInput) => Promise<void>;
};

const MAX_CANDLES_MIN = 100;
const MAX_CANDLES_MAX = 10000;
const INITIAL_BALANCE_MIN = 1;
const INITIAL_BALANCE_MAX = 1_000_000_000;

const buildSuggestedRunName = (locale: 'pl' | 'en', strategyName?: string, universeName?: string, timeframe?: string) => {
  const strategy = strategyName?.trim() || (locale === 'en' ? 'Strategy' : 'Strategia');
  const universe = universeName?.trim() || (locale === 'en' ? 'Market' : 'Rynek');
  const tf = timeframe?.trim() || '-';
  return `Backtest ${strategy} | ${universe} (${tf})`;
};

export default function BacktestCreateForm({ formId = 'backtest-form', submitting, onSubmit }: BacktestCreateFormProps) {
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          strategyLoadError: 'Could not load strategy list',
          universesLoadError: 'Could not load market groups',
          noStrategies: 'No strategies',
          noUniverses: 'No market groups',
          creating: 'Creating...',
          title: 'Backtest wizard',
          subtitle: 'Pick strategy + market universe and run historical simulation.',
          sectionRunConfig: 'Run setup',
          sectionSimParams: 'Simulation parameters',
          runName: 'Run name',
          runNamePlaceholder: 'e.g. Backtest Trend Pulse | Spot Core (5m)',
          strategy: 'Strategy',
          marketGroup: 'Market group',
          maxCandles: 'Max candles per market (auto-limit)',
          maxCandlesErrorPrefix: 'Provide a number in range',
          initialBalance: 'Initial portfolio balance (Backtest/Paper)',
          initialBalanceErrorPrefix: 'Provide a value in range',
          venueContextTitle: 'Venue context (bound to selected market group)',
          venueContextHint:
            'Backtest execution context is derived from the selected market group and cannot diverge.',
          venueContextAwaitingSelection: 'Select a market group to resolve context.',
          venueContextExchange: 'Exchange',
          venueContextMarketType: 'Market type',
          venueContextBaseCurrency: 'Base currency',
          notes: 'Notes (optional)',
          notesPlaceholder: 'Assumptions, data version, comments...',
        }
      : {
          strategyLoadError: 'Nie udalo sie pobrac listy strategii',
          universesLoadError: 'Nie udalo sie pobrac grup rynkow',
          noStrategies: 'Brak strategii',
          noUniverses: 'Brak grup rynkow',
          creating: 'Tworzenie...',
          title: 'Kreator backtestu',
          subtitle: 'Ustaw strategy + market universe i uruchom symulacje na danych historycznych.',
          sectionRunConfig: 'Konfiguracja runa',
          sectionSimParams: 'Parametry symulacji',
          runName: 'Nazwa runa',
          runNamePlaceholder: 'np. Backtest Trend Pulse | Spot Core (5m)',
          strategy: 'Strategia',
          marketGroup: 'Grupa rynkow',
          maxCandles: 'Maksymalna liczba swiec na rynek (auto-limit)',
          maxCandlesErrorPrefix: 'Podaj liczbe z zakresu',
          initialBalance: 'Startowy balans portfela (Backtest/Paper)',
          initialBalanceErrorPrefix: 'Podaj wartosc z zakresu',
          venueContextTitle: 'Kontekst venue (powiazany z wybrana grupa rynkow)',
          venueContextHint:
            'Kontekst wykonania backtestu jest dziedziczony z wybranej grupy rynkow i nie moze sie rozjechac.',
          venueContextAwaitingSelection: 'Wybierz grupe rynkow, aby zobaczyc kontekst.',
          venueContextExchange: 'Exchange',
          venueContextMarketType: 'Market type',
          venueContextBaseCurrency: 'Base currency',
          notes: 'Notatki (opcjonalnie)',
          notesPlaceholder: 'Opis zalozen runa, wersja danych, komentarz...',
        };
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [strategyId, setStrategyId] = useState('');
  const [marketUniverseId, setMarketUniverseId] = useState('');
  const [notes, setNotes] = useState('');
  const [maxCandles, setMaxCandles] = useState('1200');
  const [initialBalance, setInitialBalance] = useState('10000');

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
        toast.error(copy.strategyLoadError, {
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
        toast.error(copy.universesLoadError, {
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
  const suggestedRunName = useMemo(
    () =>
      buildSuggestedRunName(
        locale,
        selectedStrategy?.name,
        selectedUniverse?.name,
        selectedStrategy?.interval
      ),
    [locale, selectedStrategy?.interval, selectedStrategy?.name, selectedUniverse?.name]
  );

  useEffect(() => {
    if (nameEdited) return;
    setName(suggestedRunName);
  }, [nameEdited, suggestedRunName]);

  const parsedMaxCandles = Number.parseInt(maxCandles, 10);
  const parsedInitialBalance = Number.parseFloat(initialBalance);
  const hasValidMaxCandles =
    Number.isFinite(parsedMaxCandles) &&
    parsedMaxCandles >= MAX_CANDLES_MIN &&
    parsedMaxCandles <= MAX_CANDLES_MAX;
  const hasValidInitialBalance =
    Number.isFinite(parsedInitialBalance) &&
    parsedInitialBalance >= INITIAL_BALANCE_MIN &&
    parsedInitialBalance <= INITIAL_BALANCE_MAX;

  const canSubmit =
    name.trim().length > 0 &&
    strategyId.trim().length > 0 &&
    marketUniverseId.trim().length > 0 &&
    hasValidMaxCandles &&
    hasValidInitialBalance &&
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
        initialBalance: parsedInitialBalance,
      },
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className='space-y-4'>
      <div className='rounded-box border border-base-300/60 bg-base-100/80 p-4 md:p-5 space-y-5'>
        <div className='flex flex-wrap items-start gap-3'>
          <div className='space-y-1'>
            <h2 className='text-2xl'>{copy.title}</h2>
            <p className='text-sm opacity-70'>{copy.subtitle}</p>
          </div>
        </div>

        <div className='space-y-4'>
          <section className='rounded-lg border border-base-300 bg-base-100 p-3 space-y-3'>
            <h3 className='text-xs font-semibold uppercase tracking-wide opacity-70'>{copy.sectionRunConfig}</h3>
            <div className='grid gap-3 md:grid-cols-2'>
              <TextInputField
                label={copy.runName}
                value={name}
                onChange={(value) => {
                  setName(value);
                  setNameEdited(true);
                }}
                placeholder={copy.runNamePlaceholder}
              />

              <FieldWrapper label={copy.strategy}>
                <select
                  className='select select-bordered'
                  value={strategyId}
                  onChange={(event) => setStrategyId(event.target.value)}
                  disabled={strategiesLoading}
                >
                  {strategies.length === 0 ? <option value=''>{copy.noStrategies}</option> : null}
                  {strategies.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </option>
                  ))}
                </select>
              </FieldWrapper>

              <FieldWrapper label={copy.marketGroup}>
                <select
                  className='select select-bordered'
                  value={marketUniverseId}
                  onChange={(event) => setMarketUniverseId(event.target.value)}
                  disabled={universesLoading}
                >
                  {marketUniverses.length === 0 ? <option value=''>{copy.noUniverses}</option> : null}
                  {marketUniverses.map((universe) => (
                    <option key={universe.id} value={universe.id}>
                      {universe.name} ({universe.exchange ?? 'BINANCE'} - {universe.marketType}/{universe.baseCurrency})
                    </option>
                  ))}
                </select>
              </FieldWrapper>

              <div className='md:col-span-2 rounded-md border border-base-300/70 bg-base-200/40 px-3 py-2'>
                <p className='text-[11px] font-semibold uppercase tracking-wide opacity-70'>
                  {copy.venueContextTitle}
                </p>
                {selectedUniverse ? (
                  <div className='mt-2 flex flex-wrap items-center gap-2 text-sm'>
                    <span className='badge badge-outline gap-1'>
                      <span className='opacity-70'>{copy.venueContextExchange}:</span>
                      <span className='font-semibold'>{selectedUniverse.exchange ?? 'BINANCE'}</span>
                    </span>
                    <span className='badge badge-outline gap-1'>
                      <span className='opacity-70'>{copy.venueContextMarketType}:</span>
                      <span className='font-semibold'>{selectedUniverse.marketType}</span>
                    </span>
                    <span className='badge badge-outline gap-1'>
                      <span className='opacity-70'>{copy.venueContextBaseCurrency}:</span>
                      <span className='font-semibold'>{selectedUniverse.baseCurrency}</span>
                    </span>
                  </div>
                ) : (
                  <p className='mt-1 text-xs opacity-70'>{copy.venueContextAwaitingSelection}</p>
                )}
                <p className='mt-2 text-xs opacity-70'>{copy.venueContextHint}</p>
              </div>
            </div>
          </section>

          <section className='rounded-lg border border-base-300 bg-base-100 p-3 space-y-3'>
            <h3 className='text-xs font-semibold uppercase tracking-wide opacity-70'>{copy.sectionSimParams}</h3>
            <div className='grid gap-3 md:grid-cols-2'>
              <FieldWrapper label={copy.maxCandles}>
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
                    {copy.maxCandlesErrorPrefix} {MAX_CANDLES_MIN} - {MAX_CANDLES_MAX}.
                  </p>
                ) : null}
              </FieldWrapper>

              <FieldWrapper label={copy.initialBalance}>
                <input
                  className='input input-bordered'
                  value={initialBalance}
                  onChange={(event) => setInitialBalance(event.target.value)}
                  inputMode='decimal'
                  min={INITIAL_BALANCE_MIN}
                  max={INITIAL_BALANCE_MAX}
                  placeholder='10000'
                />
                {!hasValidInitialBalance ? (
                  <p className='mt-1 text-xs text-error'>
                    {copy.initialBalanceErrorPrefix} {INITIAL_BALANCE_MIN} - {INITIAL_BALANCE_MAX}.
                  </p>
                ) : null}
              </FieldWrapper>

              <div className='md:col-span-2'>
                <FieldWrapper label={copy.notes}>
                  <textarea
                    className='textarea textarea-bordered min-h-24'
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={copy.notesPlaceholder}
                  />
                </FieldWrapper>
              </div>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}

