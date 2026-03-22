'use client';

import { useParams, useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestRunDetails from '@/features/backtest/components/BacktestRunDetails';

export default function BacktestsDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Podglad backtestu'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Backtests', href: '/dashboard/backtests/list' },
          { label: 'Details' },
        ]}
        onAdd={() => router.push('/dashboard/backtests/create')}
        addLabel='Nowy backtest'
      />

      <BacktestRunDetails runId={id} />
    </section>
  );
}

