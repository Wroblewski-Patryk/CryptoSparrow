'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuFilter, LuList } from 'react-icons/lu';
import { FormField, SelectField, TextField } from '@/ui/forms';
import SearchableMultiSelect, { MultiSelectOption } from './SearchableMultiSelect';
import { fetchMarketCatalog } from '../services/markets.service';
import { CreateMarketUniverseInput, MarketCatalogEntry, MarketUniverse } from '../types/marketUniverse.type';
import { composeMarketUniverseSymbols, uniqueSortedSymbols } from '../utils/marketUniverseHelpers';
import {
  hasFormText,
  normalizeFormBaseCurrency,
  normalizeFormSymbol,
  normalizeFormText,
  resolveFormErrorMessage,
} from '@/lib/forms';
import {
  EXCHANGE_OPTIONS,
  ExchangeOption,
  supportsExchangeCapability,
} from '@/features/exchanges/exchangeCapabilities';
import { EXCHANGE_MARKET_TYPES, type ExchangeMarketType } from '@cryptosparrow/shared';
import { useI18n } from '@/i18n/I18nProvider';

const MARKET_TYPES: ExchangeMarketType[] = [...EXCHANGE_MARKET_TYPES];
const EXCHANGES: ExchangeOption[] = [...EXCHANGE_OPTIONS];

