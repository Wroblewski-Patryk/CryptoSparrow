'use client';

import { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestCreateForm from '@/features/backtest/components/BacktestCreateForm';
import { createBacktestRun } from '@/features/backtest/services/backtests.service';
import { CreateBacktestRunInput } from '@/features/backtest/types/backtest.type';
import { handleError } from '@/lib/handleError';
import { I18nContext } from '../../../../i18n/I18nProvider';

export default function BacktestsCreatePage() {
  const router = useRouter();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          success: 'Backtest run created',
          error: 'Could not create backtest run',
          title: 'New backtest',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbCreate: 'Create',
          submit: 'Create run',
        }
      : {
          success: 'Run backtestu utworzony',
          error: 'Nie udalo sie utworzyc runa backtestu',
          title: 'Nowy backtest',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbCreate: 'Create',
          submit: 'Utworz run',
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
        breadcrumb={[
          { label: copy.breadcrumbDashboard, href: '/dashboard' },
          { label: copy.breadcrumbBacktests, href: '/dashboard/backtests/list' },
          { label: copy.breadcrumbCreate },
        ]}
      />

      <BacktestCreateForm submitting={submitting} submitLabel={copy.submit} onSubmit={handleCreate} />
    </section>
  );
}

