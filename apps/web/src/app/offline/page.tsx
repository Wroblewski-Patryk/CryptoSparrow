'use client';

import { I18nProvider, useI18n } from '@/i18n/I18nProvider';

function OfflinePageContent() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-base-100 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-base-300 bg-base-200 p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold">{t('public.offline.title')}</h1>
        <p className="mt-3 text-sm opacity-80">{t('public.offline.description')}</p>
      </div>
    </main>
  );
}

export default function OfflinePage() {
  return (
    <I18nProvider>
      <OfflinePageContent />
    </I18nProvider>
  );
}
