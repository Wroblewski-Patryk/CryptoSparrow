'use client';

import { useMemo } from 'react';
import { LuPencilLine, LuPlus, LuSave, LuWallet } from 'react-icons/lu';

import { useI18n } from '@/i18n/I18nProvider';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';
import WalletCreateEditForm from '@/features/wallets/components/WalletCreateEditForm';
import { dashboardRoutes } from '@/ui/layout/dashboard/dashboardRoutes';

const WALLET_FORM_ID = 'wallet-form';

type WalletFormPageContentProps = {
  mode: 'create' | 'edit';
  editId?: string;
};

export default function WalletFormPageContent({ mode, editId }: WalletFormPageContentProps) {
  const { locale } = useI18n();
  const isEditMode = mode === 'edit';

  const copy = useMemo(
    () => ({
      en: {
        title: 'Wallets',
        breadcrumbWallets: 'Wallets',
        breadcrumbCreate: 'Create',
        breadcrumbEdit: 'Edit',
        submitLabel: 'Save',
      },
      pl: {
        title: 'Portfele',
        breadcrumbWallets: 'Portfele',
        breadcrumbCreate: 'Dodaj',
        breadcrumbEdit: 'Edycja',
        submitLabel: 'Save',
      },
      pt: {
        title: 'Carteiras',
        breadcrumbWallets: 'Carteiras',
        breadcrumbCreate: 'Criar',
        breadcrumbEdit: 'Editar',
        submitLabel: 'Save',
      },
    } as const)[locale],
    [locale]
  );

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={copy.title}
        icon={<LuWallet className='h-5 w-5' />}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: copy.breadcrumbWallets, href: dashboardRoutes.wallets.list },
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

      <WalletCreateEditForm formId={WALLET_FORM_ID} editId={isEditMode ? editId ?? null : null} />
    </section>
  );
}
