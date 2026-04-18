import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';

export default function RiskNoticeFooter() {
  const { t } = useI18n();

  return (
    <div className='mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4'>
      <p className='text-sm font-semibold'>
        {t('dashboard.riskNotice.title')}
      </p>
      <p className='mt-1 text-sm opacity-80'>
        {t('dashboard.riskNotice.description')}
      </p>
      <div className='mt-3 flex flex-wrap gap-2'>
        <Link href='/dashboard/logs' className='btn btn-outline btn-xs'>
          {t('dashboard.riskNotice.openAuditLogs')}
        </Link>
        <Link href='/dashboard/profile#security' className='btn btn-ghost btn-xs'>
          {t('dashboard.riskNotice.securitySettings')}
        </Link>
      </div>
    </div>
  );
}
