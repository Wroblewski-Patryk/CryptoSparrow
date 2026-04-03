'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2';
import { LuCheck } from 'react-icons/lu';
import { useI18n } from '../../i18n/I18nProvider';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';
import { headerMenuItemClass } from '../layout/dashboard/headerControlStyles';

const themes = [
  { value: 'cryptosparrow', label: 'Soar', swatches: ['bg-violet-600', 'bg-yellow-400', 'bg-indigo-400'] },
  { value: 'system', label: 'System', swatches: ['bg-slate-300', 'bg-slate-500', 'bg-slate-800'] },
  { value: 'cupcake', label: 'Cupcake', swatches: ['bg-pink-300', 'bg-rose-300', 'bg-orange-200'] },
  { value: 'dracula', label: 'Dracula', swatches: ['bg-violet-800', 'bg-fuchsia-700', 'bg-slate-900'] },
  { value: 'forest', label: 'Forest', swatches: ['bg-green-700', 'bg-lime-500', 'bg-emerald-800'] },
  { value: 'valentine', label: 'Valentine', swatches: ['bg-rose-400', 'bg-pink-400', 'bg-red-300'] },
  { value: 'luxury', label: 'Luxury', swatches: ['bg-amber-700', 'bg-yellow-500', 'bg-stone-900'] },
  { value: 'cyberpunk', label: 'Cyberpunk', swatches: ['bg-yellow-300', 'bg-fuchsia-500', 'bg-slate-900'] },
] as const;

type ThemePreference = (typeof themes)[number]['value'];
type DropdownPlacement = 'top' | 'bottom';

type ThemeSwitcherProps = {
  placement?: DropdownPlacement;
};

const normalizeThemePreference = (value: string | null): ThemePreference => {
  if (!value || value === 'default') return 'cryptosparrow';
  if (themes.some((item) => item.value === value)) return value as ThemePreference;
  return 'cryptosparrow';
};

const resolveTheme = (preference: ThemePreference): string => {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function ThemeSwitcher({ placement = 'bottom' }: ThemeSwitcherProps) {
  const { locale } = useI18n();
  const [activeTheme, setActiveTheme] = useState<ThemePreference>('cryptosparrow');
  const [resolvedTheme, setResolvedTheme] = useState<string>('cryptosparrow');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const detailsClass = `dropdown dropdown-end group ${placement === 'top' ? 'dropdown-top' : ''}`;
  const menuClass =
    placement === 'top'
      ? 'menu dropdown-content z-[60] mb-2 w-48 rounded-box bg-base-100 p-2 text-base-content shadow'
      : 'menu dropdown-content z-[60] mt-2 w-48 rounded-box bg-base-100 p-2 text-base-content shadow';

  const applyTheme = (theme: ThemePreference, persist = true) => {
    const normalized = normalizeThemePreference(theme);
    const resolved = resolveTheme(normalized);
    document.documentElement.setAttribute('data-theme', resolved);
    setActiveTheme(normalized);
    setResolvedTheme(resolved);
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

  const copy = locale === 'pl'
    ? {
        selectorAria: 'Wybierz motyw',
        optionsAria: 'Opcje motywu',
        currentTheme: 'Aktualny motyw',
        systemLabel: 'System',
      }
    : {
        selectorAria: 'Theme selector',
        optionsAria: 'Theme options',
        currentTheme: 'Current theme',
        systemLabel: 'System',
      };

  const activeThemeConfig = themes.find((item) => item.value === activeTheme) ?? themes[0];

  return (
    <details ref={detailsRef} className={detailsClass}>
      <summary className={`${headerMenuItemClass} font-normal`} aria-label={copy.selectorAria}>
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {activeThemeConfig.swatches.map((swatch) => (
            <span key={`summary-${activeThemeConfig.value}-${swatch}`} className={`inline-block h-2 w-2 rounded-full ${swatch}`} />
          ))}
        </span>
        <span>{activeThemeConfig.value === 'system' ? copy.systemLabel : activeThemeConfig.label}</span>
        <span className="sr-only">{copy.currentTheme}</span>
      </summary>
      <ul className={menuClass} aria-label={copy.optionsAria}>
        {themes.map((theme) => (
          <li key={theme.value}>
            <button
              type="button"
              aria-label={theme.label}
              className={`flex items-center justify-between gap-2 ${activeTheme === theme.value ? 'active' : ''}`}
              onClick={() => applyTheme(theme.value)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1" aria-hidden>
                  {theme.swatches.map((swatch) => (
                    <span key={`${theme.value}-${swatch}`} className={`inline-block h-2 w-2 rounded-full ${swatch}`} />
                  ))}
                </span>
                <span>{theme.value === 'system' ? copy.systemLabel : theme.label}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                {theme.value === 'system' ? (
                  <span className="swap swap-rotate pointer-events-none text-base-content/70">
                    <input type="checkbox" checked={resolvedTheme === 'dark'} readOnly />
                    <HiOutlineSun className="swap-off h-3.5 w-3.5" aria-hidden />
                    <HiOutlineMoon className="swap-on h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
                {activeTheme === theme.value ? <LuCheck className="h-3.5 w-3.5 text-success" aria-hidden /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
