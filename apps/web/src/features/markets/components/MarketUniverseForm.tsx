'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { LuCheck, LuFilter, LuList } from 'react-icons/lu';
import { FieldWrapper, SelectField, TextInputField } from './FieldControls';
import SearchableMultiSelect, { MultiSelectOption } from './SearchableMultiSelect';
import { fetchMarketCatalog } from '../services/markets.service';
import { CreateMarketUniverseInput, MarketCatalogEntry, MarketUniverse } from '../types/marketUniverse.type';

const MARKET_TYPES: Array<'SPOT' | 'FUTURES'> = ['SPOT', 'FUTURES'];
const EXCHANGES: Array<'BINANCE'> = ['BINANCE'];

const uniqueSorted = (values: string[]) =>
  [...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const response = err.response?.data as { error?: { message?: string }; message?: string } | undefined;
  return response?.error?.message ?? response?.message;
};

const formatVolumeLabel = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'vol 24h: 0';
  if (value >= 1_000_000_000) return `vol 24h: ${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `vol 24h: ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `vol 24h: ${(value / 1_000).toFixed(2)}K`;
  return `vol 24h: ${value.toFixed(0)}`;
};

const resolveSavedMinVolume = (initial?: MarketUniverse | null) => {
  const rules = (initial?.filterRules ?? null) as
    | { minQuoteVolume24h?: number; minVolume24h?: number }
    | null;
  if (!rules) return 0;
  if (typeof rules.minQuoteVolume24h === 'number') return rules.minQuoteVolume24h;
  if (typeof rules.minVolume24h === 'number') return rules.minVolume24h;
  return 0;
};

const resolveSavedVolumeEnabled = (initial?: MarketUniverse | null) => {
  const rules = (initial?.filterRules ?? null) as
    | { minQuoteVolumeEnabled?: boolean; minVolume24h?: number; minQuoteVolume24h?: number }
    | null;
  if (!rules) return false;
  if (typeof rules.minQuoteVolumeEnabled === 'boolean') return rules.minQuoteVolumeEnabled;
  return typeof rules.minQuoteVolume24h === 'number' || typeof rules.minVolume24h === 'number';
};

type MarketUniverseFormProps = {
  mode: 'create' | 'edit';
  initial?: MarketUniverse | null;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: CreateMarketUniverseInput) => Promise<void>;
};

