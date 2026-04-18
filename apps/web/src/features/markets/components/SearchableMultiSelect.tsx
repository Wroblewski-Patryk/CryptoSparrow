'use client';

import { useMemo, useRef, useState } from 'react';
import { useDetailsDropdown } from '../../../ui/hooks/useDetailsDropdown';

export type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableMultiSelectProps = {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (next: string[]) => void;
  emptyText?: string;
  selectedSummaryLabel?: string;
  selectedCountLabel?: string;
  placeholderLabel?: string;
  searchPlaceholder?: string;
  selectFilteredLabel?: string;
  clearLabel?: string;
  maxListHeightClassName?: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

export default function SearchableMultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  emptyText = 'No options',
  selectedSummaryLabel = 'Selected',
  selectedCountLabel = 'Selected: {count}',
  placeholderLabel = 'Select...',
  searchPlaceholder = 'Search...',
  selectFilteredLabel = 'Select filtered',
  clearLabel = 'Clear',
  maxListHeightClassName = 'max-h-72',
}: SearchableMultiSelectProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const filteredOptions = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter((option) => normalize(option.value).includes(q) || normalize(option.label).includes(q));
  }, [options, query]);

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }
    onChange([...selectedValues, value]);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedValues);
    for (const option of filteredOptions) {
      next.add(option.value);
    }
    onChange([...next]);
  };

  const clearAll = () => onChange([]);

  return (
    <label className="form-control">
      <span className="label-text">{label}</span>
      <details ref={detailsRef} className="dropdown w-full">
        <summary className="btn btn-outline btn-sm w-full justify-between">
          <span className="truncate">
            {selectedValues.length > 0
              ? selectedCountLabel.replace('{count}', String(selectedValues.length))
              : placeholderLabel}
          </span>
          <span className="opacity-60">v</span>
        </summary>
        <div className="dropdown-content z-[70] mt-2 w-full rounded-box border border-base-300 bg-base-100 p-3 shadow-xl">
          <div className="mb-2">
            <input
              className="input input-bordered input-sm w-full"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="mb-2 flex gap-2">
            <button type="button" className="btn btn-xs btn-ghost" onClick={selectAllFiltered}>
              {selectFilteredLabel}
            </button>
            <button type="button" className="btn btn-xs btn-ghost" onClick={clearAll}>
              {clearLabel}
            </button>
          </div>
          <ul
            className={`menu rounded-box border border-base-300 bg-base-200 ${maxListHeightClassName} overflow-y-auto overflow-x-hidden`}
            aria-label={selectedSummaryLabel}
          >
            {filteredOptions.length === 0 && <li className="px-3 py-2 text-sm opacity-70">{emptyText}</li>}
            {filteredOptions.map((option) => (
              <li key={option.value}>
                <label className="cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span className="font-mono text-xs">{option.value}</span>
                  {option.label !== option.value && <span className="text-xs opacity-70">({option.label})</span>}
                  {option.description && <span className="text-[11px] opacity-60">{option.description}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </label>
  );
}
