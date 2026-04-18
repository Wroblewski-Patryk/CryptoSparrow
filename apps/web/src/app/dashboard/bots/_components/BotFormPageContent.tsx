'use client';

import { LuBot, LuPencilLine, LuPlus, LuSave } from 'react-icons/lu';

import BotCreateEditForm from '@/features/bots/components/BotCreateEditForm';
import { useI18n } from '@/i18n/I18nProvider';
import { PAGE_TITLE_ACTION_SAVE_CLASS, PageTitle } from '@/ui/layout/dashboard/PageTitle';

type BotFormPageContentProps = {
  mode: 'create' | 'edit';
  editId?: string;
};

export default function BotFormPageContent({ mode, editId }: BotFormPageContentProps) {
  const { t } = useI18n();
  const isEditMode = mode === 'edit';
  const formId = isEditMode ? 'bot-form-edit' : 'bot-form-create';

  return (
    <section className='w-full space-y-4'>
      <PageTitle
        title={t('dashboard.nav.bots')}
        icon={<LuBot className='h-5 w-5' />}
        breadcrumb={[
          { label: t('dashboard.common.dashboard'), href: '/dashboard' },
          { label: t('dashboard.nav.bots'), href: '/dashboard/bots' },
          {
            label: isEditMode ? t('dashboard.bots.page.breadcrumbUpdate') : t('dashboard.bots.page.breadcrumbCreate'),
            icon: isEditMode ? <LuPencilLine className='h-3.5 w-3.5' /> : <LuPlus className='h-3.5 w-3.5' />,
          },
        ]}
        actions={
          <button type='submit' form={formId} className={PAGE_TITLE_ACTION_SAVE_CLASS}>
            <LuSave className='h-4 w-4' />
            {t('dashboard.bots.page.saveAction')}
          </button>
        }
      />

      <BotCreateEditForm formId={formId} editId={isEditMode ? editId ?? null : null} />
    </section>
  );
}

