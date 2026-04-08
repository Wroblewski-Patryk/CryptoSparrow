'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import MarketUniverseForm from '@/features/markets/components/MarketUniverseForm';
import { createMarketUniverse } from '@/features/markets/services/markets.service';
import { CreateMarketUniverseInput } from '@/features/markets/types/marketUniverse.type';
import { handleError } from '@/lib/handleError';
import { LuChartCandlestick, LuPlus, LuSave } from 'react-icons/lu';
import { useI18n } from '@/i18n/I18nProvider';

const MARKET_FORM_ID = 'market-universe-form-create';

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
            title: 'Rynki',
            breadcrumbMarkets: 'Rynki',
            breadcrumbCreate: 'Tworzenie',
            submitLabel: 'Save',
          }
        : {
            created: 'Market group created',
            createFailed: 'Could not create market group',
            title: 'Markets',
            breadcrumbMarkets: 'Markets',
            breadcrumbCreate: 'Create',
            submitLabel: 'Save',
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
          { label: copy.breadcrumbCreate, icon: <LuPlus className='h-3.5 w-3.5' /> },
        ]}
        actions={
          <button type='submit' form={MARKET_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {copy.submitLabel}
          </button>
        }
      />

      <MarketUniverseForm formId={MARKET_FORM_ID} mode='create' submitting={submitting} onSubmit={handleCreate} />
    </section>
  );
}
