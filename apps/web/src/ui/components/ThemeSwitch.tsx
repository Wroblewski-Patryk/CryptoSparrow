'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { HiOutlineMoon, HiOutlineSun } from 'react-icons/hi2';
import { LuCheck } from 'react-icons/lu';
import { useI18n } from '../../i18n/I18nProvider';
import { useDetailsDropdown } from '../hooks/useDetailsDropdown';
import {
  getHeaderDropdownLinkClass,
  getHeaderDropdownMenuClass,
  headerMenuItemClass,
} from '../layout/dashboard/headerControlStyles';

const themes = [
  { value: 'cryptosparrow', label: 'Soar' },
  { value: 'system', label: 'System' },
  { value: 'cupcake', label: 'Cupcake' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'forest', label: 'Forest' },
  { value: 'valentine', label: 'Valentine' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
] as const;
const themeSwitcherHiddenValues = new Set(['cryptosparrow', 'luxury']);
const themeSwitcherOptions = themes.filter((item) => !themeSwitcherHiddenValues.has(item.value));

type ThemePreference = (typeof themes)[number]['value'];
type DropdownPlacement = 'top' | 'bottom';
type ThemeSwitcherTone = 'header' | 'footer';

type ThemeSwitcherProps = {
  placement?: DropdownPlacement;
  summaryClassName?: string;
  tone?: ThemeSwitcherTone;
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

const themeSwatchShellStyle = {
  borderRadius: 'var(--radius-selector)',
  padding: 'calc(var(--radius-selector) * 0.28)',
} as CSSProperties;

const ThemeSwatches = ({ theme }: { theme: string }) => (
  <span
    data-theme={theme}
    className='inline-flex items-center gap-1 border border-base-300/70 bg-base-100/65'
    style={themeSwatchShellStyle}
    aria-hidden='true'
  >
    <span className='inline-block h-2 w-2 rounded-full bg-base-content/85' />
    <span className='inline-block h-2 w-2 rounded-full bg-neutral' />
    <span className='inline-block h-2 w-2 rounded-full bg-primary' />
    <span className='inline-block h-2 w-2 rounded-full bg-secondary' />
    <span className='inline-block h-2 w-2 rounded-full bg-accent' />
  </span>
);

export default function ThemeSwitcher({
  placement = 'bottom',
  summaryClassName = '',
  tone = 'header',
}: ThemeSwitcherProps) {
  const { locale } = useI18n();
  const [activeTheme, setActiveTheme] = useState<ThemePreference>('cryptosparrow');
  const [resolvedTheme, setResolvedTheme] = useState<string>('cryptosparrow');
  const [systemResolvedTheme, setSystemResolvedTheme] = useState<'light' | 'dark'>('light');
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDetailsDropdown(detailsRef);
  const detailsClass = `dropdown dropdown-end group ${placement === 'top' ? 'dropdown-top' : ''}`;
  const menuClass = getHeaderDropdownMenuClass(placement, 'w-48');
  const summaryToneClass =
    tone === 'footer'
      ? 'inline-flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-base-content/80 hover:bg-base-content/10 hover:text-base-content/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content/35 transition-colors group-open:bg-base-content/10 group-open:text-base-content/80 list-none cursor-pointer [&::-webkit-details-marker]:hidden'
      : `${headerMenuItemClass} font-normal`;

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
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () =>
      setSystemResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    const handleChange = () => {
      updateSystemTheme();
      if (activeTheme === 'system') applyTheme('system', false);
    };
    updateSystemTheme();
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
  const activeSwatchTheme = activeTheme === 'system' ? systemResolvedTheme : activeThemeConfig.value;

  return (
    <details ref={detailsRef} className={detailsClass}>
      <summary className={`${summaryToneClass} ${summaryClassName}`.trim()} aria-label={copy.selectorAria}>
        <ThemeSwatches theme={activeSwatchTheme} />
        <span>{activeThemeConfig.value === 'system' ? copy.systemLabel : activeThemeConfig.label}</span>
        <span className="sr-only">{copy.currentTheme}</span>
      </summary>
      <ul className={menuClass} aria-label={copy.optionsAria}>
        {themeSwitcherOptions.map((theme) => (
          <li key={theme.value}>
            <button
              type="button"
              aria-label={theme.label}
              className={`${getHeaderDropdownLinkClass(activeTheme === theme.value)} flex items-center justify-between gap-2 px-2 py-1.5`}
              onClick={() => applyTheme(theme.value)}
            >
              <span className="inline-flex items-center gap-2">
                <ThemeSwatches theme={theme.value === 'system' ? systemResolvedTheme : theme.value} />
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
