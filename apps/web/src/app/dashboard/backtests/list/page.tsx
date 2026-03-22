'use client';

import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestsListView from '@/features/backtest/components/BacktestsListView';

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

