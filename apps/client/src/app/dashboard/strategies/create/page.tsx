'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageTitle } from 'apps/client/src/ui/layout/dashboard/PageTitle';
import StrategiesForm from 'apps/client/src/features/strategies/components/StrategyForm';
import { StrategyFormState } from 'apps/client/src/features/strategies/types/StrategyForm.type';
import { createStrategy } from 'apps/client/src/features/strategies/api/strategies.api';
import { handleError } from 'apps/client/src/lib/handleError';

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
