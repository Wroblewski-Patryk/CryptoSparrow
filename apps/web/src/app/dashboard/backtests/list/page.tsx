'use client';

import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import BacktestsListView from '@/features/backtest/components/BacktestsListView';
import { useI18n } from '@/i18n/I18nProvider';
import { LuChartLine, LuList } from 'react-icons/lu';

export default function BacktestsListPage() {
  const router = useRouter();
  const { t } = useI18n();
  const listLabel = t('dashboard.backtests.listLabel');
  const createLabel = t('dashboard.backtests.createLabel');

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.nav.backtests')}
        icon={<LuChartLine className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.nav.backtests'), href: '/dashboard/backtests/list' },
          { label: listLabel, icon: <LuList className='h-3.5 w-3.5' /> },
        ]}
        onAdd={() => router.push('/dashboard/backtests/create')}
        addLabel={createLabel}
      />

      <BacktestsListView />
    </section>
  );
}

