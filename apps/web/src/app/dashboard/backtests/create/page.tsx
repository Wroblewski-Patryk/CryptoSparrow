'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestCreateForm from '@/features/backtest/components/BacktestCreateForm';
import { createBacktestRun } from '@/features/backtest/services/backtests.service';
import { CreateBacktestRunInput } from '@/features/backtest/types/backtest.type';
import { useI18n } from '@/i18n/I18nProvider';
import { handleError } from '@/lib/handleError';
import { LuChartLine, LuPlus, LuSave } from 'react-icons/lu';

const BACKTEST_FORM_ID = 'backtest-form-create';

export default function BacktestsCreatePage() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload: CreateBacktestRunInput) => {
    setSubmitting(true);
    try {
      const created = await createBacktestRun(payload);
      toast.success(locale === 'en' ? 'Backtest run created' : 'Run backtestu utworzony');
      router.push(`/dashboard/backtests/${created.id}`);
    } catch (error: unknown) {
      toast.error(locale === 'en' ? 'Could not create backtest run' : 'Nie udalo sie utworzyc runa backtestu', {
        description: handleError(error),
      });
    } finally {
      setSubmitting(false);
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
          { label: t('dashboard.nav.createBacktest'), icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button type='submit' form={BACKTEST_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            Save
          </button>
        }
      />

      <BacktestCreateForm formId={BACKTEST_FORM_ID} submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}

