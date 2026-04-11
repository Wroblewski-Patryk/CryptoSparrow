'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { LuActivity, LuBadgeCheck, LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { EXCHANGE_OPTIONS, supportsExchangeCapability } from '@/features/exchanges/exchangeCapabilities';
import { fetchApiKeys } from '@/features/profile/services/apiKeys.service';
import { fetchMarketCatalog } from '@/features/markets/services/markets.service';
import type { ApiKey } from '@/features/profile/types/apiKey.type';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeSymbol } from '@/lib/symbols';
import { createWallet, getWallet, previewWalletBalance, updateWallet } from '../services/wallets.service';
import type {
  CreateWalletInput,
  Wallet,
  WalletAllocationMode,
  WalletBalancePreview,
  WalletMode,
} from '../types/wallet.type';

type WalletFormState = {
  name: string;
  mode: WalletMode;
  exchange: (typeof EXCHANGE_OPTIONS)[number];
  marketType: 'FUTURES' | 'SPOT';
  baseCurrency: string;
  paperInitialBalance: number;
  liveAllocationMode: WalletAllocationMode;
  liveAllocationValue: number;
  apiKeyId: string;
};

type WalletCreateEditFormProps = {
  editId?: string | null;
  formId?: string;
};

const buildDefaultForm = (): WalletFormState => ({
  name: '',
  mode: 'PAPER',
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  baseCurrency: 'USDT',
  paperInitialBalance: 10_000,
  liveAllocationMode: 'PERCENT',
  liveAllocationValue: 100,
  apiKeyId: '',
});

const mapWalletToForm = (wallet: Wallet): WalletFormState => ({
  name: wallet.name,
  mode: wallet.mode,
  exchange: wallet.exchange,
  marketType: wallet.marketType,
  baseCurrency: normalizeSymbol(wallet.baseCurrency) || 'USDT',
  paperInitialBalance: wallet.paperInitialBalance,
  liveAllocationMode: wallet.liveAllocationMode ?? 'PERCENT',
  liveAllocationValue: wallet.liveAllocationValue ?? 100,
  apiKeyId: wallet.apiKeyId ?? '',
});

const toPayload = (form: WalletFormState): CreateWalletInput => {
  const baseCurrency = normalizeSymbol(form.baseCurrency) || 'USDT';

  if (form.mode === 'PAPER') {
    return {
      name: form.name.trim(),
      mode: form.mode,
      exchange: form.exchange,
      marketType: form.marketType,
      baseCurrency,
      paperInitialBalance: form.paperInitialBalance,
      liveAllocationMode: null,
      liveAllocationValue: null,
      apiKeyId: null,
    };
  }

  return {
    name: form.name.trim(),
    mode: form.mode,
    exchange: form.exchange,
    marketType: form.marketType,
    baseCurrency,
    paperInitialBalance: form.paperInitialBalance,
    liveAllocationMode: form.liveAllocationMode,
    liveAllocationValue: form.liveAllocationValue,
    apiKeyId: form.apiKeyId || null,
  };
};

const formatAmount = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ` ${normalizeSymbol(currency)}`;

