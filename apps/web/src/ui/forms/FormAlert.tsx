import { type ReactNode } from 'react';

type FormAlertVariant = 'info' | 'success' | 'warning' | 'error';

type FormAlertProps = {
  variant?: FormAlertVariant;
  title?: string;
  children?: ReactNode;
  className?: string;
};

const VARIANT_CLASS: Record<FormAlertVariant, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

export function FormAlert({ variant = 'info', title, children, className }: FormAlertProps) {
  const rootClassName = ['alert', VARIANT_CLASS[variant], className].filter(Boolean).join(' ');

  if (!title && !children) return null;

  return (
    <div className={rootClassName} role='alert'>
      <div className='space-y-1'>
        {title ? <p className='font-semibold leading-tight'>{title}</p> : null}
        {children ? <div className='text-sm'>{children}</div> : null}
      </div>
    </div>
  );
}

