import Link from "next/link";
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

export function PageTitle({ title, breadcrumb = [], onAdd, addLabel } : PageTitleProps) {
  return (
    <div className="bg-base-200 p-4 my-6 flex flex-col flex-row items-center justify-between rounded">
      <div>
        {/* Tytuł */}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {/* Breadcrumb */}
        <div className="text-sm breadcrumbs mt-2">
          <ul>
            {breadcrumb.map((item, idx) =>
              <li key={item.href || item.label}>
                {item.href
                  ? <Link href={item.href}>{item.label}</Link>
                  : <span>{item.label}</span>
                }
              </li>
            )}
          </ul>
        </div>
      </div>
      {/* Przycisk dodawania */}
      {onAdd && (
        <button className="btn btn-primary" onClick={onAdd}>
          {addLabel || "Dodaj"}
        </button>
      )}
    </div>
  );
}
