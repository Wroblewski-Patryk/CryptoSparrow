'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { createMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput } from '@/features/markets/types/marketUniverse.type';
import { handleError } from '@/lib/handleError';

export default function MarketsCreatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (payload: CreateMarketUniverseInput) => {
    setSubmitting(true);
    try {
      const created = await createMarketUniverse(payload);
      toast.success('Grupa rynkow utworzona');
      router.push(`/dashboard/markets/${created.id}/edit`);
    } catch (error: unknown) {
      toast.error('Nie udalo sie utworzyc grupy rynkow', { description: handleError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title='Dodaj grupe rynkow'
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Markets', href: '/dashboard/markets/list' },
          { label: 'Create' },
        ]}
      />

      <MarketUniverseForm mode='create' submitLabel='Utworz grupe' submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}

