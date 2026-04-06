'use client';

import Link from "next/link";
import { type ReactNode } from "react";
import { LuHouse } from "react-icons/lu";
import { useI18n } from "../../../i18n/I18nProvider";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NormalizedBreadcrumbItem extends BreadcrumbItem {
  hidden?: boolean;
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
    breadcrumb.length > 0
      ? breadcrumb
      : [
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: title },
        ];

  const isDashboardLandingView =
    variant === "flat" &&
    normalizedBreadcrumb.length >= 2 &&
    normalizedBreadcrumb[0]?.href === "/dashboard";

  const renderedBreadcrumb: NormalizedBreadcrumbItem[] = isDashboardLandingView
    ? [{ label: "__dashboard-spacer__", hidden: true }, ...normalizedBreadcrumb]
    : normalizedBreadcrumb;

  const moduleCrumbIndex = renderedBreadcrumb.findIndex(
    (item, index) => index > 0 && !item.hidden && Boolean(item.href)
  );
  const titleCrumbIndex = isDashboardLandingView
    ? 1
    : moduleCrumbIndex >= 0
      ? moduleCrumbIndex
      : Math.max(0, renderedBreadcrumb.length - 1);

  const wrapperClassName =
    variant === "flat"
      ? "mb-6 md:flex md:items-center md:justify-between"
      : "mb-6 rounded-box border border-base-300/60 bg-base-100/80 px-5 py-4 md:flex md:items-center md:justify-between";

  return (
    <div className={wrapperClassName}>
      <div className="min-w-0">
        <div className="breadcrumbs mt-2 max-w-full overflow-x-auto text-sm">
          <ul>
            {renderedBreadcrumb.map((item, index) => {
              const key = `${index}-${item.href || item.label}`;
              const isDashboardRoot = item.href === "/dashboard";
              const isTitleCrumb = index === titleCrumbIndex;
              const crumbBaseClass = "inline-flex items-center gap-1.5 opacity-70";

              if (item.hidden) {
                return (
                  <li key={key} aria-hidden className="w-0 overflow-hidden opacity-0 pointer-events-none select-none">
                    <span className="inline-block w-0">{item.label}</span>
                  </li>
                );
              }

              if (isTitleCrumb) {
                const titleContent = (
                  <h1 className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-xl font-medium tracking-tight text-transparent md:text-2xl">
                    {icon ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center text-primary">
                        {icon}
                      </span>
                    ) : null}
                    <span>{title}</span>
                  </h1>
                );

                return <li key={key}>{titleContent}</li>;
              }

              if (isDashboardRoot) {
                const dashboardContent = (
                  <span className={crumbBaseClass}>
                    <LuHouse className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </span>
                );
                return (
                  <li key={key}>
                    {item.href ? <Link href={item.href}>{dashboardContent}</Link> : dashboardContent}
                  </li>
                );
              }

              return (
                <li key={key}>
                  {item.href ? (
                    <Link href={item.href} className={crumbBaseClass}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className={crumbBaseClass}>{item.label}</span>
                  )}
                </li>
              );
            })}
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