export default function WalletCreateEditForm({ editId = null, formId = 'wallet-form' }: WalletCreateEditFormProps) {
  const { locale } = useI18n();
  const router = useRouter();
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [form, setForm] = useState<WalletFormState>(buildDefaultForm());
  const [baseCurrencyOptions, setBaseCurrencyOptions] = useState<string[]>(['USDT']);
  const [baseCurrencyOptionsLoading, setBaseCurrencyOptionsLoading] = useState(false);
  const [baseCurrencyOptionsError, setBaseCurrencyOptionsError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WalletBalancePreview | null>(null);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            loading: 'Ladowanie formularza...',
            loadError: 'Nie udalo sie zaladowac formularza portfela.',
            loadFailedTitle: 'Blad ladowania portfela',
            retry: 'Sprobuj ponownie',
            sectionBasics: 'Podstawowe dane',
            sectionLive: 'Ustawienia LIVE',
            sectionSummary: 'Podsumowanie konfiguracji',
            sectionPreview: 'Podglad salda LIVE',
            summaryHint: 'Sprawdz zgodnosc trybu, gieldy i alokacji przed zapisem.',
            name: 'Nazwa',
            mode: 'Tryb',
            exchange: 'Gielda',
            marketType: 'Rynek',
            baseCurrency: 'Waluta bazowa',
            baseCurrencyLoading: 'Ladowanie walut bazowych...',
            baseCurrencyCatalogError: 'Nie udalo sie pobrac walut bazowych z katalogu gieldy.',
            paperInitialBalance: 'Kwota startowa paper',
            liveAllocationMode: 'Tryb limitu LIVE',
            liveAllocationValue: 'Wartosc limitu LIVE',
            liveAllocation: 'Alokacja LIVE',
            apiKey: 'Klucz API',
            selectedKey: 'Wybrany klucz',
            notSelected: 'Nie wybrano',
            modePaper: 'PAPER',
            modeLive: 'LIVE',
            allocPercent: 'PROCENT',
            allocFixed: 'KWOTA',
            noApiKeys: 'Brak kompatybilnych kluczy API dla wybranej gieldy',
            liveUnsupported: 'Wybrana gielda nie wspiera LIVE execution.',
            paperUnsupported: 'Wybrana gielda nie wspiera PAPER pricing feed.',
            saveValidation: 'Popraw formularz przed zapisem',
            saveFailed: 'Nie udalo sie zapisac portfela',
            createFailed: 'Nie udalo sie utworzyc portfela',
            created: 'Portfel utworzony',
            saved: 'Portfel zapisany',
            accountBalance: 'Saldo konta',
            freeBalance: 'Srodki wolne',
            referenceBalance: 'Saldo robocze',
            previewFetch: 'Pobierz podglad',
            previewFetching: 'Pobieranie...',
            previewUnavailable: 'Podglad dostepny tylko dla LIVE z wybranym kluczem API.',
            validationName: 'Podaj nazwe portfela.',
            validationBaseCurrency: 'Podaj walute bazowa.',
            validationApiKey: 'W LIVE musisz wybrac klucz API.',
            validationAllocationValue: 'W LIVE podaj dodatnia wartosc alokacji.',
            validationAllocationPercent: 'W trybie procentowym wartosc nie moze przekraczac 100.',
          }
        : {
            loading: 'Loading form...',
            loadError: 'Failed to load wallet form.',
            loadFailedTitle: 'Wallet form load failed',
            retry: 'Try again',
            sectionBasics: 'Basics',
            sectionLive: 'LIVE settings',
            sectionSummary: 'Configuration summary',
            sectionPreview: 'LIVE balance preview',
            summaryHint: 'Confirm mode, exchange and allocation before saving.',
            name: 'Name',
            mode: 'Mode',
            exchange: 'Exchange',
            marketType: 'Market type',
            baseCurrency: 'Base currency',
            baseCurrencyLoading: 'Loading base currencies...',
            baseCurrencyCatalogError: 'Could not fetch base currencies from exchange catalog.',
            paperInitialBalance: 'Paper start balance',
            liveAllocationMode: 'LIVE allocation mode',
            liveAllocationValue: 'LIVE allocation value',
            liveAllocation: 'LIVE allocation',
            apiKey: 'API key',
            selectedKey: 'Selected key',
            notSelected: 'Not selected',
            modePaper: 'PAPER',
            modeLive: 'LIVE',
            allocPercent: 'PERCENT',
            allocFixed: 'FIXED',
            noApiKeys: 'No compatible API keys for selected exchange',
            liveUnsupported: 'Selected exchange does not support LIVE execution.',
            paperUnsupported: 'Selected exchange does not support PAPER pricing feed.',
            saveValidation: 'Fix form errors before saving',
            saveFailed: 'Failed to save wallet',
            createFailed: 'Failed to create wallet',
            created: 'Wallet created',
            saved: 'Wallet saved',
            accountBalance: 'Account balance',
            freeBalance: 'Free balance',
            referenceBalance: 'Working balance',
            previewFetch: 'Fetch preview',
            previewFetching: 'Fetching...',
            previewUnavailable: 'Preview is available only for LIVE mode with selected API key.',
            validationName: 'Wallet name is required.',
            validationBaseCurrency: 'Base currency is required.',
            validationApiKey: 'API key is required for LIVE mode.',
            validationAllocationValue: 'Allocation value must be positive in LIVE mode.',
            validationAllocationPercent: 'Percent allocation cannot exceed 100.',
          },
    [locale]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const keys = await fetchApiKeys().catch(() => [] as ApiKey[]);
      setApiKeys(keys);
      if (isEditMode && editId) {
        const wallet = await getWallet(editId);
        setForm(mapWalletToForm(wallet));
      } else {
        setForm(buildDefaultForm());
      }
      setPreview(null);
      setPreviewError(null);
      setShowValidation(false);
    } catch (err) {
      setError(getAxiosMessage(err) ?? copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, editId, isEditMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    const loadBaseCurrencies = async () => {
      const fallbackOptions = ['USDT'];

      if (!supportsExchangeCapability(form.exchange, 'MARKET_CATALOG')) {
        setBaseCurrencyOptions(fallbackOptions);
        setBaseCurrencyOptionsLoading(false);
        setBaseCurrencyOptionsError(null);
        return;
      }

      setBaseCurrencyOptionsLoading(true);
      setBaseCurrencyOptionsError(null);
      try {
        const catalog = await fetchMarketCatalog({
          exchange: form.exchange,
          marketType: form.marketType,
        });
        if (cancelled) return;

        const normalizedOptions = [...new Set((catalog.baseCurrencies ?? []).map(normalizeSymbol).filter(Boolean))].sort(
          (a, b) => a.localeCompare(b)
        );
        const options = normalizedOptions.length > 0 ? normalizedOptions : fallbackOptions;
        const defaultBase = normalizeSymbol(catalog.baseCurrency) || options[0] || 'USDT';
        setBaseCurrencyOptions(options);
        setForm((prev) => {
          const normalizedCurrent = normalizeSymbol(prev.baseCurrency);
          const nextBase = options.includes(normalizedCurrent) ? normalizedCurrent : defaultBase;
          if (normalizedCurrent === nextBase && prev.baseCurrency === nextBase) return prev;
          return { ...prev, baseCurrency: nextBase };
        });
      } catch (err) {
        if (cancelled) return;
        setBaseCurrencyOptions(fallbackOptions);
        setBaseCurrencyOptionsError(getAxiosMessage(err) ?? copy.baseCurrencyCatalogError);
      } finally {
        if (!cancelled) {
          setBaseCurrencyOptionsLoading(false);
        }
      }
    };

    void loadBaseCurrencies();

    return () => {
      cancelled = true;
    };
  }, [copy.baseCurrencyCatalogError, form.exchange, form.marketType]);

  const resolvedBaseCurrencyOptions = useMemo(() => {
    const current = normalizeSymbol(form.baseCurrency);
    const options = [...new Set([...baseCurrencyOptions, current].filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return options.length > 0 ? options : ['USDT'];
  }, [baseCurrencyOptions, form.baseCurrency]);

  const compatibleApiKeys = useMemo(
    () => apiKeys.filter((item) => item.exchange === form.exchange),
    [apiKeys, form.exchange]
  );

  useEffect(() => {
    if (form.mode !== 'LIVE') {
      if (form.apiKeyId) {
        setForm((prev) => ({ ...prev, apiKeyId: '' }));
      }
      setPreview(null);
      setPreviewError(null);
      return;
    }
    if (!compatibleApiKeys.find((item) => item.id === form.apiKeyId)) {
      setForm((prev) => ({ ...prev, apiKeyId: compatibleApiKeys[0]?.id ?? '' }));
      setPreview(null);
      setPreviewError(null);
    }
  }, [compatibleApiKeys, form.apiKeyId, form.mode]);

  const canSaveMode = form.mode === 'LIVE'
    ? supportsExchangeCapability(form.exchange, 'LIVE_EXECUTION')
    : supportsExchangeCapability(form.exchange, 'PAPER_PRICING_FEED');

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof WalletFormState, string>> = {};

    if (!form.name.trim()) {
      errors.name = copy.validationName;
    }
    if (!normalizeSymbol(form.baseCurrency)) {
      errors.baseCurrency = copy.validationBaseCurrency;
    }

    if (form.mode === 'LIVE') {
      if (!form.apiKeyId) {
        errors.apiKeyId = copy.validationApiKey;
      }
      if (!Number.isFinite(form.liveAllocationValue) || form.liveAllocationValue <= 0) {
        errors.liveAllocationValue = copy.validationAllocationValue;
      } else if (form.liveAllocationMode === 'PERCENT' && form.liveAllocationValue > 100) {
        errors.liveAllocationValue = copy.validationAllocationPercent;
      }
    }

    return errors;
  }, [copy.validationAllocationPercent, copy.validationAllocationValue, copy.validationApiKey, copy.validationBaseCurrency, copy.validationName, form]);

  const hasValidationErrors = Object.keys(fieldErrors).length > 0;
  const selectedApiKey = useMemo(
    () => compatibleApiKeys.find((item) => item.id === form.apiKeyId) ?? null,
    [compatibleApiKeys, form.apiKeyId]
  );

  const handlePreviewBalance = useCallback(async () => {
    if (form.mode !== 'LIVE' || !form.apiKeyId || !canSaveMode) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await previewWalletBalance({
        exchange: form.exchange,
        marketType: form.marketType,
        baseCurrency: normalizeSymbol(form.baseCurrency) || 'USDT',
        apiKeyId: form.apiKeyId,
      });
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setPreviewError(getAxiosMessage(err) ?? copy.saveFailed);
    } finally {
      setPreviewLoading(false);
    }
  }, [
    canSaveMode,
    copy.saveFailed,
    form.apiKeyId,
    form.baseCurrency,
    form.exchange,
    form.marketType,
    form.mode,
  ]);

  useEffect(() => {
    if (form.mode !== 'LIVE' || !form.apiKeyId || !canSaveMode) return;
    void handlePreviewBalance();
  }, [canSaveMode, form.apiKeyId, form.baseCurrency, form.exchange, form.marketType, form.mode, handlePreviewBalance]);

  const previewReferenceBalance = useMemo(() => {
    if (!preview) return null;
    if (form.liveAllocationMode === 'PERCENT') {
      const percent = Math.max(0, Math.min(100, form.liveAllocationValue || 0));
      return preview.accountBalance * (percent / 100);
    }
    if (form.liveAllocationMode === 'FIXED') {
      return Math.min(preview.accountBalance, Math.max(0, form.liveAllocationValue || 0));
    }
    return preview.referenceBalance;
  }, [form.liveAllocationMode, form.liveAllocationValue, preview]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowValidation(true);

    if (!canSaveMode || hasValidationErrors) {
      toast.error(copy.saveValidation);
      return;
    }

    setSubmitting(true);
    try {
      const payload = toPayload(form);
      if (isEditMode && editId) {
        await updateWallet(editId, payload);
        toast.success(copy.saved);
        await loadData();
      } else {
        await createWallet(payload);
        toast.success(copy.created);
        router.replace('/dashboard/wallets/list');
      }
    } catch (err) {
      toast.error(isEditMode ? copy.saveFailed : copy.createFailed, {
        description: getAxiosMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState title={copy.loading} />;
  }

  if (error) {
    return (
      <ErrorState
        title={copy.loadFailedTitle}
        description={error}
        retryLabel={copy.retry}
        onRetry={() => void loadData()}
      />
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]'>
      <div className='space-y-4'>
        <section className='space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4'>
          <h2 className='text-base font-semibold'>{copy.sectionBasics}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='form-control gap-1'>
              <span className='label-text'>{copy.name}</span>
              <input
                className='input input-bordered'
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              {showValidation && fieldErrors.name ? <span className='text-xs text-error'>{fieldErrors.name}</span> : null}
            </label>

            <div className='form-control gap-1'>
              <span className='label-text'>{copy.mode}</span>
              <div className='join'>
                <button
                  type='button'
                  className={`btn join-item ${form.mode === 'PAPER' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm((prev) => ({ ...prev, mode: 'PAPER' }))}
                >
                  {copy.modePaper}
                </button>
                <button
                  type='button'
                  className={`btn join-item ${form.mode === 'LIVE' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setForm((prev) => ({ ...prev, mode: 'LIVE' }))}
                >
                  {copy.modeLive}
                </button>
              </div>
            </div>

            <label className='form-control gap-1'>
              <span className='label-text'>{copy.exchange}</span>
              <select
                className='select select-bordered'
                value={form.exchange}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, exchange: event.target.value as WalletFormState['exchange'] }))
                }
              >
                {EXCHANGE_OPTIONS.map((exchange) => (
                  <option key={exchange} value={exchange}>
                    {exchange}
                  </option>
                ))}
              </select>
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>{copy.marketType}</span>
              <select
                className='select select-bordered'
                value={form.marketType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, marketType: event.target.value as 'FUTURES' | 'SPOT' }))
                }
              >
                <option value='FUTURES'>FUTURES</option>
                <option value='SPOT'>SPOT</option>
              </select>
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>{copy.baseCurrency}</span>
              <select
                className='select select-bordered'
                value={form.baseCurrency}
                onChange={(event) => setForm((prev) => ({ ...prev, baseCurrency: normalizeSymbol(event.target.value) }))}
                disabled={baseCurrencyOptionsLoading}
              >
                {resolvedBaseCurrencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              {baseCurrencyOptionsLoading ? (
                <span className='text-xs opacity-70'>{copy.baseCurrencyLoading}</span>
              ) : null}
              {baseCurrencyOptionsError ? (
                <span className='text-xs text-warning'>{baseCurrencyOptionsError}</span>
              ) : null}
              {showValidation && fieldErrors.baseCurrency ? (
                <span className='text-xs text-error'>{fieldErrors.baseCurrency}</span>
              ) : null}
            </label>

            {form.mode === 'PAPER' ? (
              <label className='form-control gap-1'>
                <span className='label-text'>{copy.paperInitialBalance}</span>
                <input
                  type='number'
                  min={0}
                  step={0.01}
                  className='input input-bordered'
                  value={form.paperInitialBalance}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, paperInitialBalance: Number(event.target.value) || 0 }))
                  }
                />
              </label>
            ) : null}
          </div>
        </section>

        {form.mode === 'LIVE' ? (
          <section className='space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4'>
            <h2 className='text-base font-semibold'>{copy.sectionLive}</h2>
            <div className='grid gap-3 md:grid-cols-2'>
              <label className='form-control gap-1 md:col-span-2'>
                <span className='label-text'>{copy.liveAllocation}</span>
                <div className='join'>
                  <input
                    type='number'
                    min={0.01}
                    step={0.01}
                    className='input input-bordered join-item w-full'
                    value={form.liveAllocationValue}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, liveAllocationValue: Number(event.target.value) || 0 }))
                    }
                  />
                  <select
                    className='select select-bordered join-item w-40'
                    value={form.liveAllocationMode}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, liveAllocationMode: event.target.value as WalletAllocationMode }))
                    }
                  >
                    <option value='PERCENT'>%</option>
                    <option value='FIXED'>{normalizeSymbol(form.baseCurrency) || 'USDT'}</option>
                  </select>
                </div>
                {showValidation && fieldErrors.liveAllocationValue ? (
                  <span className='text-xs text-error'>{fieldErrors.liveAllocationValue}</span>
                ) : null}
              </label>

              <label className='form-control gap-1 md:col-span-2'>
                <span className='label-text'>{copy.apiKey}</span>
                <select
                  className='select select-bordered'
                  value={form.apiKeyId}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, apiKeyId: event.target.value }));
                    setPreview(null);
                    setPreviewError(null);
                  }}
                >
                  <option value=''>{copy.notSelected}</option>
                  {compatibleApiKeys.map((apiKey) => (
                    <option key={apiKey.id} value={apiKey.id}>
                      {apiKey.label} ({apiKey.exchange})
                    </option>
                  ))}
                </select>
                {showValidation && fieldErrors.apiKeyId ? (
                  <span className='text-xs text-error'>{fieldErrors.apiKeyId}</span>
                ) : null}
                {compatibleApiKeys.length === 0 ? <span className='text-xs text-warning'>{copy.noApiKeys}</span> : null}
              </label>
            </div>
          </section>
        ) : null}

        {!canSaveMode ? (
          <div className='alert alert-warning'>
            <span>{form.mode === 'LIVE' ? copy.liveUnsupported : copy.paperUnsupported}</span>
          </div>
        ) : null}
      </div>

      <aside className='space-y-4'>
        <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4 text-sm'>
          <p className='mb-1 flex items-center gap-2 text-base font-semibold'>
            <LuWallet className='h-4 w-4' aria-hidden />
            {copy.sectionSummary}
          </p>
          <p className='mb-3 text-xs opacity-70'>{copy.summaryHint}</p>
          <div className='space-y-2'>
            <p className='flex items-center justify-between gap-2'>
              <span className='opacity-65'>{copy.mode}</span>
              <span className='font-semibold'>{form.mode}</span>
            </p>
            <p className='flex items-center justify-between gap-2'>
              <span className='opacity-65'>{copy.exchange}</span>
              <span className='font-semibold'>{form.exchange}</span>
            </p>
            <p className='flex items-center justify-between gap-2'>
              <span className='opacity-65'>{copy.marketType}</span>
              <span className='font-semibold'>{form.marketType}</span>
            </p>
            <p className='flex items-center justify-between gap-2'>
              <span className='opacity-65'>{copy.baseCurrency}</span>
              <span className='font-semibold'>{normalizeSymbol(form.baseCurrency) || '-'}</span>
            </p>
            {form.mode === 'LIVE' ? (
              <>
                <p className='flex items-center justify-between gap-2'>
                  <span className='opacity-65'>{copy.liveAllocation}</span>
                  <span className='font-semibold'>
                    {form.liveAllocationValue || '-'}{' '}
                    {form.liveAllocationMode === 'PERCENT' ? '%' : normalizeSymbol(form.baseCurrency) || 'USDT'}
                  </span>
                </p>
                <p className='flex items-center justify-between gap-2'>
                  <span className='opacity-65'>{copy.selectedKey}</span>
                  <span className='max-w-[11rem] truncate text-right font-semibold'>{selectedApiKey?.label ?? copy.notSelected}</span>
                </p>
              </>
            ) : null}
          </div>
        </section>

        {form.mode === 'LIVE' ? (
          <section className='rounded-box border border-base-300/60 bg-base-100/85 p-4 text-sm'>
            <div className='mb-3 flex items-center justify-between gap-2'>
              <p className='flex items-center gap-2 text-base font-semibold'>
                <LuActivity className='h-4 w-4' aria-hidden />
                {copy.sectionPreview}
              </p>
              <button
                type='button'
                className='btn btn-xs btn-outline'
                onClick={() => void handlePreviewBalance()}
                disabled={previewLoading || !form.apiKeyId || !canSaveMode}
              >
                {previewLoading ? copy.previewFetching : copy.previewFetch}
              </button>
            </div>

            {!form.apiKeyId || !canSaveMode ? (
              <p className='text-xs opacity-70'>{copy.previewUnavailable}</p>
            ) : null}
            {previewError ? <p className='text-xs text-error'>{previewError}</p> : null}

            <div className='space-y-2'>
              <p className='flex items-center justify-between gap-2'>
                <span className='opacity-65'>{copy.accountBalance}</span>
                <span className='font-semibold'>
                  {preview ? formatAmount(preview.accountBalance, preview.baseCurrency) : '-'}
                </span>
              </p>
              <p className='flex items-center justify-between gap-2'>
                <span className='opacity-65'>{copy.freeBalance}</span>
                <span className='font-semibold'>
                  {preview?.freeBalance != null ? formatAmount(preview.freeBalance, preview.baseCurrency) : '-'}
                </span>
              </p>
              <p className='flex items-center justify-between gap-2'>
                <span className='opacity-65'>{copy.referenceBalance}</span>
                <span className='font-semibold text-primary'>
                  {previewReferenceBalance != null && preview
                    ? formatAmount(previewReferenceBalance, preview.baseCurrency)
                    : '-'}
                </span>
              </p>
              {preview ? (
                <p className='inline-flex items-center gap-1.5 text-xs opacity-70'>
                  <LuBadgeCheck className='h-3.5 w-3.5' aria-hidden />
                  {preview.fetchedAt}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </aside>

      <button type='submit' className='sr-only' disabled={submitting}>
        hidden-submit
      </button>
    </form>
  );
}
