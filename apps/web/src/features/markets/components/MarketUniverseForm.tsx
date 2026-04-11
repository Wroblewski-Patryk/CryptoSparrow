'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuFilter, LuList } from 'react-icons/lu';
import { FieldWrapper, SelectField, TextInputField } from './FieldControls';
import SearchableMultiSelect, { MultiSelectOption } from './SearchableMultiSelect';
import { fetchMarketCatalog } from '../services/markets.service';
import { CreateMarketUniverseInput, MarketCatalogEntry, MarketUniverse } from '../types/marketUniverse.type';
import { uniqueSortedSymbols } from '../utils/marketUniverseHelpers';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeSymbol } from '@/lib/symbols';
import {
  EXCHANGE_OPTIONS,
  ExchangeOption,
  supportsExchangeCapability,
} from '@/features/exchanges/exchangeCapabilities';

const MARKET_TYPES: Array<'SPOT' | 'FUTURES'> = ['SPOT', 'FUTURES'];
const EXCHANGES: ExchangeOption[] = [...EXCHANGE_OPTIONS];

const formatVolumeLabel = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'vol 24h: 0';
  if (value >= 1_000_000_000) return `vol 24h: ${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `vol 24h: ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `vol 24h: ${(value / 1_000).toFixed(2)}K`;
  return `vol 24h: ${value.toFixed(0)}`;
};
const LEGACY_SYMBOL_DESCRIPTION = 'Poza aktualnym katalogiem (zapisane w grupie)';

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
  formId?: string;
  submitting: boolean;
  onSubmit: (payload: CreateMarketUniverseInput) => Promise<void>;
};

