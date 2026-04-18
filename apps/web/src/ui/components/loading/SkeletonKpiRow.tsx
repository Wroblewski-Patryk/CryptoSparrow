'use client';

import { useOptionalI18n } from '@/i18n/useOptionalI18n';

type SkeletonKpiRowProps = {
  items?: number;
  className?: string;
};

export default function SkeletonKpiRow({ items = 4, className = '' }: SkeletonKpiRowProps) {
  const { t } = useOptionalI18n();
  return (
    <section
      aria-busy='true'
      aria-label={t('public.a11y.loadingKpiRow')}
      className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`.trim()}
    >
      {Array.from({ length: items }).map((_, index) => (
        <article
          key={`kpi-${index}`}
          className='space-y-2 rounded-box border border-base-300/60 bg-base-100/80 p-3'
        >
          <div className='skeleton h-3 w-20' />
          <div className='skeleton h-6 w-28' />
        </article>
      ))}
    </section>
  );
}
