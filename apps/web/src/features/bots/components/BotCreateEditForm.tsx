'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/i18n/I18nProvider';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/ViewState';
import { useAsyncConfirm } from '@/ui/components/useAsyncConfirm';
import { listMarketUniverses } from '@/features/markets/services/markets.service';
import { MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { listStrategies } from '@/features/strategies/api/strategies.api';
import { StrategyDto } from '@/features/strategies/types/StrategyForm.type';
import { supportsExchangeCapability } from '@/features/exchanges/exchangeCapabilities';
import { listWallets } from '@/features/wallets/services/wallets.service';
import { Wallet } from '@/features/wallets/types/wallet.type';
import { getAxiosMessage } from '@/lib/getAxiosMessage';
import { normalizeSymbol } from '@/lib/symbols';
import { FormAlert, FormGrid, FormSectionCard, FormValidationSummary, SelectField, TextField, ToggleField } from '@/ui/forms';
import {
  createBot,
  getBot,
  getBotRuntimeGraph,
  updateBot,
} from '../services/bots.service';

const LIVE_CONSENT_TEXT_VERSION = 'mvp-v1';
const DUPLICATE_ACTIVE_BOT_ERROR =
  'active bot already exists for this wallet + strategy + market group tuple';

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
  const { confirm, confirmModal } = useAsyncConfirm();
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyDto[]>([]);
  const [marketGroups, setMarketGroups] = useState<MarketUniverse[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showValidation, setShowValidation] = useState(false);
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
  const walletOptions = useMemo(
    () =>
      wallets.map((wallet) => ({
        value: wallet.id,
        label: `${wallet.name} (${wallet.mode} / ${wallet.exchange} / ${wallet.marketType} / ${wallet.baseCurrency})`,
      })),
    [wallets]
  );
  const strategyOptions = useMemo(
    () =>
      strategies.map((strategy) => ({
        value: strategy.id,
        label: strategy.name,
      })),
    [strategies]
  );
  const marketGroupOptions = useMemo(
    () =>
      marketGroups.map((group) => ({
        value: group.id,
        label: `${group.name} (${group.exchange ?? 'BINANCE'} - ${group.marketType}/${group.baseCurrency})`,
      })),
    [marketGroups]
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
      normalizeSymbol(selectedWallet.baseCurrency) === normalizeSymbol(selectedMarketGroup.baseCurrency)
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
  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof BotFormState, string>> = {};
    if (!form.name.trim()) {
      errors.name = t('dashboard.bots.create.nameRequiredValidation');
    }
    if (!form.walletId) {
      errors.walletId = t('dashboard.bots.create.walletRequiredValidation');
    }
    if (!form.strategyId) {
      errors.strategyId = t('dashboard.bots.create.strategyRequiredValidation');
    }
    if (!form.marketGroupId) {
      errors.marketGroupId = t('dashboard.bots.create.marketGroupRequiredValidation');
    }
    return errors;
  }, [form.marketGroupId, form.name, form.strategyId, form.walletId, t]);
  const hasValidationErrors = Object.keys(fieldErrors).length > 0;
  const validationSummaryErrors = useMemo(
    () => Object.values(fieldErrors).filter((value): value is string => Boolean(value)),
    [fieldErrors]
  );
  const focusFirstInvalidField = useCallback(() => {
    const firstKey = (Object.keys(fieldErrors) as Array<keyof BotFormState>)[0];
    if (!firstKey) return;
    const fieldIdByKey: Record<keyof BotFormState, string> = {
      name: 'bot-name',
      walletId: 'bot-wallet',
      strategyId: 'bot-strategy',
      marketGroupId: 'bot-market-group',
      isActive: 'bot-active',
      liveOptIn: 'bot-live-opt-in',
    };
    const target = document.getElementById(fieldIdByKey[firstKey]);
    if (!target) return;
    if (typeof target.focus === 'function') {
      target.focus();
    }
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [fieldErrors]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowValidation(true);
    if (hasValidationErrors) {
      toast.error(t('dashboard.bots.create.description'));
      focusFirstInvalidField();
      return;
    }
    if (!walletContextMatches) {
      toast.error(t('dashboard.bots.create.walletContextMismatchValidation'));
      return;
    }
    if (form.isActive && !canActivateForMode) {
      toast.error(t('dashboard.bots.create.placeholderActivationBlocked'));
      return;
    }
    if (selectedMode === 'LIVE' && form.isActive && !hasCompatibleLiveApiKey) {
      toast.error(t('dashboard.bots.create.liveApiKeyMissingValidation'));
      return;
    }

    const needsLiveConfirm = selectedMode === 'LIVE';
    if (needsLiveConfirm) {
      const message = isEditMode
        ? t('dashboard.bots.confirms.liveSave')
        : t('dashboard.bots.confirms.liveCreate');
      const accepted = await confirm({
        title: t('dashboard.bots.list.columns.liveOptIn'),
        description: message,
        confirmLabel: t('dashboard.home.runtime.apply'),
        cancelLabel: t('dashboard.home.runtime.reset'),
        confirmVariant: 'error',
      });
      if (!accepted) return;
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
        title={t('dashboard.bots.create.noWalletsTitle')}
        description={t('dashboard.bots.create.noWalletsDescription')}
      />
    );
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} className='space-y-4'>
        {showValidation && hasValidationErrors ? (
          <FormValidationSummary
            title={t('dashboard.bots.create.validationSummaryTitle')}
            errors={validationSummaryErrors}
          />
        ) : null}
        <fieldset disabled={submitting} className='space-y-4'>
          <FormSectionCard
            title={t('dashboard.bots.create.sectionSetup')}
            description={t('dashboard.bots.create.sectionSetupDescription')}
            className='bg-base-100/80'
          >
            <FormGrid columns={3}>
              <TextField
                id='bot-name'
                label={t('dashboard.bots.create.nameLabel')}
                placeholder={t('dashboard.bots.create.namePlaceholder')}
                value={form.name}
                onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                error={showValidation ? fieldErrors.name : undefined}
              />

              <SelectField
                id='bot-wallet'
                label={t('dashboard.bots.create.walletSummaryLabel')}
                value={form.walletId}
                options={walletOptions}
                onChange={(value) => setForm((prev) => ({ ...prev, walletId: value }))}
                error={showValidation ? fieldErrors.walletId : undefined}
              />

              <SelectField
                id='bot-strategy'
                label={t('dashboard.bots.create.strategyLabel')}
                value={form.strategyId}
                options={strategyOptions}
                onChange={(value) => setForm((prev) => ({ ...prev, strategyId: value }))}
                error={showValidation ? fieldErrors.strategyId : undefined}
              />

              <SelectField
                id='bot-market-group'
                label={t('dashboard.bots.create.marketGroupLabel')}
                value={form.marketGroupId}
                options={marketGroupOptions}
                onChange={(value) => setForm((prev) => ({ ...prev, marketGroupId: value }))}
                className='xl:col-span-2'
                error={showValidation ? fieldErrors.marketGroupId : undefined}
              />

              <ToggleField
                id='bot-active'
                label={t('dashboard.bots.list.columns.active')}
                checked={form.isActive}
                onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                disabled={!canActivateForMode || !walletContextMatches}
              />
            </FormGrid>

            <FormGrid columns={2} className='mt-1'>
              {selectedMode === 'LIVE' ? (
                <ToggleField
                  id='bot-live-opt-in'
                  label={t('dashboard.bots.list.columns.liveOptIn')}
                  checked={form.liveOptIn}
                  onChange={(checked) => setForm((prev) => ({ ...prev, liveOptIn: checked }))}
                  hint={t('dashboard.bots.create.liveOptInHelper')}
                />
              ) : (
                <FormAlert variant='info' className='h-fit'>
                  {t('dashboard.bots.create.liveOptInPaperInfo')}
                </FormAlert>
              )}

              <div
                data-testid='wallet-context-summary'
                className='rounded-md border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs opacity-80 space-y-1'
              >
                <div>
                  <span className='font-semibold'>{t('dashboard.bots.create.walletSummaryLabel')}:</span>{' '}
                  {selectedWallet?.name ?? '-'}
                </div>
                <div>
                  <span className='font-semibold'>{t('dashboard.bots.create.walletContextModeLabel')}:</span> {selectedMode}
                </div>
                <div>
                  <span className='font-semibold'>{t('dashboard.bots.create.walletContextVenueLabel')}:</span>{' '}
                  {selectedWallet
                    ? `${selectedWallet.exchange} / ${selectedWallet.marketType} / ${selectedWallet.baseCurrency}`
                    : '-'}
                </div>
                {selectedMode === 'LIVE' ? (
                  <div className={hasCompatibleLiveApiKey ? '' : 'text-error'}>
                    <span className='font-semibold'>{t('dashboard.bots.create.walletContextApiKeyLabel')}:</span>{' '}
                    {hasCompatibleLiveApiKey
                      ? t('dashboard.bots.create.walletContextApiKeyReady')
                      : t('dashboard.bots.create.walletContextApiKeyMissing')}
                  </div>
                ) : null}
              </div>
            </FormGrid>

            {!walletContextMatches ? (
              <FormAlert variant='warning'>{t('dashboard.bots.create.walletContextMismatchAlert')}</FormAlert>
            ) : null}

            {selectedStrategy ? (
              <div className='rounded-md border border-base-300/60 bg-base-100/70 px-3 py-2 text-xs opacity-80'>
                <span className='font-semibold'>{t('dashboard.bots.create.strategyLabel')}:</span>{' '}
                {selectedStrategy.interval.toUpperCase()} | {t('dashboard.bots.create.leverageLabel')}: x
                {selectedStrategy.leverage} | {t('dashboard.bots.create.maxOpenLabel')}:{' '}
                {deriveStrategyMaxOpenPositions(selectedStrategy)}
              </div>
            ) : null}
          </FormSectionCard>
        </fieldset>
      </form>
      {confirmModal}
    </>
  );
}
