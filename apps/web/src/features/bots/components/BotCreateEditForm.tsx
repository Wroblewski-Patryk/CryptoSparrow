'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/i18n/I18nProvider';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import { listMarketUniverses } from '@/features/markets/services/markets.service';
import { MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { listStrategies } from '@/features/strategies/api/strategies.api';
import { StrategyDto } from '@/features/strategies/types/StrategyForm.type';
import { supportsExchangeCapability } from '@/features/exchanges/exchangeCapabilities';
import { listWallets } from '@/features/wallets/services/wallets.service';
import { Wallet } from '@/features/wallets/types/wallet.type';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import {
  createBot,
  getBot,
  getBotRuntimeGraph,
  updateBot,
} from '../services/bots.service';

const LIVE_CONSENT_TEXT_VERSION = 'mvp-v1';
const DUPLICATE_ACTIVE_BOT_ERROR = 'active bot already exists for this strategy + market group pair';

const deriveStrategyMaxOpenPositions = (strategy: StrategyDto | null): number => {
  if (!strategy?.config || typeof strategy.config !== 'object') return 1;
  const config = strategy.config as {
    additional?: {
      maxPositions?: unknown;
      maxOpenPositions?: unknown;
    };
  };
  const raw = config.additional?.maxPositions ?? config.additional?.maxOpenPositions;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
};

type BotFormState = {
  name: string;
  walletId: string;
  strategyId: string;
  marketGroupId: string;
  isActive: boolean;
  liveOptIn: boolean;
};

const buildDefaultForm = (params: {
  strategies: StrategyDto[];
  marketGroups: MarketUniverse[];
  wallets: Wallet[];
}): BotFormState => ({
  name: '',
  walletId: params.wallets[0]?.id ?? '',
  strategyId: params.strategies[0]?.id ?? '',
  marketGroupId: params.marketGroups[0]?.id ?? '',
  isActive: true,
  liveOptIn: false,
});

type BotCreateEditFormProps = {
  editId?: string | null;
  formId?: string;
};

export default function BotCreateEditForm({ editId = null, formId = 'bot-form' }: BotCreateEditFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketGroups, setMarketGroups] = useState<MarketUniverse[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [form, setForm] = useState<BotFormState>({
    name: '',
    walletId: '',
    strategyId: '',
    marketGroupId: '',
    isActive: true,
    liveOptIn: false,
  });

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [strategyRows, marketGroupRows, walletRows] = await Promise.all([
        listStrategies(),
        listMarketUniverses(),
        listWallets(),
      ]);
      setStrategies(strategyRows);
      setMarketGroups(marketGroupRows);
      setWallets(walletRows);

      if (!isEditMode || !editId) {
        setForm(buildDefaultForm({ strategies: strategyRows, marketGroups: marketGroupRows, wallets: walletRows }));
        return;
      }

      const [bot, runtimeGraph] = await Promise.all([getBot(editId), getBotRuntimeGraph(editId)]);
      const selectedGroup =
        runtimeGraph.marketGroups.find((group) => group.isEnabled) ?? runtimeGraph.marketGroups[0];
      const selectedGroupId =
        selectedGroup?.symbolGroup?.marketUniverseId ??
        marketGroupRows[0]?.id ??
        '';
      const selectedStrategyId =
        selectedGroup?.strategies.find((strategy) => strategy.isEnabled)?.strategyId ??
        bot.strategyId ??
        strategyRows[0]?.id ??
        '';

      setForm({
        name: bot.name,
        walletId: bot.walletId ?? bot.wallet?.id ?? walletRows[0]?.id ?? '',
        strategyId: selectedStrategyId,
        marketGroupId: selectedGroupId,
        isActive: bot.isActive,
        liveOptIn: bot.liveOptIn,
      });
    } catch (err: unknown) {
      setError(getAxiosMessage(err) ?? t('dashboard.bots.errors.loadBots'));
    } finally {
      setLoading(false);
    }
  }, [editId, isEditMode, t]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === form.strategyId) ?? null,
    [strategies, form.strategyId]
  );
  const selectedMarketGroup = useMemo(
    () => marketGroups.find((group) => group.id === form.marketGroupId) ?? null,
    [marketGroups, form.marketGroupId]
  );
  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === form.walletId) ?? null,
    [wallets, form.walletId]
  );

  const selectedMode = selectedWallet?.mode ?? 'PAPER';
  const canActivateForMode = useMemo(() => {
    if (!selectedWallet) return false;
    if (selectedMode === 'LIVE') {
      return supportsExchangeCapability(selectedWallet.exchange, 'LIVE_EXECUTION');
    }
    return supportsExchangeCapability(selectedWallet.exchange, 'PAPER_PRICING_FEED');
  }, [selectedMode, selectedWallet]);
  const hasCompatibleLiveApiKey = Boolean(selectedWallet?.apiKeyId);
  const walletContextMatches = useMemo(() => {
    if (!selectedWallet || !selectedMarketGroup) return true;
    return (
      selectedWallet.exchange === selectedMarketGroup.exchange &&
      selectedWallet.marketType === selectedMarketGroup.marketType &&
      selectedWallet.baseCurrency.toUpperCase() === selectedMarketGroup.baseCurrency.toUpperCase()
    );
  }, [selectedMarketGroup, selectedWallet]);

  useEffect(() => {
    if (selectedMode === 'LIVE') return;
    if (!form.liveOptIn) return;
    setForm((prev) => ({ ...prev, liveOptIn: false }));
  }, [form.liveOptIn, selectedMode]);

  useEffect(() => {
    if (!form.isActive) return;
    if (canActivateForMode && walletContextMatches) return;
    setForm((prev) => ({ ...prev, isActive: false }));
  }, [canActivateForMode, form.isActive, walletContextMatches]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.strategyId || !form.marketGroupId || !form.walletId) {
      toast.error(t('dashboard.bots.create.description'));
      return;
    }
    if (!walletContextMatches) {
      toast.error('Wallet context must match selected market group (exchange/market/base currency).');
      return;
    }
    if (form.isActive && !canActivateForMode) {
      toast.error(t('dashboard.bots.create.placeholderActivationBlocked'));
      return;
    }
    if (selectedMode === 'LIVE' && form.isActive && !hasCompatibleLiveApiKey) {
      toast.error('Selected LIVE wallet has no linked API key.');
      return;
    }

    const needsLiveConfirm = selectedMode === 'LIVE';
    if (needsLiveConfirm) {
      const message = isEditMode
        ? t('dashboard.bots.confirms.liveSave')
        : t('dashboard.bots.confirms.liveCreate');
      if (!window.confirm(message)) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        walletId: form.walletId,
        strategyId: form.strategyId,
        marketGroupId: form.marketGroupId,
        isActive: form.isActive,
        liveOptIn: selectedMode === 'LIVE' ? form.liveOptIn : false,
        consentTextVersion:
          selectedMode === 'LIVE' && form.liveOptIn
            ? LIVE_CONSENT_TEXT_VERSION
            : null,
      };

      if (isEditMode && editId) {
        await updateBot(editId, payload);
        toast.success(t('dashboard.bots.toasts.updated'));
        await loadFormData();
      } else {
        const created = await createBot(payload);
        toast.success(t('dashboard.bots.toasts.created'));
        router.replace(dashboardRoutes.bots.edit(created.id));
      }
    } catch (err: unknown) {
      const message = getAxiosMessage(err);
      if (message === DUPLICATE_ACTIVE_BOT_ERROR) {
        toast.error(t('dashboard.bots.toasts.duplicateActiveTitle'), {
          description: t('dashboard.bots.toasts.duplicateActiveDescription'),
        });
      } else {
        toast.error(
          isEditMode ? t('dashboard.bots.toasts.saveFailed') : t('dashboard.bots.toasts.createFailed'),
          { description: message }
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState title={t('dashboard.bots.states.loadingBots')} />;
  }

  if (error) {
    return (
      <ErrorState
        title={t('dashboard.bots.states.loadBotsFailedTitle')}
        description={error}
        retryLabel={t('dashboard.bots.states.retry')}
        onRetry={() => void loadFormData()}
      />
    );
  }

  if (strategies.length === 0 || marketGroups.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.bots.states.emptyTitle')}
        description={t('dashboard.bots.states.emptyDescription')}
      />
    );
  }

  if (wallets.length === 0) {
    return (
      <EmptyState
        title='No wallets available'
        description='Create wallet first in Wallets module, then return to bot form.'
      />
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className='space-y-4 rounded-box border border-base-300/60 bg-base-100/80 p-4'>
      <fieldset disabled={submitting} className='space-y-4'>
        <section className='space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3'>
          <h2 className='text-base font-semibold'>{t('dashboard.bots.create.sectionBasics')}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='form-control gap-1'>
              <span className='label-text'>{t('dashboard.bots.create.nameLabel')}</span>
              <input
                className='input input-bordered'
                aria-label={t('dashboard.bots.create.nameAria')}
                placeholder={t('dashboard.bots.create.namePlaceholder')}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>Wallet</span>
              <select
                className='select select-bordered'
                value={form.walletId}
                onChange={(event) => setForm((prev) => ({ ...prev, walletId: event.target.value }))}
              >
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} ({wallet.mode} / {wallet.exchange} / {wallet.marketType} / {wallet.baseCurrency})
                  </option>
                ))}
              </select>
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>{t('dashboard.bots.list.columns.active')}</span>
              <input
                type='checkbox'
                className='toggle toggle-success'
                checked={form.isActive}
                disabled={!canActivateForMode || !walletContextMatches}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
            </label>

            {selectedMode === 'LIVE' ? (
              <label className='form-control gap-1'>
                <span className='label-text'>{t('dashboard.bots.list.columns.liveOptIn')}</span>
                <input
                  type='checkbox'
                  className='toggle toggle-warning'
                  checked={form.liveOptIn}
                  onChange={(event) => setForm((prev) => ({ ...prev, liveOptIn: event.target.checked }))}
                />
              </label>
            ) : null}
          </div>

          <div className='rounded-md border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs opacity-80'>
            <span className='font-semibold'>Wallet mode:</span> {selectedMode}
            {selectedMode === 'LIVE' && !hasCompatibleLiveApiKey ? (
              <div className='mt-1 text-error'>Selected LIVE wallet has no linked API key.</div>
            ) : null}
          </div>
        </section>

        <section className='space-y-3 rounded-box border border-base-300/60 bg-base-200/55 p-3'>
          <h2 className='text-base font-semibold'>{t('dashboard.bots.create.sectionContext')}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='form-control gap-1'>
              <span className='label-text'>{t('dashboard.bots.create.strategyLabel')}</span>
              <select
                className='select select-bordered'
                aria-label={t('dashboard.bots.create.strategyAria')}
                value={form.strategyId}
                onChange={(event) => setForm((prev) => ({ ...prev, strategyId: event.target.value }))}
              >
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </label>

            <label className='form-control gap-1'>
              <span className='label-text'>{t('dashboard.bots.create.marketGroupLabel')}</span>
              <select
                className='select select-bordered'
                aria-label={t('dashboard.bots.create.marketGroupAria')}
                value={form.marketGroupId}
                onChange={(event) => setForm((prev) => ({ ...prev, marketGroupId: event.target.value }))}
              >
                {marketGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.exchange ?? 'BINANCE'} - {group.marketType}/{group.baseCurrency})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!walletContextMatches ? (
            <div className='alert alert-warning'>
              <span>Wallet and market group contexts must match: exchange, market type, base currency.</span>
            </div>
          ) : null}

          {selectedStrategy ? (
            <div className='rounded-md border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs opacity-80'>
              <span className='font-semibold'>{t('dashboard.bots.create.strategySummaryLabel')}:</span>{' '}
              {selectedStrategy.interval.toUpperCase()} | x{selectedStrategy.leverage} | max open{' '}
              {deriveStrategyMaxOpenPositions(selectedStrategy)}
            </div>
          ) : null}
        </section>
      </fieldset>

    </form>
  );
}
