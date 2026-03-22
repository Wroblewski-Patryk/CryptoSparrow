'use client';

import { useRouter } from 'next/navigation';
import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import BacktestsListView from 'apps/client/src/features/backtest/components/BacktestsListView';

export default function BacktestsListPage() {
  const router = useRouter();

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Backtesty'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Backtests', href: '/dashboard/backtests/list' },
          { label: 'List' },
        ]}
        onAdd={() => router.push('/dashboard/backtests/create')}
        addLabel='Nowy backtest'
      />

      <BacktestsListView />
    </section>
  );
}
