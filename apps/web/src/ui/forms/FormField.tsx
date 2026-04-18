import { type ReactNode } from 'react';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  required = false,
  className,
  children,
}: FormFieldProps) {
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
      {hint ? (
        <p className='mt-1 text-xs opacity-70' id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className='mt-1 text-xs text-error' id={errorId} role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  );
}
