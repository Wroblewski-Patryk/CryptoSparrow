'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { createStrategy } from '@/features/strategies/api/strategies.api';
import { handleError } from '@/lib/handleError';
import { LuListChecks } from 'react-icons/lu';

export default function StrategiesCreatePage() {
  const router = useRouter();

  const handleCreate = async (form: StrategyFormState) => {
    try {
      const created = await createStrategy(form);
      toast.success('Strategia utworzona');
      router.push(`/dashboard/strategies/${created.id}/edit`);
    } catch (error: unknown) {
      toast.error('Blad tworzenia strategii', { description: handleError(error) });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Nowa strategia'
        icon={<LuListChecks className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Strategies', href: '/dashboard/strategies/list' },
          { label: 'Create' },
        ]}
      />

      <StrategiesForm onSubmit={handleCreate} />
    </section>
  );
}

