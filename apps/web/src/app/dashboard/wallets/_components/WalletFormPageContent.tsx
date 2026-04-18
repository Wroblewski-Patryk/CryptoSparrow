'use client';

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
  const { t } = useI18n();
  const isEditMode = mode === 'edit';

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.wallets.title')}
        icon={<LuWallet className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.wallets.title'), href: dashboardRoutes.wallets.list },
          {
            label: isEditMode ? t('dashboard.wallets.editLabel') : t('dashboard.wallets.createLabel'),
            icon: isEditMode ? <LuPencilLine className='h-3.5 w-3.5' /> : <LuPlus className='h-3.5 w-3.5' />,
          },
        ]}
        actions={
          <button type='submit' form={WALLET_FORM_ID} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {t('dashboard.wallets.saveLabel')}
          </button>
        }
      />

      <WalletCreateEditForm formId={WALLET_FORM_ID} editId={isEditMode ? editId ?? null : null} />
    </section>
  );
}
