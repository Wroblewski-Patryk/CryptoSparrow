'use client';

import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LuCheck, LuFilter, LuList } from 'react-icons/lu';
import { FieldWrapper, SelectField, TextInputField } from './FieldControls';
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
import { I18nContext } from '@/i18n/I18nProvider';

const MARKET_TYPES: ExchangeMarketType[] = [...EXCHANGE_MARKET_TYPES];
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
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale ?? 'pl';
  const copy = {
    en: {
      loadCatalogError: 'Could not load market catalog from exchange.',
      sectionTitle: 'Market configuration',
      modeEdit: 'Edit',
      modeCreate: 'Create',
      groupName: 'Group name',
      groupNamePlaceholder: 'Top Futures',
      groupNameError: 'Provide market group name.',
      exchange: 'Exchange',
      marketType: 'Market type',
      baseCurrency: 'Base currency',
      placeholderBadge: 'PLACEHOLDER',
      placeholderDescription:
        'Placeholder exchange selected. Public catalog for this exchange is not implemented yet. You can still save the universe context.',
      volumeFilterLabel: 'Filter: minimum quote volume 24h',
      volumeFilterEnabled: 'Filter enabled',
      volumeFilterDisabled: 'Filter disabled',
      minVolume: 'Min volume',
      maxVolume: 'Max volume',
      availableAfterFilter: 'Available after filter',
      symbolSelectionTitle: 'Symbol selection',
      selectAll: 'Select all',
      clearAll: 'Clear',
      whitelistCount: 'Whitelist',
      blacklistCount: 'Blacklist',
      resultCount: 'Result',
      whitelistLabel: 'Whitelist',
      blacklistLabel: 'Blacklist',
      whitelistEmpty: 'Whitelist is empty.',
      blacklistEmpty: 'Blacklist is empty.',
      catalogLoading: 'Loading market catalog...',
      previewTitle: 'Filtered list preview',
      marketsCount: 'Markets count',
      previewHint: 'Alphabetical order. Applied: market type + base currency + volume + whitelist - blacklist.',
      previewEmptyWarning: 'No symbols after filters. Add whitelist entries or adjust filters.',
      previewSearchPlaceholder: 'Search in list...',
      previewNoMarkets: 'No markets after applying filters.',
    },
    pl: {
      loadCatalogError: 'Nie udalo sie pobrac katalogu rynkow z gieldy.',
      sectionTitle: 'Konfiguracja rynku',
      modeEdit: 'Edycja',
      modeCreate: 'Tworzenie',
      groupName: 'Nazwa grupy',
      groupNamePlaceholder: 'Top Futures',
      groupNameError: 'Podaj nazwe grupy rynkow.',
      exchange: 'Gielda',
      marketType: 'Market type',
      baseCurrency: 'Base currency',
      placeholderBadge: 'PLACEHOLDER',
      placeholderDescription:
        'Wybrano placeholder exchange. Publiczny katalog dla tej gieldy nie jest jeszcze dostepny. Nadal mozesz zapisac kontekst grupy.',
      volumeFilterLabel: 'Filtr: minimalny wolumen quote 24h',
      volumeFilterEnabled: 'Filtr wlaczony',
      volumeFilterDisabled: 'Filtr wylaczony',
      minVolume: 'Min wolumen',
      maxVolume: 'Max wolumen',
      availableAfterFilter: 'Dostepnych po filtrze',
      symbolSelectionTitle: 'Selekcja symboli',
      selectAll: 'Wybierz wszystkie',
      clearAll: 'Wyczysc',
      whitelistCount: 'Whitelist',
      blacklistCount: 'Blacklist',
      resultCount: 'Wynik',
      whitelistLabel: 'Whitelist',
      blacklistLabel: 'Blacklist',
      whitelistEmpty: 'Brak whitelist.',
      blacklistEmpty: 'Brak blacklist.',
      catalogLoading: 'Ladowanie katalogu rynkow...',
      previewTitle: 'Podglad listy po filtrach',
      marketsCount: 'Liczba rynkow',
      previewHint: 'Kolejnosc alfabetyczna. Zastosowano: market type + base currency + volume + whitelist - blacklist.',
      previewEmptyWarning: 'Brak symboli po filtrach. Dodaj whitelist albo zmien filtry.',
      previewSearchPlaceholder: 'Szukaj w liscie...',
      previewNoMarkets: 'Brak rynkow po zastosowaniu filtrow.',
    },
    pt: {
      loadCatalogError: 'Nao foi possivel carregar catalogo de mercados da exchange.',
      sectionTitle: 'Configuracao de mercado',
      modeEdit: 'Editar',
      modeCreate: 'Criar',
      groupName: 'Nome do grupo',
      groupNamePlaceholder: 'Top Futures',
      groupNameError: 'Indica nome do grupo de mercados.',
      exchange: 'Exchange',
      marketType: 'Market type',
      baseCurrency: 'Base currency',
      placeholderBadge: 'PLACEHOLDER',
      placeholderDescription:
        'Exchange placeholder selecionada. Catalogo publico para esta exchange ainda nao esta implementado. Podes guardar o contexto do universo.',
      volumeFilterLabel: 'Filtro: volume quote minimo 24h',
      volumeFilterEnabled: 'Filtro ativo',
      volumeFilterDisabled: 'Filtro inativo',
      minVolume: 'Volume min',
      maxVolume: 'Volume max',
      availableAfterFilter: 'Disponiveis apos filtro',
      symbolSelectionTitle: 'Selecao de simbolos',
      selectAll: 'Selecionar todos',
      clearAll: 'Limpar',
      whitelistCount: 'Whitelist',
      blacklistCount: 'Blacklist',
      resultCount: 'Resultado',
      whitelistLabel: 'Whitelist',
      blacklistLabel: 'Blacklist',
      whitelistEmpty: 'Whitelist vazia.',
      blacklistEmpty: 'Blacklist vazia.',
      catalogLoading: 'A carregar catalogo de mercados...',
      previewTitle: 'Pre-visualizacao apos filtros',
      marketsCount: 'Numero de mercados',
      previewHint: 'Ordem alfabetica. Aplicado: market type + base currency + volume + whitelist - blacklist.',
      previewEmptyWarning: 'Sem simbolos apos filtros. Adiciona whitelist ou ajusta filtros.',
      previewSearchPlaceholder: 'Pesquisar na lista...',
      previewNoMarkets: 'Sem mercados apos aplicar filtros.',
    },
  } as const;
  const labels = copy[locale];

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
            <TextInputField label={labels.groupName} placeholder={labels.groupNamePlaceholder} value={name} onChange={setName} />
            {hasNameError ? <p className='mt-1 text-xs text-error'>{labels.groupNameError}</p> : null}
          </div>
          <SelectField
            label={labels.exchange}
            value={exchange}
            options={EXCHANGES}
            onChange={(next) => void handleExchangeChange(next)}
            disabled={catalogLoading}
          />
          <SelectField
            label={labels.marketType}
            value={marketType}
            options={MARKET_TYPES}
            onChange={(next) => void handleMarketTypeChange(next)}
            disabled={catalogLoading}
          />
          <SelectField
            label={labels.baseCurrency}
            value={baseCurrency}
            options={baseCurrencies}
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
            <FieldWrapper label={labels.volumeFilterLabel}>
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
            </FieldWrapper>
            <div className='rounded-box border border-base-300 bg-base-100 px-3 py-2 text-sm'>
              <p>
                {labels.minVolume}:{' '}
                <span className='font-mono'>
                  {minQuoteVolumeEnabled ? formatVolumeLabel(minQuoteVolume) : 'OFF'}
                </span>
              </p>
              <p>
                {labels.maxVolume}: <span className='font-mono'>{formatVolumeLabel(maxQuoteVolume)}</span>
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
            maxListHeightClassName='max-h-80'
          />
          <SearchableMultiSelect
            label={labels.blacklistLabel}
            options={selectionOptions}
            selectedValues={blacklistSymbols}
            onChange={setBlacklistSymbols}
            emptyText={labels.blacklistEmpty}
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
