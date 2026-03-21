'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineColorSwatch } from 'react-icons/hi';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';

const themes = [
  { value: 'default', label: 'Default', swatch: 'bg-slate-400' },
  { value: 'cyberpunk', label: 'Cyberpunk', swatch: 'bg-yellow-400' },
  { value: 'luxury', label: 'Luxury', swatch: 'bg-amber-700' },
] as const;

export default function ThemeSwitcher() {
  const [activeTheme, setActiveTheme] = useState<string>('default');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);

  useEffect(() => {
    const fromHtml = document.documentElement.getAttribute('data-theme');
    const fromStorage = window.localStorage.getItem('theme');
    setActiveTheme(fromHtml || fromStorage || 'default');
  }, []);

  const applyTheme = (theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
    setActiveTheme(theme);
    if (detailsRef.current) detailsRef.current.open = false;
  };

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
