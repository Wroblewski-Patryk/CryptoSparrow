import { type ReactNode } from 'react';

type FormGridProps = {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
};

const GRID_COLUMNS_CLASS: Record<NonNullable<FormGridProps['columns']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
};

export function FormGrid({ columns = 2, className, children }: FormGridProps) {
  const rootClassName = ['grid gap-3', GRID_COLUMNS_CLASS[columns], className].filter(Boolean).join(' ');
  return <div className={rootClassName}>{children}</div>;
}

