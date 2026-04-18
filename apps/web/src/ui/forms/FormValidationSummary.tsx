type FormValidationSummaryProps = {
  title?: string;
  errors: string[];
  className?: string;
};

export function FormValidationSummary({
  title = 'Please fix the highlighted fields before submitting.',
  errors,
  className,
}: FormValidationSummaryProps) {
  if (errors.length === 0) return null;

  const rootClassName = ['alert alert-error', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} role='alert' data-testid='form-validation-summary'>
      <div className='space-y-1'>
        <p className='font-semibold'>{title}</p>
        <ul className='list-disc pl-5 text-sm'>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

