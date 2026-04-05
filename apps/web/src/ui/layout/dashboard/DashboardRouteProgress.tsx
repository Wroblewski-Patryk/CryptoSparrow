'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_IN_PROGRESS = 92;

export default function DashboardRouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname}?${searchParams?.toString() ?? ''}`,
    [pathname, searchParams]
  );

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const routeRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  const resetBar = useCallback(() => {
    clearTimers();
    setVisible(false);
    setProgress(0);
  }, [clearTimers]);

  const completeBar = useCallback(() => {
    if (!visible) return;
    clearTimers();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      hideRef.current = null;
    }, 220);
  }, [clearTimers, visible]);

  const startBar = useCallback(() => {
    if (tickRef.current) return;

    setVisible(true);
    setProgress((previous) => (previous > 0 ? previous : 10));

    tickRef.current = setInterval(() => {
      setProgress((previous) => {
        if (previous >= MAX_IN_PROGRESS) return MAX_IN_PROGRESS;
        const delta = Math.max(1, Math.round((MAX_IN_PROGRESS - previous) * 0.14));
        return Math.min(MAX_IN_PROGRESS, previous + delta);
      });
    }, 150);

    fallbackRef.current = setTimeout(() => {
      completeBar();
    }, 10000);
  }, [completeBar]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      try {
        const nextUrl = new URL(anchor.href, window.location.href);
        if (nextUrl.origin !== window.location.origin) return;

        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;
        if (nextUrl.pathname === currentPath && nextUrl.search === currentSearch) return;

        startBar();
      } catch {
        // Ignore malformed URLs from external markup.
      }
    };

    const handlePopState = () => {
      startBar();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
    };
  }, [startBar]);

  useEffect(() => {
    if (routeRef.current === null) {
      routeRef.current = routeKey;
      return;
    }
    if (routeRef.current !== routeKey) {
      routeRef.current = routeKey;
      completeBar();
    }
  }, [routeKey, completeBar]);

  useEffect(() => {
    return () => {
      resetBar();
    };
  }, [resetBar]);

  return (
    <div
      aria-hidden='true'
      className={`h-0.5 w-full overflow-hidden bg-base-300/40 transition-opacity duration-200 motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className='h-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none'
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
