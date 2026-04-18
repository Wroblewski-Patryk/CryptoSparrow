'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { listStrategies } from '../../strategies/api/strategies.api';
import { StrategyDto } from '../../strategies/types/StrategyForm.type';
import { CreateBacktestRunInput } from '../types/backtest.type';
import { listMarketUniverses } from '../../markets/services/markets.service';
import { MarketUniverse } from '../../markets/types/marketUniverse.type';
import { useI18n } from '../../../i18n/I18nProvider';
import { hasFormText, normalizeFormText, resolveFormErrorMessage } from '@/lib/forms';
import { FormField, TextField } from '@/ui/forms';

type BacktestCreateFormProps = {
  formId?: string;
  submitting: boolean;
  onSubmit: (payload: CreateBacktestRunInput) => Promise<void>;
};

const MAX_CANDLES_MIN = 100;
const MAX_CANDLES_MAX = 10000;
const INITIAL_BALANCE_MIN = 1;
const INITIAL_BALANCE_MAX = 1_000_000_000;

const buildSuggestedRunName = (
  strategyName: string | undefined,
  universeName: string | undefined,
  timeframe: string | undefined,
  strategyFallback: string,
  marketFallback: string
) => {
  const strategy = normalizeFormText(strategyName) || strategyFallback;
  const universe = normalizeFormText(universeName) || marketFallback;
  const tf = normalizeFormText(timeframe) || '-';
  return `Backtest ${strategy} | ${universe} (${tf})`;
};

export default function BacktestCreateForm({ formId = 'backtest-form', submitting, onSubmit }: BacktestCreateFormProps) {
  const { t } = useI18n();
  const copy = useMemo(
    () => ({
      strategyLoadError: t('dashboard.backtests.createForm.strategyLoadError'),
      universesLoadError: t('dashboard.backtests.createForm.universesLoadError'),
      noStrategies: t('dashboard.backtests.createForm.noStrategies'),
      noUniverses: t('dashboard.backtests.createForm.noUniverses'),
      creating: t('dashboard.backtests.createForm.creating'),
      title: t('dashboard.backtests.createForm.title'),
      subtitle: t('dashboard.backtests.createForm.subtitle'),
      sectionRunConfig: t('dashboard.backtests.createForm.sectionRunConfig'),
      sectionSimParams: t('dashboard.backtests.createForm.sectionSimParams'),
      runName: t('dashboard.backtests.createForm.runName'),
      runNamePlaceholder: t('dashboard.backtests.createForm.runNamePlaceholder'),
      strategy: t('dashboard.backtests.createForm.strategy'),
      marketGroup: t('dashboard.backtests.createForm.marketGroup'),
      maxCandles: t('dashboard.backtests.createForm.maxCandles'),
      maxCandlesErrorPrefix: t('dashboard.backtests.createForm.maxCandlesErrorPrefix'),
      initialBalance: t('dashboard.backtests.createForm.initialBalance'),
      initialBalanceErrorPrefix: t('dashboard.backtests.createForm.initialBalanceErrorPrefix'),
      venueContextTitle: t('dashboard.backtests.createForm.venueContextTitle'),
      venueContextHint: t('dashboard.backtests.createForm.venueContextHint'),
      venueContextAwaitingSelection: t('dashboard.backtests.createForm.venueContextAwaitingSelection'),
      venueContextExchange: t('dashboard.backtests.createForm.venueContextExchange'),
      venueContextMarketType: t('dashboard.backtests.createForm.venueContextMarketType'),
      venueContextBaseCurrency: t('dashboard.backtests.createForm.venueContextBaseCurrency'),
      notes: t('dashboard.backtests.createForm.notes'),
      notesPlaceholder: t('dashboard.backtests.createForm.notesPlaceholder'),
      suggestedStrategyFallback: t('dashboard.backtests.createForm.suggestedStrategyFallback'),
      suggestedMarketFallback: t('dashboard.backtests.createForm.suggestedMarketFallback'),
    }),
    [t]
  );
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
  const strategyLoadErrorText = copy.strategyLoadError;
  const universesLoadErrorText = copy.universesLoadError;

  useEffect(() => {
    const loadStrategies = async () => {
      setStrategiesLoading(true);
      try {
        const data = await listStrategies();
        setStrategies(data);
        setStrategyId((prev) => prev || data[0]?.id || '');
      } catch (error: unknown) {
        toast.error(strategyLoadErrorText, {
          description: resolveFormErrorMessage(error, strategyLoadErrorText),
        });
        setStrategies([]);
      } finally {
        setStrategiesLoading(false);
      }
    };

    void loadStrategies();
  }, [strategyLoadErrorText]);

  useEffect(() => {
    const loadUniverses = async () => {
      setUniversesLoading(true);
      try {
        const data = await listMarketUniverses();
        setMarketUniverses(data);
        setMarketUniverseId((prev) => prev || data[0]?.id || '');
      } catch (error: unknown) {
        toast.error(universesLoadErrorText, {
          description: resolveFormErrorMessage(error, universesLoadErrorText),
        });
        setMarketUniverses([]);
      } finally {
        setUniversesLoading(false);
      }
    };

    void loadUniverses();
  }, [universesLoadErrorText]);

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
        selectedStrategy?.name,
        selectedUniverse?.name,
        selectedStrategy?.interval,
        copy.suggestedStrategyFallback,
        copy.suggestedMarketFallback
      ),
    [
      copy.suggestedMarketFallback,
      copy.suggestedStrategyFallback,
      selectedStrategy?.interval,
      selectedStrategy?.name,
      selectedUniverse?.name,
    ]
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
    hasFormText(name) &&
    hasFormText(strategyId) &&
    hasFormText(marketUniverseId) &&
    hasValidMaxCandles &&
    hasValidInitialBalance &&
    !submitting &&
    !universesLoading &&
    !strategiesLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !selectedStrategy) return;

    await onSubmit({
      name: normalizeFormText(name),
      timeframe: selectedStrategy.interval,
      strategyId,
      marketUniverseId,
      seedConfig: {
        maxCandles: parsedMaxCandles,
        initialBalance: parsedInitialBalance,
      },
      notes: normalizeFormText(notes) || undefined,
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
              <TextField
                id='backtest-run-name'
                label={copy.runName}
                value={name}
                onChange={(value) => {
                  setName(value);
                  setNameEdited(true);
                }}
                placeholder={copy.runNamePlaceholder}
              />

              <FormField label={copy.strategy}>
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
              </FormField>

              <FormField label={copy.marketGroup}>
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
              </FormField>

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
              <FormField label={copy.maxCandles}>
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
              </FormField>

              <FormField label={copy.initialBalance}>
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
              </FormField>

              <div className='md:col-span-2'>
                <FormField label={copy.notes}>
                  <textarea
                    className='textarea textarea-bordered min-h-24'
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={copy.notesPlaceholder}
                  />
                </FormField>
              </div>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}

