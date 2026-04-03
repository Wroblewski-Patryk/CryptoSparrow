'use client';

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";

type TabVariant = "border" | "box";

type TabItem<T extends string> = {
  key: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  hash?: string;
};

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: TabVariant;
  className?: string;
  syncWithHash?: boolean;
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "border",
  className = "",
  syncWithHash = false,
}: TabsProps<T>) {
  const containerClass = variant === "box" ? "tabs tabs-box" : "tabs tabs-border";
  const tabBaseClass = variant === "box" ? "tab" : "tab tab-bordered";
  const hashToTab = useMemo(() => {
    const map = new Map<string, T>();
    for (const item of items) {
      const hash = (item.hash ?? String(item.key)).trim();
      if (hash) map.set(hash, item.key);
    }
    return map;
  }, [items]);

  useEffect(() => {
    if (!syncWithHash || typeof window === "undefined") return;

    const syncFromHash = () => {
      const rawHash = window.location.hash.replace(/^#/, "").trim();
      if (!rawHash) return;
      const key = hashToTab.get(rawHash);
      if (!key || key === value) return;
      onChange(key);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [hashToTab, onChange, syncWithHash, value]);

  return (
    <div role="tablist" className={`${containerClass} ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          type="button"
          disabled={item.disabled}
          aria-selected={value === item.key}
          className={`${tabBaseClass} ${value === item.key ? "tab-active" : ""}`.trim()}
          onClick={() => {
            if (item.disabled) return;
            if (!syncWithHash || typeof window === "undefined") {
              onChange(item.key);
              return;
            }
            const hash = (item.hash ?? String(item.key)).trim();
            const nextHash = hash ? `#${hash}` : "";
            onChange(item.key);
            if (nextHash && window.location.hash !== nextHash) {
              window.location.hash = hash;
            }
          }}
        >
          {item.icon ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="opacity-80" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </span>
          ) : (
            item.label
          )}
        </button>
      ))}
    </div>
  );
}
