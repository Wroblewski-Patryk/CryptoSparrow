'use client';

type RouterNavigation = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

type NavigateWithFallbackOptions = {
  href: string;
  mode?: 'push' | 'replace';
  fallbackPrefix?: string;
  delayMs?: number;
};

export const navigateWithFallback = (
  router: RouterNavigation,
  { href, mode = 'replace', fallbackPrefix, delayMs = 250 }: NavigateWithFallbackOptions
) => {
  const navigate = mode === 'push' ? router.push : router.replace;
  navigate(href);

  if (
    typeof window === 'undefined' ||
    process.env.NODE_ENV === 'test' ||
    !fallbackPrefix
  ) {
    return;
  }

  window.setTimeout(() => {
    if (!window.location.pathname.startsWith(fallbackPrefix)) return;
    navigate(href);
  }, delayMs);
};
