'use client';

import { useContext } from 'react';
import { useParams } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestRunDetails from '@/features/backtest/components/BacktestRunDetails';
import { I18nContext } from '../../../../i18n/I18nProvider';
import { LuChartLine, LuList } from 'react-icons/lu';

export default function BacktestsDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const i18n = useContext(I18nContext);
  const locale = i18n?.locale === 'en' ? 'en' : 'pl';
  const copy =
    locale === 'en'
      ? {
          title: 'Backtest',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbDetails: 'Details',
        }
      : {
          title: 'Backtest',
          breadcrumbDashboard: 'Dashboard',
          breadcrumbBacktests: 'Backtests',
          breadcrumbDetails: 'Details',
        };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuChartLine className='h-5 w-5' />}
        breadcrumb={[
          { label: copy.breadcrumbDashboard, href: '/dashboard' },
          { label: copy.breadcrumbBacktests, href: '/dashboard/backtests/list' },
          { label: copy.breadcrumbDetails, icon: <LuList className='h-3.5 w-3.5' /> },
        ]}
      />

      <BacktestRunDetails runId={id} />
    </section>
  );
}

