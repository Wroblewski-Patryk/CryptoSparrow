export const themeBootstrapScript = `(() => {
  const fallbackThemePreference = 'system';

  const getStorageItem = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const normalizeThemePreference = (value) => {
    if (!value || value === 'default' || value === 'cryptosparrow') return fallbackThemePreference;
    return value;
  };

  const resolveSystemTheme = () => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  };

  const storedThemePreference = normalizeThemePreference(
    getStorageItem('themePreference') || getStorageItem('theme')
  );
  const resolvedTheme =
    storedThemePreference === 'system' ? resolveSystemTheme() : storedThemePreference;
  document.documentElement.setAttribute('data-theme', resolvedTheme);

  const locale = getStorageItem('cryptosparrow-locale');
  if (locale === 'pl' || locale === 'en') {
    document.documentElement.lang = locale;
  }
})();`;
