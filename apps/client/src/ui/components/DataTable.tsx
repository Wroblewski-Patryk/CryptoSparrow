'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';

export type DataTableColumn<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  accessor?: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  title?: string;
  description?: string;
  filterPlaceholder?: string;
  filterFn?: (row: T, query: string) => boolean;
  emptyText?: string;
  isRowExpanded?: (row: T) => boolean;
  renderExpandedRow?: (row: T) => ReactNode;
};

type SortDirection = 'asc' | 'desc';

const compareValues = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

export default function DataTable<T>({
  rows,
  columns,
  getRowId,
  title,
  description,
  filterPlaceholder = 'Filter...',
  filterFn,
  emptyText = 'No rows',
  isRowExpanded,
  renderExpandedRow,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [direction, setDirection] = useState<SortDirection>('asc');

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    if (filterFn) return rows.filter((row) => filterFn(row, query));

    const normalized = query.trim().toLowerCase();
    return rows.filter((row) =>
      columns.some((column) => {
        const accessor = column.accessor;
        if (!accessor) return false;
        const value = accessor(row);
        return value != null && String(value).toLowerCase().includes(normalized);
      })
    );
  }, [columns, filterFn, query, rows]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.accessor) return filteredRows;

    const copy = [...filteredRows];
    copy.sort((left, right) => {
      const compared = compareValues(column.accessor?.(left), column.accessor?.(right));
      return direction === 'asc' ? compared : -compared;
    });
    return copy;
  }, [columns, direction, filteredRows, sortKey]);

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    if (sortKey !== column.key) {
      setSortKey(column.key);
      setDirection('asc');
      return;
    }
    setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <section className='space-y-3 rounded-xl border border-base-300 bg-base-100 p-4'>
      {title ? <h2 className='text-lg font-semibold'>{title}</h2> : null}
      {description ? <p className='text-sm opacity-70'>{description}</p> : null}

      <input
        className='input input-bordered input-sm w-full md:max-w-sm'
        placeholder={filterPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className='overflow-x-auto'>
        <table className='table table-zebra'>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className}>
                  {column.sortable ? (
                    <button type='button' className='btn btn-ghost btn-xs px-1' onClick={() => handleSort(column)}>
                      {column.label}
                      {sortKey === column.key ? (direction === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <Fragment key={getRowId(row)}>
                <tr>
                  {columns.map((column) => (
                    <td key={`${getRowId(row)}-${column.key}`} className={column.className}>
                      {column.render ? column.render(row) : column.accessor?.(row) ?? '-'}
                    </td>
                  ))}
                </tr>
                {isRowExpanded?.(row) && renderExpandedRow ? (
                  <tr>
                    <td colSpan={columns.length}>{renderExpandedRow(row)}</td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {sortedRows.length === 0 ? <p className='text-sm opacity-70'>{emptyText}</p> : null}
    </section>
  );
}
