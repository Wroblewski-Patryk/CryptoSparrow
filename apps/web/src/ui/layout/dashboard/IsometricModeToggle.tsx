'use client';

import { useEffect, useState } from 'react';
import { getLocalStorageItem, setLocalStorageItem } from '@/lib/storage';

type IsometricModeToggleProps = {
  compact?: boolean;
};

const STORAGE_KEY = 'cryptosparrow-isometric-mode';
const CLASS_NAME = 'isometric-mode';

export default function IsometricModeToggle({ compact = false }: IsometricModeToggleProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const raw = getLocalStorageItem(STORAGE_KEY);
    const initial = raw === 'true';
    setEnabled(initial);
    document.documentElement.classList.toggle(CLASS_NAME, initial);
  }, []);

  const handleToggle = () => {
    setEnabled((current) => {
      const next = !current;
      setLocalStorageItem(STORAGE_KEY, `${next}`);
      document.documentElement.classList.toggle(CLASS_NAME, next);
      return next;
    });
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`btn btn-xs ${enabled ? 'btn-secondary' : 'btn-outline'}`}
        aria-pressed={enabled}
        onClick={handleToggle}
        title={enabled ? 'Disable isometric mode' : 'Enable isometric mode'}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-xs ${enabled ? 'btn-secondary' : 'btn-outline'}`}
      aria-pressed={enabled}
      onClick={handleToggle}
      title={enabled ? 'Disable isometric mode' : 'Enable isometric mode'}
    >
      ISO
    </button>
  );
}
