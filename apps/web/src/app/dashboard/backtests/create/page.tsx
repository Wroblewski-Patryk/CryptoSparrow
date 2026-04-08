'use client';

import { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestCreateForm from '@/features/backtest/components/BacktestCreateForm';
import { createBacktestRun } from '@/features/backtest/services/backtests.service';
import { CreateBacktestRunInput } from '@/features/backtest/types/backtest.type';
import { handleError } from '@/lib/handleError';
import { I18nContext } from '../../../../i18n/I18nProvider';
import { LuChartLine, LuPlus, LuSave } from 'react-icons/lu';

const BACKTEST_FORM_ID = 'backtest-form-create';

export default function BacktestsCreatePage() {
  const router = useRouter();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          success: 'Backtest run created',
          error: 'Could not create backtest run',
          title: 'Backtests',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbCreate: 'Create',
          submit: 'Save',
        }
      : {
          success: 'Run backtestu utworzony',
          error: 'Nie udalo sie utworzyc runa backtestu',
          title: 'Backtesty',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbCreate: 'Create',
          submit: 'Save',
        };
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload: CreateBacktestRunInput) => {
    setSubmitting(true);
    try {
      const created = await createBacktestRun(payload);
      toast.success(copy.success);
      router.push(`/dashboard/backtests/${created.id}`);
    } catch (error: unknown) {
      toast.error(copy.error, { description: handleError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuChartLine className='h-5 w-5' />}
        breadcrumb={[
          { label: copy.breadcrumbDashboard, href: '/dashboard' },
          { label: copy.breadcrumbBacktests, href: '/dashboard/backtests/list' },
          { label: copy.breadcrumbCreate, icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button type='submit' form={BACKTEST_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {copy.submit}
          </button>
        }
      />

      <BacktestCreateForm formId={BACKTEST_FORM_ID} submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}