export default function MarketUniverseForm({
  mode,
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: MarketUniverseFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<'BINANCE'>(initial?.exchange ?? 'BINANCE');
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(initial?.marketType ?? 'FUTURES');
  const [baseCurrency, setBaseCurrency] = useState(initial?.baseCurrency ?? 'USDT');
  const [baseCurrencies, setBaseCurrencies] = useState<string[]>([]);
  const [catalogMarkets, setCatalogMarkets] = useState<MarketCatalogEntry[]>([]);

  const [name, setName] = useState(initial?.name ?? '');
  const [whitelistSymbols, setWhitelistSymbols] = useState<string[]>(initial?.whitelist ?? []);
  const [blacklistSymbols, setBlacklistSymbols] = useState<string[]>(initial?.blacklist ?? []);
  const [previewQuery, setPreviewQuery] = useState('');
  const [minQuoteVolumeEnabled, setMinQuoteVolumeEnabled] = useState(resolveSavedVolumeEnabled(initial));
  const [minQuoteVolume, setMinQuoteVolume] = useState(resolveSavedMinVolume(initial));

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setExchange(initial.exchange ?? 'BINANCE');
    setMarketType(initial.marketType);
    setBaseCurrency(initial.baseCurrency);
    setWhitelistSymbols(initial.whitelist);
    setBlacklistSymbols(initial.blacklist);
    setMinQuoteVolumeEnabled(resolveSavedVolumeEnabled(initial));
    setMinQuoteVolume(resolveSavedMinVolume(initial));
  }, [initial]);

  const loadCatalog = useCallback(
    async (params?: {
      requestedExchange?: 'BINANCE';
      requestedBaseCurrency?: string;
      requestedMarketType?: 'SPOT' | 'FUTURES';
    }) => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const catalog = await fetchMarketCatalog({
          exchange: params?.requestedExchange ?? exchange,
          baseCurrency: params?.requestedBaseCurrency,
          marketType: params?.requestedMarketType ?? marketType,
        });

        setExchange((catalog.exchange ?? 'BINANCE') as 'BINANCE');
        setMarketType(catalog.marketType);
        setBaseCurrency(catalog.baseCurrency);
        setBaseCurrencies(catalog.baseCurrencies);
        setCatalogMarkets(catalog.markets.sort((a, b) => a.symbol.localeCompare(b.symbol)));
      } catch (err: unknown) {
        const message = getAxiosMessage(err) ?? 'Nie udalo sie pobrac katalogu rynkow z gieldy.';
        setCatalogError(message);
      } finally {
        setCatalogLoading(false);
      }
    },
    [exchange, marketType]
  );

  useEffect(() => {
    void loadCatalog({
      requestedExchange: initial?.exchange ?? 'BINANCE',
      requestedBaseCurrency: initial?.baseCurrency,
      requestedMarketType: initial?.marketType,
    });
  }, [initial?.baseCurrency, initial?.exchange, initial?.marketType, loadCatalog]);

  const maxQuoteVolume = useMemo(
    () => Math.max(...catalogMarkets.map((market) => market.quoteVolume24h ?? 0), 0),
    [catalogMarkets]
  );

  useEffect(() => {
    if (catalogLoading) return;
    if (maxQuoteVolume <= 0) return;
    if (minQuoteVolume > maxQuoteVolume) {
      setMinQuoteVolume(maxQuoteVolume);
    }
  }, [catalogLoading, maxQuoteVolume, minQuoteVolume]);

  const filteredCatalogMarkets = useMemo(
    () =>
      catalogMarkets.filter((market) =>
        minQuoteVolumeEnabled ? (market.quoteVolume24h ?? 0) >= minQuoteVolume : true
      ),
    [catalogMarkets, minQuoteVolume, minQuoteVolumeEnabled]
  );

  const marketOptions = useMemo<MultiSelectOption[]>(
    () =>
      filteredCatalogMarkets.map((market) => ({
        value: market.symbol,
        label: market.displaySymbol,
        description: formatVolumeLabel(market.quoteVolume24h),
      })),
    [filteredCatalogMarkets]
  );

  useEffect(() => {
    const valid = new Set(marketOptions.map((item) => item.value));
    setWhitelistSymbols((prev) => prev.filter((item) => valid.has(item)));
    setBlacklistSymbols((prev) => prev.filter((item) => valid.has(item)));
  }, [marketOptions]);

  const availableSymbols = useMemo(() => marketOptions.map((option) => option.value), [marketOptions]);

  const previewSymbols = useMemo(() => {
    const include = whitelistSymbols.length > 0 ? whitelistSymbols : availableSymbols;
    const blacklistSet = new Set(blacklistSymbols);

    return uniqueSorted(include).filter((symbol) => !blacklistSet.has(symbol));
  }, [availableSymbols, blacklistSymbols, whitelistSymbols]);

  const previewFiltered = useMemo(() => {
    const q = previewQuery.trim().toUpperCase();
    if (!q) return previewSymbols;
    return previewSymbols.filter((symbol) => symbol.includes(q));
  }, [previewQuery, previewSymbols]);

  const canSubmit = useMemo(
    () => name.trim().length > 0 && !submitting && previewSymbols.length > 0,
    [name, previewSymbols.length, submitting]
  );

  const handleBaseCurrencyChange = async (nextBaseCurrency: string) => {
    setBaseCurrency(nextBaseCurrency);
    await loadCatalog({
      requestedExchange: exchange,
      requestedBaseCurrency: nextBaseCurrency,
      requestedMarketType: marketType,
    });
  };

  const handleMarketTypeChange = async (nextMarketType: string) => {
    const parsed = nextMarketType === 'SPOT' ? 'SPOT' : 'FUTURES';
    setMarketType(parsed);
    setMinQuoteVolume(0);
    await loadCatalog({
      requestedExchange: exchange,
      requestedBaseCurrency: baseCurrency,
      requestedMarketType: parsed,
    });
  };

  const handleExchangeChange = async (nextExchange: string) => {
    const parsed = nextExchange === 'BINANCE' ? 'BINANCE' : 'BINANCE';
    setExchange(parsed);
    await loadCatalog({
      requestedExchange: parsed,
      requestedBaseCurrency: baseCurrency,
      requestedMarketType: marketType,
    });
  };

  const selectAllFromBaseCurrency = () => {
    setWhitelistSymbols(availableSymbols);
  };

  const clearAllSelections = () => {
    setWhitelistSymbols([]);
    setBlacklistSymbols([]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const mergedWhitelist = uniqueSorted(whitelistSymbols);
    const mergedBlacklistSet = new Set(uniqueSorted(blacklistSymbols));
    const payloadWhitelist = mergedWhitelist.filter((symbol) => !mergedBlacklistSet.has(symbol));
    const payloadBlacklist = [...mergedBlacklistSet].sort((a, b) => a.localeCompare(b));

    await onSubmit({
      name: name.trim(),
      exchange,
      marketType,
      baseCurrency: baseCurrency.trim().toUpperCase(),
      filterRules: {
        minQuoteVolumeEnabled,
        ...(minQuoteVolumeEnabled ? { minQuoteVolume24h: minQuoteVolume } : {}),
      },
      whitelist: payloadWhitelist,
      blacklist: payloadBlacklist,
    });
  };

  const sliderStep = Math.max(1, Math.floor(maxQuoteVolume / 200));

  const steps = [
    { label: 'Konfiguracja rynku', icon: <LuFilter className='h-5 w-5' /> },
    { label: 'Selekcja symboli', icon: <LuList className='h-5 w-5' /> },
    { label: mode === 'create' ? 'Tworzenie grupy' : 'Edycja grupy', icon: <LuCheck className='h-5 w-5' /> },
  ];

  return (
    <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-6 md:grid-cols-4'>
      <aside className='md:col-span-1'>
        <h2 className='text-2xl font-semibold'>Kreator grup rynkow</h2>
        <ul className='steps steps-vertical mt-4'>
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={`step cursor-pointer ${index <= currentStep ? 'step-primary' : ''}`}
              onClick={() => setCurrentStep(index)}
            >
              <span className='step-icon'>{step.icon}</span>
              <span className='hidden md:inline'>{step.label}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className='space-y-4 md:col-span-3'>
        <div className='flex items-center gap-2'>
          <h2 className='text-2xl flex items-center gap-3'>
            <span className='text-primary'>{steps[currentStep].icon}</span>
            {steps[currentStep].label}
          </h2>
          <button type='submit' className='btn btn-success ml-auto btn-sm' disabled={!canSubmit}>
            {submitting ? 'Zapisywanie...' : submitLabel}
          </button>
        </div>
        <hr className='border-t border-base-200' />

        {currentStep === 0 ? (
          <div className='rounded-xl border border-base-300 bg-base-100 p-4'>
            <div className='grid gap-3 md:grid-cols-4'>
              <TextInputField label='Nazwa grupy' placeholder='Top Futures' value={name} onChange={setName} />
              <SelectField
                label='Gielda'
                value={exchange}
                options={EXCHANGES}
                onChange={(next) => void handleExchangeChange(next)}
                disabled={catalogLoading}
              />
              <SelectField
                label='Market type'
                value={marketType}
                options={MARKET_TYPES}
                onChange={(next) => void handleMarketTypeChange(next)}
                disabled={catalogLoading}
              />
              <SelectField
                label='Base currency'
                value={baseCurrency}
                options={baseCurrencies}
                onChange={(next) => void handleBaseCurrencyChange(next)}
                disabled={catalogLoading || baseCurrencies.length === 0}
              />
            </div>

            <div className='mt-4 rounded-xl border border-base-300 bg-base-200 p-3'>
              <div className='grid gap-3 lg:grid-cols-2'>
                <FieldWrapper label='Filtr: minimalny wolumen quote 24h'>
                  <div className='space-y-2'>
                    <label className='label cursor-pointer justify-start gap-3 p-0'>
                      <input
                        type='checkbox'
                        className='toggle toggle-primary toggle-sm'
                        checked={minQuoteVolumeEnabled}
                        onChange={(event) => setMinQuoteVolumeEnabled(event.target.checked)}
                      />
                      <span className='label-text'>
                        {minQuoteVolumeEnabled ? 'Filtr wlaczony' : 'Filtr wylaczony'}
                      </span>
                    </label>
                    <input
                      type='range'
                      min={0}
                      max={maxQuoteVolume}
                      step={sliderStep}
                      className='range range-primary range-sm'
                      value={minQuoteVolume}
                      onChange={(event) => setMinQuoteVolume(Number.parseInt(event.target.value, 10) || 0)}
                      disabled={!minQuoteVolumeEnabled}
                    />
                  </div>
                </FieldWrapper>
                <div className='rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm'>
                  <p>
                    Min wolumen:{' '}
                    <span className='font-mono'>
                      {minQuoteVolumeEnabled ? formatVolumeLabel(minQuoteVolume) : 'OFF'}
                    </span>
                  </p>
                  <p>
                    Max wolumen: <span className='font-mono'>{formatVolumeLabel(maxQuoteVolume)}</span>
                  </p>
                  <p className='opacity-70'>Dostepnych po filtrze: {marketOptions.length}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <>
            <div className='rounded-xl border border-base-300 bg-base-100 p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-medium'>Szybki wybor wszystkich symboli z aktualnego filtra</p>
                <div className='flex gap-2'>
                  <button
                    type='button'
                    className='btn btn-xs btn-outline'
                    onClick={selectAllFromBaseCurrency}
                    disabled={availableSymbols.length === 0}
                  >
                    Wybierz wszystkie
                  </button>
                  <button type='button' className='btn btn-xs btn-outline' onClick={clearAllSelections}>
                    Wyczysc
                  </button>
                </div>
              </div>

              <div className='mt-3 grid gap-3 xl:grid-cols-2'>
                <SearchableMultiSelect
                  label='Whitelist'
                  options={marketOptions}
                  selectedValues={whitelistSymbols}
                  onChange={setWhitelistSymbols}
                  emptyText='Brak whitelist.'
                  maxListHeightClassName='max-h-80'
                />
                <SearchableMultiSelect
                  label='Blacklist'
                  options={marketOptions}
                  selectedValues={blacklistSymbols}
                  onChange={setBlacklistSymbols}
                  emptyText='Brak blacklist.'
                  maxListHeightClassName='max-h-80'
                />
              </div>
            </div>

            {catalogLoading && <p className='text-sm opacity-70'>Ladowanie katalogu rynkow...</p>}
            {!catalogLoading && catalogError && <p className='text-sm text-error'>{catalogError}</p>}
          </>
        ) : null}

        {currentStep === 2 ? (
          <div className='rounded-xl border border-base-300 bg-base-100 p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h3 className='font-semibold'>Podglad listy po filtrach</h3>
              <span className='text-sm opacity-70'>Liczba rynkow: {previewSymbols.length}</span>
            </div>
            <p className='mt-1 text-xs opacity-70'>
              Kolejnosc alfabetyczna. Zastosowano: market type + base currency + volume + whitelist - blacklist.
            </p>

            <div className='mt-3'>
              <input
                className='input input-bordered input-sm w-full'
                placeholder='Szukaj w liscie...'
                value={previewQuery}
                onChange={(event) => setPreviewQuery(event.target.value)}
              />
            </div>

            <div className='mt-3 max-h-72 overflow-y-auto overflow-x-hidden rounded-box border border-base-300 bg-base-200 p-2'>
              {previewFiltered.length === 0 ? (
                <p className='text-sm opacity-70'>Brak rynkow po zastosowaniu filtrow.</p>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {previewFiltered.map((symbol) => (
                    <span key={symbol} className='badge badge-outline font-mono'>
                      {symbol}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <hr className='border-t border-base-200' />

        <div className='flex justify-between'>
          <button
            type='button'
            className='btn'
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          >
            Wstecz
          </button>
          <button
            type='button'
            className='btn btn-primary'
            disabled={currentStep === steps.length - 1}
            onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
          >
            Dalej
          </button>
        </div>
      </section>
    </form>
  );
}
