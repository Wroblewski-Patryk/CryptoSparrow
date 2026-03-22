'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineColorSwatch } from 'react-icons/hi';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';

const themes = [
  { value: 'cryptosparrow', label: 'CryptoSparrow', swatch: 'bg-violet-600' },
  { value: 'system', label: 'System', swatch: 'bg-slate-400' },
  { value: 'cyberpunk', label: 'Cyberpunk', swatch: 'bg-yellow-400' },
  { value: 'emerald', label: 'Emerald', swatch: 'bg-emerald-500' },
  { value: 'night', label: 'Night', swatch: 'bg-slate-900' },
] as const;

type ThemePreference = (typeof themes)[number]['value'];

const normalizeThemePreference = (value: string | null): ThemePreference => {
  if (!value || value === 'default') return 'cryptosparrow';
  if (value === 'luxury') return 'night';
  if (themes.some((item) => item.value === value)) return value as ThemePreference;
  return 'cryptosparrow';
};

const resolveTheme = (preference: ThemePreference): string => {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'light';
};

export default function ThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState<ThemePreference>('cryptosparrow');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);

  const applyTheme = (theme: ThemePreference, persist = true) => {
    const normalized = normalizeThemePreference(theme);
    const resolved = resolveTheme(normalized);
    document.documentElement.setAttribute('data-theme', resolved);
    setActiveTheme(normalized);
    if (persist) {
      window.localStorage.setItem('themePreference', normalized);
      window.localStorage.setItem('theme', normalized);
    }
    if (detailsRef.current) detailsRef.current.open = false;
  };

  useEffect(() => {
    const fromStorage = normalizeThemePreference(
      window.localStorage.getItem('themePreference') || window.localStorage.getItem('theme')
    );
    applyTheme(fromStorage, false);
  }, []);

  useEffect(() => {
    if (activeTheme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system', false);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [activeTheme]);

  return (
    <details ref={detailsRef} className="dropdown dropdown-end">
      <summary className="btn btn-sm btn-ghost text-primary-content" aria-label="Theme selector">
        <HiOutlineColorSwatch aria-hidden className="h-4 w-4" />
        <span>Theme</span>
      </summary>
      <ul className="menu dropdown-content z-[60] mt-2 w-48 rounded-box bg-base-100 p-2 text-base-content shadow" aria-label="Theme options">
        {themes.map((theme) => (
          <li key={theme.value}>
            <button
              type="button"
              aria-label={theme.label}
              className={activeTheme === theme.value ? 'active' : ''}
              onClick={() => applyTheme(theme.value)}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${theme.swatch}`} aria-hidden />
              {theme.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
