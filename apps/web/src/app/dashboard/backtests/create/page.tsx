'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestCreateForm from '@/features/backtest/components/BacktestCreateForm';
import { createBacktestRun } from '@/features/backtest/services/backtests.service';
import { CreateBacktestRunInput } from '@/features/backtest/types/backtest.type';
import { useI18n } from '@/i18n/I18nProvider';
import { runAsyncWithState } from '@/lib/async';
import { resolveUiErrorMessage } from '@/lib/errorResolver';
import { LuChartLine, LuPlus, LuSave } from 'react-icons/lu';

const BACKTEST_FORM_ID = 'backtest-form-create';

export default function BacktestsCreatePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const createLabel = t('dashboard.backtests.createLabel');
  const saveLabel = t('dashboard.backtests.saveLabel');
  const savingLabel = t('dashboard.backtests.createForm.creating');

  const handleCreate = async (payload: CreateBacktestRunInput) => {
    const createFailed = t('dashboard.backtests.toastCreateFailed');
    try {
      await runAsyncWithState(setSubmitting, async () => {
        const created = await createBacktestRun(payload);
        toast.success(t('dashboard.backtests.toastCreated'));
        router.push(`/dashboard/backtests/${created.id}`);
      });
    } catch (error: unknown) {
      toast.error(createFailed, {
        description: resolveUiErrorMessage(error, { fallback: createFailed }),
      });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.nav.backtests')}
        icon={<LuChartLine className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.nav.backtests'), href: '/dashboard/backtests/list' },
          { label: createLabel, icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button type='submit' form={BACKTEST_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS} disabled={submitting}>
            <LuSave className='h-4 w-4' />
            {submitting ? savingLabel : saveLabel}
          </button>
        }
      />

      <BacktestCreateForm formId={BACKTEST_FORM_ID} submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}

