'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../../ui/components/ViewState';
import { useLocaleFormatting } from '../../../i18n/useLocaleFormatting';
import {
  EXCHANGE_OPTIONS,
  ExchangeOption,
  supportsExchangeCapability,
} from '@/features/exchanges/exchangeCapabilities';
import { FieldWrapper, SelectField, TextInputField } from './FieldControls';
import SearchableMultiSelect, { MultiSelectOption } from './SearchableMultiSelect';
import {
  createMarketUniverse,
  deleteMarketUniverse,
  fetchMarketCatalog,
  listMarketUniverses,
} from '../services/markets.service';
import { MarketCatalogEntry, MarketUniverse } from '../types/marketUniverse.type';

const MARKET_TYPES: Array<'SPOT' | 'FUTURES'> = ['SPOT', 'FUTURES'];
const EXCHANGES: ExchangeOption[] = [...EXCHANGE_OPTIONS];

const uniqueSorted = (values: string[]) =>
  [...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

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

export default function MarketsFlow() {
  const { formatDate } = useLocaleFormatting();
  const [universes, setUniverses] = useState<MarketUniverse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [exchange, setExchange] = useState<ExchangeOption>('BINANCE');
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>('FUTURES');
  const [baseCurrency, setBaseCurrency] = useState('USDT');
  const [baseCurrencies, setBaseCurrencies] = useState<string[]>([]);
  const [catalogMarkets, setCatalogMarkets] = useState<MarketCatalogEntry[]>([]);

  const [name, setName] = useState('');
  const [whitelistSymbols, setWhitelistSymbols] = useState<string[]>([]);
  const [blacklistSymbols, setBlacklistSymbols] = useState<string[]>([]);
  const [previewQuery, setPreviewQuery] = useState('');
  const [minQuoteVolumeMillions, setMinQuoteVolumeMillions] = useState(0);

  const loadUniverses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMarketUniverses();
      setUniverses(data);
    } catch (err: unknown) {
      const message = getAxiosMessage(err) ?? 'Nie udalo sie pobrac listy market universes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async (params?: {
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

      setExchange((catalog.exchange ?? 'BINANCE') as ExchangeOption);
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
  }, [exchange, marketType]);

  useEffect(() => {
    void loadUniverses();
    void loadCatalog();
  }, [loadCatalog, loadUniverses]);

  const maxQuoteVolumeMillions = useMemo(() => {
    const maxVolume = Math.max(...catalogMarkets.map((market) => market.quoteVolume24h ?? 0), 0);
    return Math.max(1, Math.ceil(maxVolume / 1_000_000));
  }, [catalogMarkets]);

  const minQuoteVolume = minQuoteVolumeMillions * 1_000_000;

  const filteredCatalogMarkets = useMemo(
    () => catalogMarkets.filter((market) => (market.quoteVolume24h ?? 0) >= minQuoteVolume),
    [catalogMarkets, minQuoteVolume]
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

  const exchangeSupportsMarketCatalog = useMemo(
    () => supportsExchangeCapability(exchange, 'MARKET_CATALOG'),
    [exchange]
  );

  const canSubmit = useMemo(
    () => name.trim().length > 0 && !creating && (previewSymbols.length > 0 || !exchangeSupportsMarketCatalog),
    [creating, exchangeSupportsMarketCatalog, name, previewSymbols.length]
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
    setMinQuoteVolumeMillions(0);
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

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setCreating(true);
    try {
      const mergedWhitelist = uniqueSorted(whitelistSymbols);
      const mergedBlacklistSet = new Set(uniqueSorted(blacklistSymbols));
      const payloadWhitelist = mergedWhitelist.filter((symbol) => !mergedBlacklistSet.has(symbol));
      const payloadBlacklist = [...mergedBlacklistSet].sort((a, b) => a.localeCompare(b));

      const created = await createMarketUniverse({
        name: name.trim(),
        exchange,
        marketType,
        baseCurrency: baseCurrency.trim().toUpperCase(),
        whitelist: payloadWhitelist,
        blacklist: payloadBlacklist,
      });

      setUniverses((prev) => [created, ...prev]);
      setName('');
      clearAllSelections();
      setPreviewQuery('');
      toast.success('Market universe utworzony');
    } catch (err: unknown) {
      toast.error('Nie udalo sie utworzyc market universe', {
        description: getAxiosMessage(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMarketUniverse(id);
      setUniverses((prev) => prev.filter((item) => item.id !== id));
      toast.success('Market universe usuniety');
    } catch (err: unknown) {
      toast.error('Nie udalo sie usunac market universe', {
        description: getAxiosMessage(err),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className='space-y-5'>
      <form onSubmit={handleCreate} className='rounded-box border border-base-300/60 bg-base-200/60 p-4'>
        <h2 className='text-lg font-semibold'>Kreator grup rynkow dla bota</h2>
        <p className='text-sm opacity-70'>Wybierz market type, base currency i zbuduj grupe symboli pod bota.</p>

        <div className='mt-4 grid gap-3 md:grid-cols-4'>
          <TextInputField label='Nazwa universe' placeholder='Top Futures' value={name} onChange={setName} />
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
            <span>
              Placeholder exchange selected. Public catalog for this exchange is not implemented yet.
              You can still save the universe context.
            </span>
          </div>
        ) : null}

        <div className='mt-3 rounded-xl border border-base-300 bg-base-100 p-3'>
          <div className='grid gap-3 lg:grid-cols-2'>
            <FieldWrapper label='Filtr: minimalny wolumen quote 24h'>
              <input
                type='range'
                min={0}
                max={maxQuoteVolumeMillions}
                step={1}
                className='range range-primary range-sm'
                value={minQuoteVolumeMillions}
                onChange={(event) => setMinQuoteVolumeMillions(Number.parseInt(event.target.value, 10) || 0)}
              />
            </FieldWrapper>
            <div className='rounded-box border border-base-300 bg-base-200 px-3 py-2 text-sm'>
              <p>
                Min wolumen: <span className='font-mono'>{minQuoteVolumeMillions}M</span>
              </p>
              <p className='opacity-70'>Dostepnych po filtrze: {marketOptions.length}</p>
            </div>
          </div>

          <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-medium'>Szybki wybor wszystkich z aktualnego filtra (base + volume)</p>
            <div className='flex gap-2'>
              <button
                type='button'
                className='btn btn-xs btn-outline'
                onClick={selectAllFromBaseCurrency}
                disabled={availableSymbols.length === 0}
              >
                Wybierz wszystkie rynki
              </button>
              <button type='button' className='btn btn-xs btn-outline' onClick={clearAllSelections}>
                Wyczysc wybor
              </button>
            </div>
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

        {catalogLoading && <p className='mt-3 text-sm opacity-70'>Ladowanie katalogu rynkow z gieldy...</p>}
        {!catalogLoading && catalogError && <p className='mt-3 text-sm text-error'>{catalogError}</p>}

        <div className='mt-4 rounded-xl border border-base-300 bg-base-100 p-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <h3 className='font-semibold'>Podglad listy po filtrach</h3>
            <span className='text-sm opacity-70'>Liczba rynkow: {previewSymbols.length}</span>
          </div>
          <p className='mt-1 text-xs opacity-70'>
            Kolejnosc: alfabetyczna. Zastosowano: market type + base currency + min volume + whitelist - blacklist.
          </p>

          <div className='mt-3'>
            <input
              className='input input-bordered input-sm w-full'
              placeholder='Szukaj w przefiltrowanej liscie...'
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

        <div className='mt-4 flex justify-end'>
          <button type='submit' className='btn btn-primary btn-sm' disabled={!canSubmit}>
            {creating ? 'Tworzenie...' : 'Dodaj universe'}
          </button>
        </div>
      </form>

      {loading && <LoadingState title='Ladowanie market universes' />}
      {!loading && error && (
        <ErrorState
          title='Nie udalo sie pobrac market universes'
          description={error}
          retryLabel='Sprobuj ponownie'
          onRetry={() => void loadUniverses()}
        />
      )}
      {!loading && !error && universes.length === 0 && (
        <EmptyState
          title='Brak market universes'
          description='Dodaj pierwszy universe, aby przygotowac selekcje symboli dla botow.'
        />
      )}

      {!loading && !error && universes.length > 0 && (
        <div className='space-y-3'>
          <SuccessState
            title='Market universes aktywne'
            description={`Skonfigurowano ${universes.length} ${universes.length === 1 ? 'universe' : 'universes'}.`}
          />
          <div className='overflow-x-auto'>
            <table className='table table-zebra'>
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Gielda</th>
                  <th>Rynek</th>
                  <th>Base</th>
                  <th>Whitelist</th>
                  <th>Blacklist</th>
                  <th>Utworzono</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {universes.map((item) => (
                  <tr key={item.id}>
                    <td className='font-medium'>{item.name}</td>
                    <td>{item.exchange ?? 'BINANCE'}</td>
                    <td>{item.marketType}</td>
                    <td>{item.baseCurrency}</td>
                    <td>{item.whitelist.join(', ') || '-'}</td>
                    <td>{item.blacklist.join(', ') || '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <button
                        type='button'
                        className='btn btn-error btn-xs'
                        onClick={() => void handleDelete(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? 'Usuwanie...' : 'Usun'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

