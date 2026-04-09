'use client';

import { useParams } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestRunDetails from '@/features/backtest/components/BacktestRunDetails';
import { useI18n } from '@/i18n/I18nProvider';
import { LuChartLine, LuList } from 'react-icons/lu';

export default function BacktestsDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.nav.backtest')}
        icon={<LuChartLine className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.nav.backtests'), href: '/dashboard/backtests/list' },
          { label: t('dashboard.logs.tableDetails'), icon: <LuList className='h-3.5 w-3.5' /> },
        ]}
      />

      <BacktestRunDetails runId={id} />
    </section>
  );
}

