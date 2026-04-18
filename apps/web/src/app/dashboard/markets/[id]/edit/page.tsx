'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { getMarketUniverse, updateMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput, MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';
import { LuChartCandlestick, LuPencilLine, LuSave } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const MARKET_UNIVERSE_ACTIVE_BOT_ERROR = 'market universe is used by active bot and cannot be edited';
const MARKET_FORM_ID = 'market-universe-form-edit';

export default function MarketsEditPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<MarketUniverse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = {
    updated: t('dashboard.markets.page.updated'),
    activeBotTitle: t('dashboard.markets.page.activeBotTitle'),
    activeBotDescription: t('dashboard.markets.page.activeBotDescription'),
    saveFailed: t('dashboard.markets.page.saveFailed'),
    titleFallback: t('dashboard.markets.title'),
    breadcrumbMarkets: t('dashboard.markets.title'),
    breadcrumbEdit: t('dashboard.markets.editLabel'),
    loading: t('dashboard.markets.page.loading'),
    errorTitle: t('dashboard.markets.page.errorTitle'),
    backToList: t('dashboard.markets.page.backToList'),
    submitLabel: t('dashboard.markets.saveLabel'),
    updatePrefix: t('dashboard.markets.page.updatePrefix'),
  } as const;

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        await runAsyncWithState(setLoading, async () => {
          const data = await getMarketUniverse(id);
          setInitial(data);
        });
      } catch (err: unknown) {
        setError(resolveUiErrorMessage(err, { fallback: copy.errorTitle }) ?? copy.errorTitle);
      }
    };
    void load();
  }, [copy.errorTitle, id]);

  const handleUpdate = async (payload: CreateMarketUniverseInput) => {
    try {
      await runAsyncWithState(setSubmitting, async () => {
        const updated = await updateMarketUniverse(id, payload);
        setInitial(updated);
        toast.success(copy.updated);
      });
    } catch (err: unknown) {
      const message = resolveUiErrorMessage(err, { fallback: copy.saveFailed }) ?? copy.saveFailed;
      if (message === MARKET_UNIVERSE_ACTIVE_BOT_ERROR) {
        toast.error(copy.activeBotTitle, { description: copy.activeBotDescription });
      } else {
        toast.error(copy.saveFailed, { description: message });
      }
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.titleFallback}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: copy.breadcrumbMarkets, href: '/dashboard/markets/list' },
          {
            label: initial ? `${copy.updatePrefix} ${initial.name}` : copy.breadcrumbEdit,
            icon: <LuPencilLine className='h-3.5 w-3.5' />,
          },
        ]}
        actions={
          <button type='submit' form={MARKET_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS} disabled={submitting}>
            <LuSave className='h-4 w-4' />
            {copy.submitLabel}
          </button>
        }
      />

      {loading ? <LoadingState title={copy.loading} /> : null}
      {!loading && error ? (
        <ErrorState
          title={copy.errorTitle}
          description={error}
          retryLabel={copy.backToList}
          onRetry={() => router.push('/dashboard/markets/list')}
        />
      ) : null}
      {!loading && !error && initial ? (
        <MarketUniverseForm
          formId={MARKET_FORM_ID}
          mode='edit'
          initial={initial}
          submitting={submitting}
          onSubmit={handleUpdate}
        />
      ) : null}
    </section>
  );
}
