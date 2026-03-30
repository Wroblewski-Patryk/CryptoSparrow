'use client';

import { useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestRunDetails from '@/features/backtest/components/BacktestRunDetails';
import { I18nContext } from '../../../../i18n/I18nProvider';

export default function BacktestsDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          title: 'Backtest details',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbDetails: 'Details',
          add: 'New backtest',
        }
      : {
          title: 'Podglad backtestu',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbDetails: 'Details',
          add: 'Nowy backtest',
        };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        breadcrumb={[
          { label: copy.breadcrumbDashboard, href: '/dashboard' },
          { label: copy.breadcrumbBacktests, href: '/dashboard/backtests/list' },
          { label: copy.breadcrumbDetails },
        ]}
        onAdd={() => router.push('/dashboard/backtests/create')}
        addLabel={copy.add}
      />

      <BacktestRunDetails runId={id} />
    </section>
  );
}

