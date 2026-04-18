import { type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, hint, error, required = false, className, children }: FormFieldProps) {
  const rootClassName = ['form-control w-full', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <div className='mb-1 flex items-center gap-1'>
        <label className='label-text font-medium' htmlFor={htmlFor}>
          {label}
        </label>
        {required ? (
          <span className='text-error' aria-hidden='true'>
            *
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className='mt-1 text-xs opacity-70'>{hint}</p> : null}
      {error ? (
        <p className='mt-1 text-xs text-error' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  );
}

