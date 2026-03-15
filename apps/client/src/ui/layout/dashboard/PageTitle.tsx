'use client';

import Link from "next/link";
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
}

export function PageTitle({ title, breadcrumb = [], onAdd, addLabel }: PageTitleProps) {
  const { t } = useI18n();

  const normalizedBreadcrumb =
    breadcrumb.length > 0 ? breadcrumb : [{ label: t("common.dashboard"), href: "/dashboard" }];

  return (
    <div className="mb-6 rounded-xl border border-base-300 bg-base-200 px-5 py-4 shadow-sm md:flex md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <div className="breadcrumbs mt-2 text-sm opacity-80">
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
        <button className="btn btn-primary mt-4 md:mt-0" onClick={onAdd}>
          {addLabel || t("common.add")}
        </button>
      )}
    </div>
  );
}
