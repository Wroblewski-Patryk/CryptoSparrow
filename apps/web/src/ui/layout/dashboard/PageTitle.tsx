'use client';

import Link from "next/link";
import { type ReactNode } from "react";
import { useI18n } from "../../../i18n/I18nProvider";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageTitleProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  onAdd?: () => void;
  addLabel?: string;
  icon?: ReactNode;
  addButtonClassName?: string;
  variant?: "boxed" | "flat";
}

export function PageTitle({
  title,
  breadcrumb = [],
  onAdd,
  addLabel,
  icon,
  addButtonClassName,
  variant = "boxed",
}: PageTitleProps) {
  const { t } = useI18n();

  const normalizedBreadcrumb =
    breadcrumb.length > 0 ? breadcrumb : [{ label: t("dashboard.common.dashboard"), href: "/dashboard" }];

  const wrapperClassName =
    variant === "flat"
      ? "mb-6 md:flex md:items-center md:justify-between"
      : "mb-6 rounded-box border border-base-300 bg-base-200 px-5 py-4 md:flex md:items-center md:justify-between";

  return (
    <div className={wrapperClassName}>
      <div className="min-w-0">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          {icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-box bg-base-200 text-base-content/75">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </h1>
        <div className="breadcrumbs mt-2 max-w-full overflow-x-auto text-sm opacity-80">
          <ul>
            {normalizedBreadcrumb.map((item) => (
              <li key={item.href || item.label}>
                {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {onAdd && (
        <button className={addButtonClassName ?? "btn btn-primary mt-4 md:mt-0"} onClick={onAdd}>
          {addLabel || t("dashboard.common.add")}
        </button>
      )}
    </div>
  );
}
