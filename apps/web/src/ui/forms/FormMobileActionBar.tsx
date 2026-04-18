import { type ReactNode } from 'react';

type FormMobileActionBarProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  reserveSpace?: boolean;
};

export function FormMobileActionBar({
  children,
  className,
  contentClassName,
  reserveSpace = true,
}: FormMobileActionBarProps) {
  const rootClassName = [
    'fixed inset-x-0 bottom-0 z-40 border-t border-base-300/70 bg-base-100/95 backdrop-blur md:hidden',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const contentClasses = [
    'mx-auto flex w-full max-w-7xl items-center gap-2 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {reserveSpace ? <div className='h-20 md:hidden' aria-hidden data-testid='form-mobile-action-spacer' /> : null}
      <div className={rootClassName} data-testid='form-mobile-action-bar'>
        <div className={contentClasses}>{children}</div>
      </div>
    </>
  );
}

