import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { FormField } from './FormField';
import { FormGrid } from './FormGrid';

type BaseFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

const buildAriaDescribedBy = (id: string, hint: string | undefined, error: string | undefined) => {
  const ids: string[] = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length > 0 ? ids.join(' ') : undefined;
};

type TextFieldProps = BaseFieldProps & {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
};

export function TextField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  type = 'text',
}: TextFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);

  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <input
        id={id}
        className='input input-bordered w-full'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        type={type}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
    </FormField>
  );
}

type NumberFieldProps = BaseFieldProps & {
  value: string | number;
  onChange: (next: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
};

export function NumberField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  inputMode = 'decimal',
}: NumberFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);

  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <input
        id={id}
        className='input input-bordered w-full'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type='number'
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
    </FormField>
  );
}

type SelectFieldProps = BaseFieldProps & {
  value: string;
  onChange: (next: string) => void;
  options: Option[];
  placeholder?: string;
};

export function SelectField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  options,
  placeholder,
}: SelectFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);

  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <select
        id={id}
        className='select select-bordered w-full'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      >
        {placeholder ? (
          <option value='' disabled={required}>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

type TextareaFieldProps = BaseFieldProps & {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  autoComplete?: TextareaHTMLAttributes<HTMLTextAreaElement>['autoComplete'];
};

export function TextareaField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  rows = 4,
  placeholder,
  autoComplete,
}: TextareaFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);

  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        className='textarea textarea-bordered w-full'
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
    </FormField>
  );
}

type ToggleFieldProps = Omit<BaseFieldProps, 'label'> & {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

export function ToggleField({
  id,
  label,
  hint,
  error,
  disabled = false,
  className,
  checked,
  onChange,
}: ToggleFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);
  const rootClassName = ['form-control w-full', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <label className='label cursor-pointer justify-start gap-3' htmlFor={id}>
        <input
          id={id}
          type='checkbox'
          className='toggle toggle-primary'
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <span className='label-text font-medium'>{label}</span>
      </label>
      {hint ? (
        <p className='mt-1 text-xs opacity-70' id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className='mt-1 text-xs text-error' id={`${id}-error`} role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type RadioGroupFieldProps = BaseFieldProps & {
  value: string;
  onChange: (next: string) => void;
  options: Option[];
};

export function RadioGroupField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  options,
}: RadioGroupFieldProps) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <div className='flex flex-wrap gap-3' id={id} role='radiogroup' aria-invalid={Boolean(error)}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label key={option.value} className='label cursor-pointer justify-start gap-2' htmlFor={optionId}>
              <input
                id={optionId}
                type='radio'
                name={id}
                className='radio radio-primary'
                value={option.value}
                checked={value === option.value}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled || option.disabled}
              />
              <span className='label-text'>{option.label}</span>
            </label>
          );
        })}
      </div>
    </FormField>
  );
}

type RangeFieldProps = BaseFieldProps & {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
};

export function RangeField({
  id,
  label,
  hint,
  error,
  required = false,
  disabled = false,
  className,
  value,
  onChange,
  min,
  max,
  step = 1,
  showValue = true,
}: RangeFieldProps) {
  const describedBy = buildAriaDescribedBy(id, hint, error);

  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      hintId={`${id}-hint`}
      error={error}
      errorId={`${id}-error`}
      required={required}
      className={className}
    >
      <div className='space-y-1'>
        <input
          id={id}
          className='range range-primary w-full'
          type='range'
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        {showValue ? <p className='text-xs opacity-70'>Value: {value}</p> : null}
      </div>
    </FormField>
  );
}

type CompoundFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
};

export function CompoundField({
  label,
  hint,
  error,
  required = false,
  columns = 2,
  className,
  children,
}: CompoundFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} className={className}>
      <FormGrid columns={columns} className='mt-1'>
        {children}
      </FormGrid>
    </FormField>
  );
}

