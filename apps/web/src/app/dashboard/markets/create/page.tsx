'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { createMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput } from '@/features/markets/types/marketUniverse.type';
import { handleError } from '@/lib/handleError';
import { LuChartCandlestick } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

export default function MarketsCreatePage() {
  const { locale } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            created: 'Grupa rynkow utworzona',
            createFailed: 'Nie udalo sie utworzyc grupy rynkow',
            title: 'Dodaj grupe rynkow',
            breadcrumbMarkets: 'Rynki',
            breadcrumbCreate: 'Tworzenie',
            submitLabel: 'Utworz grupe',
          }
        : {
            created: 'Market group created',
            createFailed: 'Could not create market group',
            title: 'Add market group',
            breadcrumbMarkets: 'Markets',
            breadcrumbCreate: 'Create',
            submitLabel: 'Create group',
          },
    [locale]
  );

  const handleCreate = async (payload: CreateMarketUniverseInput) => {
    setSubmitting(true);
    try {
      const created = await createMarketUniverse(payload);
      toast.success(copy.created);
      router.push(`/dashboard/markets/${created.id}/edit`);
    } catch (error: unknown) {
      toast.error(copy.createFailed, { description: handleError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuChartCandlestick className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbMarkets, href: '/dashboard/markets/list' },
          { label: copy.breadcrumbCreate },
        ]}
      />

      <MarketUniverseForm mode='create' submitLabel={copy.submitLabel} submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}

