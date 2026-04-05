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
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  iconClassName?: string;
  activeIconClassName?: string;
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = "border",
  className = "",
  syncWithHash = false,
  tabClassName = "",
  activeTabClassName = "",
  inactiveTabClassName = "",
  iconClassName = "",
  activeIconClassName = "",
}: TabsProps<T>) {
  const containerClass = variant === "box" ? "tabs tabs-box gap-1.5" : "tabs gap-1.5";
  const tabBaseClass = variant === "box"
    ? "tab rounded-md border border-transparent text-base-content/80 hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 transition-colors"
    : "tab rounded-md border border-transparent text-base-content/80 hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/40 transition-colors";
  const defaultActiveClass = "!border !border-accent/45 !bg-transparent !text-accent hover:!text-accent shadow-none";
  const defaultActiveIconClass = "opacity-100";
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
      {items.map((item) => {
        const isActive = value === item.key;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            disabled={item.disabled}
            aria-selected={isActive}
            className={`${tabBaseClass} ${tabClassName} ${isActive ? `${defaultActiveClass} ${activeTabClassName}` : inactiveTabClassName}`.trim()}
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
                <span
                  className={`opacity-80 ${iconClassName} ${isActive ? `${defaultActiveIconClass} ${activeIconClassName}` : ""}`.trim()}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </span>
            ) : (
              item.label
            )}
          </button>
        );
      })}
    </div>
  );
}
