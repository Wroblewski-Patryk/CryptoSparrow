'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import BacktestCreateForm from 'apps/client/src/features/backtest/components/BacktestCreateForm';
import { createBacktestRun } from 'apps/client/src/features/backtest/services/backtests.service';
import { CreateBacktestRunInput } from 'apps/client/src/features/backtest/types/backtest.type';
import { handleError } from 'apps/client/src/lib/handleError';

export default function BacktestsCreatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload: CreateBacktestRunInput) => {
    setSubmitting(true);
    try {
      const created = await createBacktestRun(payload);
      toast.success('Run backtestu utworzony');
      router.push(`/dashboard/backtests/${created.id}`);
    } catch (error: unknown) {
      toast.error('Nie udalo sie utworzyc runa backtestu', { description: handleError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Nowy backtest'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Backtests', href: '/dashboard/backtests/list' },
          { label: 'Create' },
        ]}
      />

      <BacktestCreateForm submitting={submitting} submitLabel='Utworz run' onSubmit={handleCreate} />
    </section>
  );
}
