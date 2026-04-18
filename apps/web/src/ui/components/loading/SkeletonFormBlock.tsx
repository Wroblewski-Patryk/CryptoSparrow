'use client';

import { useOptionalI18n } from '@/i18n/useOptionalI18n';

type SkeletonFormBlockProps = {
  fields?: number;
  columns?: 1 | 2;
  title?: boolean;
  submitButton?: boolean;
  className?: string;
};

export default function SkeletonFormBlock({
  fields = 6,
  columns = 2,
  title = true,
  submitButton = true,
  className = '',
}: SkeletonFormBlockProps) {
  const { t } = useOptionalI18n();
  const gridClass = columns === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2';

  return (
    <section
      aria-busy='true'
      aria-label={t('public.a11y.loadingForm')}
      className={`space-y-4 rounded-box border border-base-300/60 bg-base-100/80 p-4 ${className}`.trim()}
    >
      {title ? <div className='skeleton h-6 w-52' /> : null}
      <div className={`grid gap-3 ${gridClass}`}>
        {Array.from({ length: fields }).map((_, index) => (
          <div key={`field-${index}`} className='space-y-2'>
            <div className='skeleton h-3 w-24' />
            <div className='skeleton h-10 w-full' />
          </div>
        ))}
      </div>
      {submitButton ? <div className='skeleton ml-auto h-10 w-36' /> : null}
    </section>
  );
}
