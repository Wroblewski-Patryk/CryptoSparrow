import { type ReactNode } from 'react';

type FormPageShellProps = {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormPageShell({ title, description, headerActions, className, children }: FormPageShellProps) {
  const rootClassName = ['space-y-4 rounded-box border border-base-300/60 bg-base-100/80 p-4 md:p-5', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <h2 className='text-2xl'>{title}</h2>
          {description ? <p className='text-sm opacity-70'>{description}</p> : null}
        </div>
        {headerActions ? <div className='shrink-0'>{headerActions}</div> : null}
      </div>
      {children}
    </div>
  );
}