const formatVolumeLabel = (value: number, template: string) => {
  const formatValue = () => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(0);
  };
  return template.replace('{value}', formatValue());
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
  const { t } = useI18n();
  const labels = useMemo(
    () => ({
      loadCatalogError: t('dashboard.markets.form.loadCatalogError'),
      sectionTitle: t('dashboard.markets.form.sectionTitle'),
      modeEdit: t('dashboard.markets.form.modeEdit'),
      modeCreate: t('dashboard.markets.form.modeCreate'),
      groupName: t('dashboard.markets.form.groupName'),
      groupNamePlaceholder: t('dashboard.markets.form.groupNamePlaceholder'),
      groupNameError: t('dashboard.markets.form.groupNameError'),
      exchange: t('dashboard.markets.form.exchange'),
      marketType: t('dashboard.markets.form.marketType'),
      baseCurrency: t('dashboard.markets.form.baseCurrency'),
      placeholderBadge: t('dashboard.markets.form.placeholderBadge'),
      placeholderDescription: t('dashboard.markets.form.placeholderDescription'),
      volumeFilterLabel: t('dashboard.markets.form.volumeFilterLabel'),
      volumeFilterEnabled: t('dashboard.markets.form.volumeFilterEnabled'),
      volumeFilterDisabled: t('dashboard.markets.form.volumeFilterDisabled'),
      minVolume: t('dashboard.markets.form.minVolume'),
      maxVolume: t('dashboard.markets.form.maxVolume'),
      availableAfterFilter: t('dashboard.markets.form.availableAfterFilter'),
      symbolSelectionTitle: t('dashboard.markets.form.symbolSelectionTitle'),
      selectAll: t('dashboard.markets.form.selectAll'),
      clearAll: t('dashboard.markets.form.clearAll'),
      whitelistCount: t('dashboard.markets.form.whitelistCount'),
      blacklistCount: t('dashboard.markets.form.blacklistCount'),
      resultCount: t('dashboard.markets.form.resultCount'),
      whitelistLabel: t('dashboard.markets.form.whitelistLabel'),
      blacklistLabel: t('dashboard.markets.form.blacklistLabel'),
      whitelistEmpty: t('dashboard.markets.form.whitelistEmpty'),
      blacklistEmpty: t('dashboard.markets.form.blacklistEmpty'),
      catalogLoading: t('dashboard.markets.form.catalogLoading'),
      previewTitle: t('dashboard.markets.form.previewTitle'),
      marketsCount: t('dashboard.markets.form.marketsCount'),
      previewHint: t('dashboard.markets.form.previewHint'),
      previewEmptyWarning: t('dashboard.markets.form.previewEmptyWarning'),
      previewSearchPlaceholder: t('dashboard.markets.form.previewSearchPlaceholder'),
      previewNoMarkets: t('dashboard.markets.form.previewNoMarkets'),
      volumeLabelTemplate: t('dashboard.markets.form.volumeLabelTemplate'),
      volumeFilterOff: t('dashboard.markets.form.volumeFilterOff'),
      legacySymbolDescription: t('dashboard.markets.form.legacySymbolDescription'),
      multiSelectSummaryLabel: t('dashboard.markets.form.multiSelectSummaryLabel'),
      multiSelectSelectedCount: t('dashboard.markets.form.multiSelectSelectedCount'),
      multiSelectPlaceholder: t('dashboard.markets.form.multiSelectPlaceholder'),
      multiSelectSearch: t('dashboard.markets.form.multiSelectSearch'),
      multiSelectSelectFiltered: t('dashboard.markets.form.multiSelectSelectFiltered'),
      multiSelectClear: t('dashboard.markets.form.multiSelectClear'),
    }),
    [t]
  );

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ExchangeOption>(initial?.exchange ?? 'BINANCE');
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>(initial?.marketType ?? 'FUTURES');
  const [baseCurrency, setBaseCurrency] = useState(normalizeFormBaseCurrency(initial?.baseCurrency));
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
    setBaseCurrency(normalizeFormBaseCurrency(initial.baseCurrency));
    setWhitelistSymbols(uniqueSortedSymbols(initial.whitelist));
    setBlacklistSymbols(uniqueSortedSymbols(initial.blacklist));
    setMinQuoteVolumeEnabled(resolveSavedVolumeEnabled(initial));
    setMinQuoteVolume(resolveSavedMinVolume(initial));
  }, [initial]);

  const loadCatalog = useCallback(
    async (params?: {
      requestedExchange?: ExchangeOption;
      requestedBaseCurrency?: string;
      requestedMarketType?: ExchangeMarketType;
    }) => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const catalog = await fetchMarketCatalog({
          exchange: params?.requestedExchange ?? exchange,
          baseCurrency: params?.requestedBaseCurrency,
          marketType: params?.requestedMarketType ?? marketType,
        });

        const normalizedBaseCurrency = normalizeFormBaseCurrency(catalog.baseCurrency);
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
              symbol: normalizeFormSymbol(market.symbol),
              displaySymbol: market.displaySymbol || normalizeFormSymbol(market.symbol),
            }))
            .sort((a, b) => a.symbol.localeCompare(b.symbol))
        );
      } catch (err: unknown) {
        const message = resolveFormErrorMessage(err, labels.loadCatalogError);
        setCatalogError(message);
      } finally {
        setCatalogLoading(false);
      }
    },
    [exchange, labels.loadCatalogError, marketType]
  );

  useEffect(() => {
    void loadCatalog({
      requestedExchange: initial?.exchange ?? 'BINANCE',
      requestedBaseCurrency: normalizeFormSymbol(initial?.baseCurrency) || undefined,
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
    const baseCurrencyKey = normalizeFormBaseCurrency(initial.baseCurrency);
    return `${exchangeKey}|${marketTypeKey}|${baseCurrencyKey}`;
  }, [initial]);
  const currentContextKey = useMemo(
    () => `${exchange}|${marketType}|${normalizeFormBaseCurrency(baseCurrency)}`,
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
        description: formatVolumeLabel(market.quoteVolume24h, labels.volumeLabelTemplate),
      })),
    [filteredCatalogMarkets, labels.volumeLabelTemplate]
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
        description: labels.legacySymbolDescription,
      }));
  }, [blacklistSymbols, labels.legacySymbolDescription, marketOptionSymbols, whitelistSymbols]);
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

  const previewSymbols = useMemo(
    () =>
      composeMarketUniverseSymbols({
        catalogSymbols: availableSymbols,
        whitelistSymbols,
        blacklistSymbols,
      }),
    [availableSymbols, blacklistSymbols, whitelistSymbols]
  );

  const previewFiltered = useMemo(() => {
    const q = normalizeFormSymbol(previewQuery);
    if (!q) return previewSymbols;
    return previewSymbols.filter((symbol) => symbol.includes(q));
  }, [previewQuery, previewSymbols]);

  const canSubmit = useMemo(
    () =>
      hasFormText(name) &&
      !submitting &&
      (previewSymbols.length > 0 || !exchangeSupportsMarketCatalog),
    [exchangeSupportsMarketCatalog, name, previewSymbols.length, submitting]
  );
  const exchangeOptions = useMemo(
    () => EXCHANGES.map((item) => ({ value: item, label: item })),
    []
  );
  const marketTypeOptions = useMemo(
    () => MARKET_TYPES.map((item) => ({ value: item, label: item })),
    []
  );
  const baseCurrencyOptions = useMemo(
    () => baseCurrencies.map((item) => ({ value: item, label: item })),
    [baseCurrencies]
  );

  const handleBaseCurrencyChange = async (nextBaseCurrency: string) => {
    const normalizedBaseCurrency = normalizeFormBaseCurrency(nextBaseCurrency);
    setBaseCurrency(normalizedBaseCurrency);
    await loadCatalog({
      requestedExchange: exchange,
      requestedBaseCurrency: normalizedBaseCurrency,
      requestedMarketType: marketType,
    });
  };

  const handleMarketTypeChange = async (nextMarketType: string) => {
    const parsed: ExchangeMarketType = nextMarketType === 'SPOT' ? 'SPOT' : 'FUTURES';
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
      name: normalizeFormText(name),
      exchange,
      marketType,
      baseCurrency: normalizeFormBaseCurrency(baseCurrency),
      filterRules: {
        minQuoteVolumeEnabled,
        ...(minQuoteVolumeEnabled ? { minQuoteVolume24h: minQuoteVolume } : {}),
      },
      whitelist: payloadWhitelist,
      blacklist: payloadBlacklist,
    });
  };

  const sliderStep = Math.max(1, Math.floor(maxQuoteVolume / 200));
  const hasNameError = showValidation && !hasFormText(name);
  const hasSymbolsError = showValidation && exchangeSupportsMarketCatalog && previewSymbols.length === 0;

  return (
    <form id={formId} onSubmit={handleSubmit} className='space-y-4'>
      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-3 flex items-center gap-2'>
          <LuFilter className='h-4 w-4 text-primary' aria-hidden />
          <h2 className='text-base font-semibold'>{labels.sectionTitle}</h2>
          <span className='badge badge-ghost badge-sm'>
            {mode === 'edit' ? labels.modeEdit : labels.modeCreate}
          </span>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          <div className='md:col-span-2'>
            <TextField
              id='market-universe-name'
              label={labels.groupName}
              placeholder={labels.groupNamePlaceholder}
              value={name}
              onChange={setName}
              error={hasNameError ? labels.groupNameError : undefined}
            />
          </div>
          <SelectField
            id='market-universe-exchange'
            label={labels.exchange}
            value={exchange}
            options={exchangeOptions}
            onChange={(next) => void handleExchangeChange(next)}
            disabled={catalogLoading}
          />
          <SelectField
            id='market-universe-market-type'
            label={labels.marketType}
            value={marketType}
            options={marketTypeOptions}
            onChange={(next) => void handleMarketTypeChange(next)}
            disabled={catalogLoading}
          />
          <SelectField
            id='market-universe-base-currency'
            label={labels.baseCurrency}
            value={baseCurrency}
            options={baseCurrencyOptions}
            onChange={(next) => void handleBaseCurrencyChange(next)}
            disabled={catalogLoading || baseCurrencies.length === 0}
          />
        </div>

        {!exchangeSupportsMarketCatalog ? (
          <div className='alert alert-warning mt-3 text-sm'>
            <div className='space-y-1'>
              <span className='badge badge-xs badge-warning badge-outline'>{labels.placeholderBadge}</span>
              <span>{labels.placeholderDescription}</span>
            </div>
          </div>
        ) : null}

        <div className='mt-4 rounded-xl border border-base-300 bg-base-200 p-3'>
          <div className='grid gap-3 lg:grid-cols-2'>
            <FormField label={labels.volumeFilterLabel}>
              <div className='space-y-2'>
                <label className='label cursor-pointer justify-start gap-3 p-0'>
                  <input
                    type='checkbox'
                    className='toggle toggle-primary toggle-sm'
                    checked={minQuoteVolumeEnabled}
                    onChange={(event) => setMinQuoteVolumeEnabled(event.target.checked)}
                  />
                  <span className='label-text'>
                    {minQuoteVolumeEnabled ? labels.volumeFilterEnabled : labels.volumeFilterDisabled}
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
            </FormField>
            <div className='rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm'>
              <p>
                {labels.minVolume}:{' '}
                <span className='font-mono'>
                  {minQuoteVolumeEnabled
                    ? formatVolumeLabel(minQuoteVolume, labels.volumeLabelTemplate)
                    : labels.volumeFilterOff}
                </span>
              </p>
              <p>
                {labels.maxVolume}:{' '}
                <span className='font-mono'>{formatVolumeLabel(maxQuoteVolume, labels.volumeLabelTemplate)}</span>
              </p>
              <p className='opacity-70'>{labels.availableAfterFilter}: {marketOptions.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-3 flex items-center justify-between gap-2'>
          <p className='flex items-center gap-2 text-base font-semibold'>
            <LuList className='h-4 w-4 text-primary' aria-hidden />
            {labels.symbolSelectionTitle}
          </p>
          <div className='flex gap-2'>
            <button
              type='button'
              className='btn btn-xs btn-outline'
              onClick={selectAllFromBaseCurrency}
              disabled={availableSymbols.length === 0}
            >
              {labels.selectAll}
            </button>
            <button type='button' className='btn btn-xs btn-outline' onClick={clearAllSelections}>
              {labels.clearAll}
            </button>
          </div>
        </div>

        <div className='mb-3 flex flex-wrap gap-2 text-xs'>
          <span className='badge badge-outline'>{labels.whitelistCount}: {whitelistSymbols.length}</span>
          <span className='badge badge-outline'>{labels.blacklistCount}: {blacklistSymbols.length}</span>
          <span className='badge badge-primary badge-outline'>{labels.resultCount}: {previewSymbols.length}</span>
        </div>

        <div className='grid gap-3 xl:grid-cols-2'>
          <SearchableMultiSelect
            label={labels.whitelistLabel}
            options={selectionOptions}
            selectedValues={whitelistSymbols}
            onChange={setWhitelistSymbols}
            emptyText={labels.whitelistEmpty}
            selectedSummaryLabel={labels.multiSelectSummaryLabel}
            selectedCountLabel={labels.multiSelectSelectedCount}
            placeholderLabel={labels.multiSelectPlaceholder}
            searchPlaceholder={labels.multiSelectSearch}
            selectFilteredLabel={labels.multiSelectSelectFiltered}
            clearLabel={labels.multiSelectClear}
            maxListHeightClassName='max-h-80'
          />
          <SearchableMultiSelect
            label={labels.blacklistLabel}
            options={selectionOptions}
            selectedValues={blacklistSymbols}
            onChange={setBlacklistSymbols}
            emptyText={labels.blacklistEmpty}
            selectedSummaryLabel={labels.multiSelectSummaryLabel}
            selectedCountLabel={labels.multiSelectSelectedCount}
            placeholderLabel={labels.multiSelectPlaceholder}
            searchPlaceholder={labels.multiSelectSearch}
            selectFilteredLabel={labels.multiSelectSelectFiltered}
            clearLabel={labels.multiSelectClear}
            maxListHeightClassName='max-h-80'
          />
        </div>

        {catalogLoading ? <p className='mt-3 text-sm opacity-70'>{labels.catalogLoading}</p> : null}
        {!catalogLoading && catalogError ? <p className='mt-3 text-sm text-error'>{catalogError}</p> : null}
      </section>

      <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4'>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <p className='flex items-center gap-2 text-base font-semibold'>
            <LuCheck className='h-4 w-4 text-primary' aria-hidden />
            {labels.previewTitle}
          </p>
          <span className='text-sm opacity-70'>{labels.marketsCount}: {previewSymbols.length}</span>
        </div>
        <p className='text-xs opacity-70'>
          {labels.previewHint}
        </p>

        {hasSymbolsError ? (
          <div className='alert alert-warning mt-3 py-2 text-sm'>
            {labels.previewEmptyWarning}
          </div>
        ) : null}

        <div className='mt-3'>
          <input
            className='input input-bordered input-sm w-full'
            placeholder={labels.previewSearchPlaceholder}
            value={previewQuery}
            onChange={(event) => setPreviewQuery(event.target.value)}
          />
        </div>

        <div className='mt-3 max-h-72 overflow-y-auto overflow-x-hidden rounded-box border border-base-300 bg-base-200 p-2'>
          {previewFiltered.length === 0 ? (
            <p className='text-sm opacity-70'>{labels.previewNoMarkets}</p>
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
