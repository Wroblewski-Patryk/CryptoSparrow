'use client';

import { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestsListView from '@/features/backtest/components/BacktestsListView';
import { I18nContext } from '../../../../i18n/I18nProvider';

export default function BacktestsListPage() {
  const router = useRouter();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          title: 'Backtests',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbList: 'List',
          add: 'New backtest',
        }
      : {
          title: 'Backtesty',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbList: 'List',
          add: 'Nowy backtest',
        };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        breadcrumb={[
          { label: copy.breadcrumbDashboard, href: '/dashboard' },
          { label: copy.breadcrumbBacktests, href: '/dashboard/backtests/list' },
          { label: copy.breadcrumbList },
        ]}
        onAdd={() => router.push('/dashboard/backtests/create')}
        addLabel={copy.add}
      />

      <BacktestsListView />
    </section>
  );
}

