'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { createMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput } from '@/features/markets/types/marketUniverse.type';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';
import { LuChartCandlestick, LuPlus, LuSave } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const MARKET_FORM_ID = 'market-universe-form-create';

export default function MarketsCreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload: CreateMarketUniverseInput) => {
    const createdMessage = t('dashboard.markets.page.created');
    const createFailedMessage = t('dashboard.markets.page.createFailed');

    try {
      await runAsyncWithState(setSubmitting, async () => {
        const created = await createMarketUniverse(payload);
        toast.success(createdMessage);
        router.push(`/dashboard/markets/${created.id}/edit`);
      });
    } catch (error: unknown) {
      toast.error(createFailedMessage, {
        description: resolveUiErrorMessage(error, { fallback: createFailedMessage }),
      });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.markets.title')}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.markets.title'), href: '/dashboard/markets/list' },
          { label: t('dashboard.markets.createLabel'), icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button type='submit' form={MARKET_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {t('dashboard.markets.saveLabel')}
          </button>
        }
      />

      <MarketUniverseForm formId={MARKET_FORM_ID} mode='create' submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}
