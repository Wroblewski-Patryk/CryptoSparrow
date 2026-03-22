'use client';

type FieldWrapperProps = {
  label: string;
  children: React.ReactNode;
};

export function FieldWrapper({ label, children }: FieldWrapperProps) {
  return (
    <label className="form-control">
      <span className="label-text mb-1 block">{label}</span>
      {children}
    </label>
  );
}

type TextInputFieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
};

export function TextInputField({ label, placeholder, value, onChange }: TextInputFieldProps) {
  return (
    <FieldWrapper label={label}>
      <input
        className="input input-bordered"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldWrapper>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function SelectField({ label, value, options, onChange, disabled = false }: SelectFieldProps) {
  return (
    <FieldWrapper label={label}>
      <select
        className="select select-bordered"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
