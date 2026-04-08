'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/i18n/I18nProvider';
import { EXCHANGE_OPTIONS, supportsExchangeCapability } from '@/features/exchanges/exchangeCapabilities';
import { fetchApiKeys } from '@/features/profile/services/apiKeys.service';
import type { ApiKey } from '@/features/profile/types/apiKey.type';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import { createWallet, getWallet, updateWallet } from '../services/wallets.service';
import type { CreateWalletInput, Wallet, WalletAllocationMode, WalletMode } from '../types/wallet.type';

const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const payload = err.response?.data as { message?: string } | undefined;
  return payload?.message;
};

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
  baseCurrency: wallet.baseCurrency,
  paperInitialBalance: wallet.paperInitialBalance,
  liveAllocationMode: wallet.liveAllocationMode ?? 'PERCENT',
  liveAllocationValue: wallet.liveAllocationValue ?? 100,
  apiKeyId: wallet.apiKeyId ?? '',
});

const toPayload = (form: WalletFormState): CreateWalletInput => {
  if (form.mode === 'PAPER') {
    return {
      name: form.name.trim(),
      mode: form.mode,
      exchange: form.exchange,
      marketType: form.marketType,
      baseCurrency: form.baseCurrency.trim().toUpperCase(),
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
    baseCurrency: form.baseCurrency.trim().toUpperCase(),
    paperInitialBalance: form.paperInitialBalance,
    liveAllocationMode: form.liveAllocationMode,
    liveAllocationValue: form.liveAllocationValue,
    apiKeyId: form.apiKeyId || null,
  };
};

export default function WalletCreateEditForm({ editId = null, formId = 'wallet-form' }: WalletCreateEditFormProps) {
  const { locale } = useI18n();
  const router = useRouter();
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [form, setForm] = useState<WalletFormState>(buildDefaultForm());

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            loadError: 'Nie udalo sie zaladowac formularza portfela.',
            loadFailedTitle: 'Blad ladowania portfela',
            retry: 'Sprobuj ponownie',
            sectionBasics: 'Podstawowe dane',
            sectionLive: 'Ustawienia LIVE',
            name: 'Nazwa',
            mode: 'Tryb',
            exchange: 'Gielda',
            marketType: 'Rynek',
            baseCurrency: 'Waluta bazowa',
            paperInitialBalance: 'Kwota startowa paper',
            liveAllocationMode: 'Tryb limitu LIVE',
            liveAllocationValue: 'Wartosc limitu LIVE',
            apiKey: 'Klucz API',
            create: 'Utworz portfel',
            save: 'Zapisz',
            creating: 'Zapisywanie...',
            created: 'Portfel utworzony',
            saved: 'Portfel zapisany',
            createFailed: 'Nie udalo sie utworzyc portfela',
            saveFailed: 'Nie udalo sie zapisac portfela',
            modePaper: 'PAPER',
            modeLive: 'LIVE',
            allocPercent: 'PROCENT',
            allocFixed: 'KWOTA',
            noApiKeys: 'Brak kompatybilnych kluczy API dla wybranej gieldy',
            liveUnsupported: 'Wybrana gielda nie wspiera LIVE execution.',
            paperUnsupported: 'Wybrana gielda nie wspiera PAPER pricing feed.',
          }
        : {
            loadError: 'Failed to load wallet form.',
            loadFailedTitle: 'Wallet form load failed',
            retry: 'Try again',
            sectionBasics: 'Basics',
            sectionLive: 'LIVE settings',
            name: 'Name',
            mode: 'Mode',
            exchange: 'Exchange',
            marketType: 'Market type',
            baseCurrency: 'Base currency',
            paperInitialBalance: 'Paper start balance',
            liveAllocationMode: 'LIVE allocation mode',
            liveAllocationValue: 'LIVE allocation value',
            apiKey: 'API key',
            create: 'Create wallet',
            save: 'Save',
            creating: 'Saving...',
            created: 'Wallet created',
            saved: 'Wallet saved',
            createFailed: 'Failed to create wallet',
            saveFailed: 'Failed to save wallet',
            modePaper: 'PAPER',
            modeLive: 'LIVE',
            allocPercent: 'PERCENT',
            allocFixed: 'FIXED',
            noApiKeys: 'No compatible API keys for selected exchange',
            liveUnsupported: 'Selected exchange does not support LIVE execution.',
            paperUnsupported: 'Selected exchange does not support PAPER pricing feed.',
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
    } catch (err) {
      setError(getAxiosMessage(err) ?? copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, editId, isEditMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const compatibleApiKeys = useMemo(
    () => apiKeys.filter((item) => item.exchange === form.exchange),
    [apiKeys, form.exchange]
  );

  useEffect(() => {
    if (form.mode !== 'LIVE') {
      if (form.apiKeyId) {
        setForm((prev) => ({ ...prev, apiKeyId: '' }));
      }
      return;
    }
    if (!compatibleApiKeys.find((item) => item.id === form.apiKeyId)) {
      setForm((prev) => ({ ...prev, apiKeyId: compatibleApiKeys[0]?.id ?? '' }));
    }
  }, [compatibleApiKeys, form.apiKeyId, form.mode]);

  const canSaveMode = form.mode === 'LIVE'
    ? supportsExchangeCapability(form.exchange, 'LIVE_EXECUTION')
    : supportsExchangeCapability(form.exchange, 'PAPER_PRICING_FEED');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error(copy.createFailed);
      return;
    }
    if (!canSaveMode) {
      toast.error(form.mode === 'LIVE' ? copy.liveUnsupported : copy.paperUnsupported);
      return;
    }
    if (form.mode === 'LIVE' && !form.apiKeyId) {
      toast.error(copy.noApiKeys);
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
    return <LoadingState title={copy.creating} />;
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

  if (form.mode === 'LIVE' && compatibleApiKeys.length === 0) {
    return (
      <EmptyState
        title={copy.noApiKeys}
        description={copy.liveUnsupported}
      />
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className='space-y-4 rounded-box border border-base-300/60 bg-base-100/80 p-4'>
      <section className='space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3'>
        <h2 className='text-base font-semibold'>{copy.sectionBasics}</h2>
        <div className='grid gap-3 md:grid-cols-2'>
          <label className='form-control gap-1'>
            <span className='label-text'>{copy.name}</span>
            <input
              className='input input-bordered'
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>

          <label className='form-control gap-1'>
            <span className='label-text'>{copy.mode}</span>
            <select
              className='select select-bordered'
              value={form.mode}
              onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as WalletMode }))}
            >
              <option value='PAPER'>{copy.modePaper}</option>
              <option value='LIVE'>{copy.modeLive}</option>
            </select>
          </label>

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
            <input
              className='input input-bordered'
              value={form.baseCurrency}
              onChange={(event) => setForm((prev) => ({ ...prev, baseCurrency: event.target.value }))}
            />
          </label>

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
        </div>
      </section>

      {form.mode === 'LIVE' ? (
        <section className='space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3'>
          <h2 className='text-base font-semibold'>{copy.sectionLive}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='form-control gap-1'>
              <span className='label-text'>{copy.liveAllocationMode}</span>
              <select
                className='select select-bordered'
                value={form.liveAllocationMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, liveAllocationMode: event.target.value as WalletAllocationMode }))
                }
              >
                <option value='PERCENT'>{copy.allocPercent}</option>
                <option value='FIXED'>{copy.allocFixed}</option>
              </select>
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>{copy.liveAllocationValue}</span>
              <input
                type='number'
                min={0.01}
                step={0.01}
                className='input input-bordered'
                value={form.liveAllocationValue}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, liveAllocationValue: Number(event.target.value) || 0 }))
                }
              />
            </label>

            <label className='form-control gap-1 md:col-span-2'>
              <span className='label-text'>{copy.apiKey}</span>
              <select
                className='select select-bordered'
                value={form.apiKeyId}
                onChange={(event) => setForm((prev) => ({ ...prev, apiKeyId: event.target.value }))}
              >
                {compatibleApiKeys.length === 0 ? <option value=''>{copy.noApiKeys}</option> : null}
                {compatibleApiKeys.map((apiKey) => (
                  <option key={apiKey.id} value={apiKey.id}>
                    {apiKey.label} ({apiKey.exchange})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {!canSaveMode ? (
        <div className='alert alert-warning'>
          <span>{form.mode === 'LIVE' ? copy.liveUnsupported : copy.paperUnsupported}</span>
        </div>
      ) : null}

    </form>
  );
}
