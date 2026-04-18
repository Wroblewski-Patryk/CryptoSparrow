'use client';

import Link from "next/link";
import { type ReactNode, useId } from "react";
import { LuHouse, LuPlus } from "react-icons/lu";
import { useI18n } from "../../../i18n/I18nProvider";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
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
  actions?: ReactNode;
}

export const PAGE_TITLE_ACTION_BASE_CLASS =
  "btn border transition-colors duration-150";
export const PAGE_TITLE_ACTION_CREATE_CLASS = `${PAGE_TITLE_ACTION_BASE_CLASS} border-primary/45 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/20`;
export const PAGE_TITLE_ACTION_SAVE_CLASS = `${PAGE_TITLE_ACTION_BASE_CLASS} border-success/45 bg-success/10 text-success hover:border-success/70 hover:bg-success/20`;

export function PageTitle({
  title,
  breadcrumb = [],
  onAdd,
  addLabel,
  icon,
  addButtonClassName,
  variant = "boxed",
  actions,
}: PageTitleProps) {
  const { locale, t } = useI18n();
  const addActionDescriptionId = useId();
  const copyByLocale = {
    en: {
      addDescription: (label: string, sectionTitle: string) => `${label} for ${sectionTitle}`,
      breadcrumbAria: "Breadcrumb navigation",
    },
    pl: {
      addDescription: (label: string, sectionTitle: string) => `${label} dla sekcji ${sectionTitle}`,
      breadcrumbAria: "Nawigacja okruszkowa",
    },
    pt: {
      addDescription: (label: string, sectionTitle: string) => `${label} para a secao ${sectionTitle}`,
      breadcrumbAria: "Navegacao breadcrumb",
    },
  } as const;
  const copy = copyByLocale[locale];

  const normalizedBreadcrumb =
    breadcrumb.length > 0
      ? breadcrumb
      : [
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: title },
        ];

  const isDashboardLandingView =
    variant === "flat" &&
    normalizedBreadcrumb[0]?.href === "/dashboard" &&
    normalizedBreadcrumb.length <= 1;

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
    "mb-6 rounded-box md:flex md:items-center md:justify-between";

  const legacyAction = onAdd ? (
    <>
      <button
        type="button"
        className={addButtonClassName ?? PAGE_TITLE_ACTION_CREATE_CLASS}
        onClick={onAdd}
        aria-describedby={addActionDescriptionId}
      >
        <span className="inline-flex items-center gap-1">
          <LuPlus className="h-3.5 w-3.5" />
          <span>{addLabel || t("dashboard.common.add")}</span>
        </span>
      </button>
      <span id={addActionDescriptionId} className="sr-only">
        {copy.addDescription(addLabel || t("dashboard.common.add"), title)}
      </span>
    </>
  ) : null;

  const renderedActions = actions ?? legacyAction;

  return (
    <div className={wrapperClassName}>
      <div className="min-w-0">
        <nav
          aria-label={copy.breadcrumbAria}
          className="breadcrumbs mt-2 max-w-full overflow-x-auto text-sm"
        >
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
                    {item.href ? (
                      <Link href={item.href} className="inline-flex items-center gap-2">
                        {icon ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center text-primary">
                            {icon}
                          </span>
                        ) : null}
                        <span>{title}</span>
                      </Link>
                    ) : (
                      <>
                        {icon ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center text-primary">
                            {icon}
                          </span>
                        ) : null}
                        <span>{title}</span>
                      </>
                    )}
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
                      {item.icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span> : null}
                      {item.label}
                    </Link>
                  ) : (
                    <span className={crumbBaseClass}>
                      {item.icon ? <span className="inline-flex h-3.5 w-3.5 items-center justify-center">{item.icon}</span> : null}
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {renderedActions ? <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-0">{renderedActions}</div> : null}
    </div>
  );
}
