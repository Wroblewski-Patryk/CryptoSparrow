'use client';

import { RefObject, useEffect } from 'react';

type UseDetailsDropdownOptions = {
  closeOnEscape?: boolean;
};

export function useDetailsDropdown(
  detailsRef: RefObject<HTMLDetailsElement | null>,
  options: UseDetailsDropdownOptions = {}
) {
  const { closeOnEscape = true } = options;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const element = detailsRef.current;
      if (!element?.open) return;

      const target = event.target as Node | null;
      if (!target || element.contains(target)) return;
      element.open = false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!closeOnEscape || event.key !== 'Escape') return;
      const element = detailsRef.current;
      if (!element?.open) return;
      element.open = false;
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOnEscape, detailsRef]);
}
