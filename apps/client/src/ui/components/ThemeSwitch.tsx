'use client';

import { HiOutlineColorSwatch } from 'react-icons/hi';

const themes = [
  { value: 'default', label: 'Default' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'luxury', label: 'Luxury' },
];

export default function ThemeSwitcher() {
  return (
    <details className="dropdown dropdown-end">
      <summary className="btn btn-xs btn-outline m-0" aria-label="Theme selector">
        <HiOutlineColorSwatch aria-hidden className="h-4 w-4" />
        Theme
      </summary>
      <ul
        className="menu dropdown-content z-[60] mt-1 w-40 rounded-box bg-base-100 p-2 shadow"
        aria-label="Theme options"
      >
        {themes.map((theme) => (
          <li key={theme.value}>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="radio"
                name="theme-dropdown"
                className="theme-controller radio radio-xs"
                value={theme.value}
                aria-label={theme.label}
              />
              <span className="label-text">{theme.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
