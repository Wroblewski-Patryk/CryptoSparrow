import { type ReactNode } from 'react';

type FormSectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormSectionCard({ title, description, actions, className, children }: FormSectionCardProps) {
  const rootClassName = ['rounded-lg border border-base-300 bg-base-100 p-3 md:p-4 space-y-3', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClassName}>
      <div className='flex flex-wrap items-start justify-between gap-2'>
        <div className='space-y-1'>
          <h3 className='text-xs font-semibold uppercase tracking-wide opacity-70'>{title}</h3>
          {description ? <p className='text-sm opacity-70'>{description}</p> : null}
        </div>
        {actions ? <div className='shrink-0'>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

