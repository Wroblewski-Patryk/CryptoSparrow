'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import { ErrorState, LoadingState } from '@/ui/components/ViewState';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { getMarketUniverse, updateMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput, MarketUniverse } from '@/features/markets/types/marketUniverse.type';
import { handleError } from '@/lib/handleError';
import { LuChartCandlestick } from 'react-icons/lu';

const MARKET_UNIVERSE_ACTIVE_BOT_ERROR = 'market universe is used by active bot and cannot be edited';

export default function MarketsEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<MarketUniverse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMarketUniverse(id);
        setInitial(data);
      } catch (err: unknown) {
        setError(handleError(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleUpdate = async (payload: CreateMarketUniverseInput) => {
    setSubmitting(true);
    try {
      const updated = await updateMarketUniverse(id, payload);
      setInitial(updated);
      toast.success('Grupa rynkow zaktualizowana');
    } catch (err: unknown) {
      const message = handleError(err);
      if (message === MARKET_UNIVERSE_ACTIVE_BOT_ERROR) {
        toast.error('Grupa rynkow jest aktualnie uzywana przez aktywnego bota', {
          description: 'Wylacz bota, a potem zapisz zmiany.',
        });
      } else {
        toast.error('Nie udalo sie zapisac zmian', { description: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={initial ? `Edytuj: ${initial.name}` : 'Edycja grupy rynkow'}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Markets', href: '/dashboard/markets/list' },
          { label: 'Edit' },
        ]}
      />

      {loading ? <LoadingState title='Ladowanie grupy rynkow' /> : null}
      {!loading && error ? (
        <ErrorState
          title='Nie udalo sie pobrac grupy rynkow'
          description={error}
          retryLabel='Powrot do listy'
          onRetry={() => router.push('/dashboard/markets/list')}
        />
      ) : null}
      {!loading && !error && initial ? (
        <MarketUniverseForm
          mode='edit'
          initial={initial}
          submitLabel='Zapisz zmiany'
          submitting={submitting}
          onSubmit={handleUpdate}
        />
      ) : null}
    </section>
  );
}

