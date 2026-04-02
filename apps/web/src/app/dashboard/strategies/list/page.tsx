'use client';

import { useRouter } from 'next/navigation';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesList from '@/features/strategies/components/StrategiesList';
import { LuListChecks } from 'react-icons/lu';

export default function StrategiesListPage() {
  const router = useRouter();

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Strategie'
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Strategies', href: '/dashboard/strategies/list' },
          { label: 'List' },
        ]}
        onAdd={() => router.push('/dashboard/strategies/create')}
        addLabel='Nowa strategia'
      />

      <StrategiesList />
    </section>
  );
}

