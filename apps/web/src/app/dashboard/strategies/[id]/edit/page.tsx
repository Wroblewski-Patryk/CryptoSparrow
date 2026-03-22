'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import StrategiesForm from '@/features/strategies/components/StrategyForm';
import { getStrategy, updateStrategy } from '@/features/strategies/api/strategies.api';
import { StrategyFormState } from '@/features/strategies/types/StrategyForm.type';
import { dtoToForm } from '@/features/strategies/utils/StrategyForm.map';
import { handleError } from '@/lib/handleError';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';

export default function StrategiesEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<StrategyFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStrategy(id);
        setInitial(dtoToForm(data));
      } catch (err: unknown) {
        setError(handleError(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const handleUpdate = async (form: StrategyFormState) => {
    try {
      await updateStrategy(id, form);
      toast.success('Strategia zaktualizowana');
    } catch (error: unknown) {
      toast.error('Blad zapisu strategii', { description: handleError(error) });
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={initial ? initial.name : 'Edycja strategii'}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Strategies', href: '/dashboard/strategies/list' },
          { label: 'Edit' },
        ]}
        onAdd={() => router.push('/dashboard/strategies/create')}
        addLabel='Nowa strategia'
      />

      {loading ? <LoadingState title='Ladowanie strategii' /> : null}
      {!loading && error ? (
        <ErrorState
          title='Nie udalo sie pobrac strategii'
          description={error}
          retryLabel='Powrot do listy'
          onRetry={() => router.push('/dashboard/strategies/list')}
        />
      ) : null}
      {!loading && !error && initial ? <StrategiesForm initial={initial} onSubmit={handleUpdate} /> : null}
    </section>
  );
}

