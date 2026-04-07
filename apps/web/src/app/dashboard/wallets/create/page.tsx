'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { PageTitle } from '@/ui/layout/dashboard/PageTitle';
import WalletCreateEditForm from '@/features/wallets/components/WalletCreateEditForm';

export default function WalletCreatePage() {
  return (
    <Suspense fallback={<section className='w-full space-y-4' />}>
      <WalletCreatePageContent />
    </Suspense>
  );
}

function WalletCreatePageContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const isEditMode = Boolean(editId);
  const { locale } = useI18n();

  const copy = useMemo(
    () =>
      locale === 'pl'
        ? {
            titleCreate: 'Dodaj portfel',
            titleEdit: 'Edytuj portfel',
            breadcrumbWallets: 'Portfele',
            breadcrumbCreate: 'Dodaj',
            breadcrumbEdit: 'Edycja',
          }
        : {
            titleCreate: 'Create wallet',
            titleEdit: 'Edit wallet',
            breadcrumbWallets: 'Wallets',
            breadcrumbCreate: 'Create',
            breadcrumbEdit: 'Edit',
          },
    [locale]
  );

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={isEditMode ? copy.titleEdit : copy.titleCreate}
        icon={<LuWallet className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbWallets, href: '/dashboard/wallets/list' },
          { label: isEditMode ? copy.breadcrumbEdit : copy.breadcrumbCreate },
        ]}
      />

      <WalletCreateEditForm editId={editId} />
    </section>
  );
}
