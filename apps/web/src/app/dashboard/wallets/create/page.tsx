'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { LuPencilLine, LuPlus, LuSave, LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import WalletCreateEditForm from '@/features/wallets/components/WalletCreateEditForm';

const WALLET_FORM_ID = 'wallet-form-create';

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
            title: 'Portfele',
            breadcrumbWallets: 'Portfele',
            breadcrumbCreate: 'Dodaj',
            breadcrumbEdit: 'Edycja',
            submitLabel: 'Save',
          }
        : {
            title: 'Wallets',
            breadcrumbWallets: 'Wallets',
            breadcrumbCreate: 'Create',
            breadcrumbEdit: 'Edit',
            submitLabel: 'Save',
          },
    [locale]
  );

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuWallet className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbWallets, href: '/dashboard/wallets/list' },
          {
            label: isEditMode ? copy.breadcrumbEdit : copy.breadcrumbCreate,
            icon: isEditMode ? <LuPencilLine className='h-3.5 w-3.5' /> : <LuPlus className='h-3.5 w-3.5' />,
          },
        ]}
        actions={
          <button type='submit' form={WALLET_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {copy.submitLabel}
          </button>
        }
      />

      <WalletCreateEditForm formId={WALLET_FORM_ID} editId={editId} />
    </section>
  );
}