export default function MarketUniverseForm({
  mode,
  initial,
  formId = 'market-universe-form',
  submitting,
  onSubmit,
}: MarketUniverseFormProps) {
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ExchangeOption>(initial?.exchange ?? 'BINANCE');
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(initial?.marketType ?? 'FUTURES');
  const [baseCurrency, setBaseCurrency] = useState(normalizeSymbol(initial?.baseCurrency) || 'USDT');
  const [baseCurrencies, setBaseCurrencies] = useState<string[]>([]);
  const [catalogMarkets, setCatalogMarkets] = useState<MarketCatalogEntry[]>([]);

  const [name, setName] = useState(initial?.name ?? '');
  const [whitelistSymbols, setWhitelistSymbols] = useState<string[]>(uniqueSortedSymbols(initial?.whitelist ?? []));
  const [blacklistSymbols, setBlacklistSymbols] = useState<string[]>(uniqueSortedSymbols(initial?.blacklist ?? []));
  const [previewQuery, setPreviewQuery] = useState('');
  const [minQuoteVolumeEnabled, setMinQuoteVolumeEnabled] = useState(resolveSavedVolumeEnabled(initial));
  const [minQuoteVolume, setMinQuoteVolume] = useState(resolveSavedMinVolume(initial));
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setName(initial.name);
    setExchange(initial.exchange ?? 'BINANCE');
    setMarketType(initial.marketType);
    setBaseCurrency(normalizeSymbol(initial.baseCurrency) || 'USDT');
    setWhitelistSymbols(uniqueSortedSymbols(initial.whitelist));
    setBlacklistSymbols(uniqueSortedSymbols(initial.blacklist));
    setMinQuoteVolumeEnabled(resolveSavedVolumeEnabled(initial));
    setMinQuoteVolume(resolveSavedMinVolume(initial));
  }, [initial]);

  const loadCatalog = useCallback(
    async (params?: {
      requestedExchange?: ExchangeOption;
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

        const normalizedBaseCurrency = normalizeSymbol(catalog.baseCurrency) || 'USDT';
        const normalizedBaseCurrencies = uniqueSortedSymbols([
          normalizedBaseCurrency,
          ...(catalog.baseCurrencies ?? []),
        ]);

        setExchange((catalog.exchange ?? 'BINANCE') as ExchangeOption);
        setMarketType(catalog.marketType);
        setBaseCurrency(normalizedBaseCurrency);
        setBaseCurrencies(normalizedBaseCurrencies);
        setCatalogMarkets(
          catalog.markets
            .map((market) => ({
              ...market,
              symbol: normalizeSymbol(market.symbol),
              displaySymbol: market.displaySymbol || normalizeSymbol(market.symbol),
            }))
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
        );
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
      requestedBaseCurrency: normalizeSymbol(initial?.baseCurrency) || undefined,
      requestedMarketType: initial?.marketType,
    });
  }, [initial?.baseCurrency, initial?.exchange, initial?.marketType, loadCatalog]);

  const exchangeSupportsMarketCatalog = useMemo(
    () => supportsExchangeCapability(exchange, 'MARKET_CATALOG'),
    [exchange]
  );
  const initialContextKey = useMemo(() => {
    if (!initial) return null;
    const exchangeKey = initial.exchange ?? 'BINANCE';
    const marketTypeKey = initial.marketType ?? 'FUTURES';
    const baseCurrencyKey = normalizeSymbol(initial.baseCurrency);
    return `${exchangeKey}|${marketTypeKey}|${baseCurrencyKey}`;
  }, [initial]);
  const currentContextKey = useMemo(
    () => `${exchange}|${marketType}|${normalizeSymbol(baseCurrency)}`,
    [baseCurrency, exchange, marketType]
  );
  const shouldPreserveInitialSelections =
    mode === 'edit' && initialContextKey != null && initialContextKey === currentContextKey;

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
  const marketOptionSymbols = useMemo(
    () => new Set(marketOptions.map((option) => option.value)),
    [marketOptions]
  );
  const persistedSelectionOptions = useMemo<MultiSelectOption[]>(() => {
    const savedSymbols = uniqueSortedSymbols([...whitelistSymbols, ...blacklistSymbols]);
    return savedSymbols
      .filter((symbol) => !marketOptionSymbols.has(symbol))
      .map((symbol) => ({
        value: symbol,
        label: symbol,
        description: LEGACY_SYMBOL_DESCRIPTION,
      }));
  }, [blacklistSymbols, marketOptionSymbols, whitelistSymbols]);
  const selectionOptions = useMemo<MultiSelectOption[]>(
    () => [...marketOptions, ...persistedSelectionOptions],
    [marketOptions, persistedSelectionOptions]
  );

  useEffect(() => {
    if (catalogLoading) return;
    if (shouldPreserveInitialSelections) return;
    const valid = new Set(marketOptions.map((item) => item.value));
    setWhitelistSymbols((prev) => prev.filter((item) => valid.has(item)));
    setBlacklistSymbols((prev) => prev.filter((item) => valid.has(item)));
  }, [catalogLoading, marketOptions, shouldPreserveInitialSelections]);

  const availableSymbols = useMemo(() => marketOptions.map((option) => option.value), [marketOptions]);

  const previewSymbols = useMemo(() => {
    const include = whitelistSymbols.length > 0 ? whitelistSymbols : availableSymbols;
    const blacklistSet = new Set(blacklistSymbols);
    return uniqueSortedSymbols(include).filter((symbol) => !blacklistSet.has(symbol));
  }, [availableSymbols, blacklistSymbols, whitelistSymbols]);

  const previewFiltered = useMemo(() => {
    const q = normalizeSymbol(previewQuery);
    if (!q) return previewSymbols;
    return previewSymbols.filter((symbol) => symbol.includes(q));
  }, [previewQuery, previewSymbols]);

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      !submitting &&
      (previewSymbols.length > 0 || !exchangeSupportsMarketCatalog),
    [exchangeSupportsMarketCatalog, name, previewSymbols.length, submitting]
  );

  const handleBaseCurrencyChange = async (nextBaseCurrency: string) => {
    const normalizedBaseCurrency = normalizeSymbol(nextBaseCurrency) || 'USDT';
    setBaseCurrency(normalizedBaseCurrency);
    await loadCatalog({
      requestedExchange: exchange,
      requestedBaseCurrency: normalizedBaseCurrency,
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
    const parsed = EXCHANGE_OPTIONS.includes(nextExchange as ExchangeOption)
      ? (nextExchange as ExchangeOption)
      : 'BINANCE';
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
    setShowValidation(true);
    if (!canSubmit) return;

    const mergedWhitelist = uniqueSortedSymbols(whitelistSymbols);
    const mergedBlacklistSet = new Set(uniqueSortedSymbols(blacklistSymbols));
    const payloadWhitelist = mergedWhitelist.filter((symbol) => !mergedBlacklistSet.has(symbol));
    const payloadBlacklist = [...mergedBlacklistSet].sort((a, b) => a.localeCompare(b));

    await onSubmit({
      name: name.trim(),
      exchange,
      marketType,
      baseCurrency: normalizeSymbol(baseCurrency) || 'USDT',
      filterRules: {
        minQuoteVolumeEnabled,
        ...(minQuoteVolumeEnabled ? { minQuoteVolume24h: minQuoteVolume } : {}),
      },
      whitelist: payloadWhitelist,
      blacklist: payloadBlacklist,
    });
  };

  const sliderStep = Math.max(1, Math.floor(maxQuoteVolume / 200));
  const hasNameError = showValidation && !name.trim();
  const hasSymbolsError = showValidation && exchangeSupportsMarketCatalog && previewSymbols.length === 0;

  return (
    <form id={formId} onSubmit={handleSubmit} className='space-y-4'>
      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-3 flex items-center gap-2'>
          <LuFilter className='h-4 w-4 text-primary' aria-hidden />
          <h2 className='text-base font-semibold'>Konfiguracja rynku</h2>
          <span className='badge badge-ghost badge-sm'>
            {mode === 'edit' ? 'Edycja' : 'Tworzenie'}
          </span>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <div className='md:col-span-2'>
            <TextInputField label='Nazwa grupy' placeholder='Top Futures' value={name} onChange={setName} />
            {hasNameError ? <p className='mt-1 text-xs text-error'>Podaj nazwe grupy rynkow.</p> : null}
          </div>
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

        {!exchangeSupportsMarketCatalog ? (
          <div className='alert alert-warning mt-3 text-sm'>
            <div className='space-y-1'>
              <span className='badge badge-xs badge-warning badge-outline'>PLACEHOLDER</span>
              <span>
                Placeholder exchange selected. Public catalog for this exchange is not implemented yet.
                You can still save the universe context.
              </span>
            </div>
          </div>
        ) : null}

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
      </section>

      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <p className='flex items-center gap-2 text-base font-semibold'>
            <LuList className='h-4 w-4 text-primary' aria-hidden />
            Selekcja symboli
          </p>
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

        <div className='mb-3 flex flex-wrap gap-2 text-xs'>
          <span className='badge badge-outline'>Whitelist: {whitelistSymbols.length}</span>
          <span className='badge badge-outline'>Blacklist: {blacklistSymbols.length}</span>
          <span className='badge badge-primary badge-outline'>Wynik: {previewSymbols.length}</span>
        </div>

        <div className='grid gap-3 xl:grid-cols-2'>
          <SearchableMultiSelect
            label='Whitelist'
            options={selectionOptions}
            selectedValues={whitelistSymbols}
            onChange={setWhitelistSymbols}
            emptyText='Brak whitelist.'
            maxListHeightClassName='max-h-80'
          />
          <SearchableMultiSelect
            label='Blacklist'
            options={selectionOptions}
            selectedValues={blacklistSymbols}
            onChange={setBlacklistSymbols}
            emptyText='Brak blacklist.'
            maxListHeightClassName='max-h-80'
          />
        </div>

        {catalogLoading ? <p className='mt-3 text-sm opacity-70'>Ladowanie katalogu rynkow...</p> : null}
        {!catalogLoading && catalogError ? <p className='mt-3 text-sm text-error'>{catalogError}</p> : null}
      </section>

      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <p className='flex items-center gap-2 text-base font-semibold'>
            <LuCheck className='h-4 w-4 text-primary' aria-hidden />
            Podglad listy po filtrach
          </p>
          <span className='text-sm opacity-70'>Liczba rynkow: {previewSymbols.length}</span>
        </div>
        <p className='text-xs opacity-70'>
          Kolejnosc alfabetyczna. Zastosowano: market type + base currency + volume + whitelist - blacklist.
        </p>

        {hasSymbolsError ? (
          <div className='alert alert-warning mt-3 py-2 text-sm'>
            Brak symboli po filtrach. Dodaj whitelist albo zmien filtry.
          </div>
        ) : null}

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
      </section>
    </form>
  );
}
