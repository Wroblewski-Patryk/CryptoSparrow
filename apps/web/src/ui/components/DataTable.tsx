'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuSearch, LuSlidersHorizontal } from 'react-icons/lu';

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
  compact?: boolean;
  framed?: boolean;
  showSearch?: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  advancedFilters?: ReactNode;
  advancedToggleLabel?: string;
  advancedDefaultOpen?: boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (sortKey: string | null, direction: SortDirection) => void;
  paginationEnabled?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  rowsPerPageLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  manualPagination?: boolean;
  page?: number;
  pageSize?: number;
  totalRows?: number;
  totalPages?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  paginationSummary?: (meta: { totalRows: number; page: number; totalPages: number }) => ReactNode;
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
  compact = false,
  framed = true,
  showSearch = true,
  query,
  onQueryChange,
  onSearch,
  advancedFilters,
  advancedToggleLabel = 'Advanced',
  advancedDefaultOpen = false,
  manualFiltering = false,
  manualSorting = false,
  sortKey: externalSortKey,
  sortDirection: externalSortDirection = 'asc',
  onSortChange,
  paginationEnabled = false,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize,
  rowsPerPageLabel = 'Rows',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  manualPagination = false,
  page: externalPage,
  pageSize: externalPageSize,
  totalRows: externalTotalRows,
  totalPages: externalTotalPages,
  hasPrev: externalHasPrev,
  hasNext: externalHasNext,
  onPageChange,
  onPageSizeChange,
  paginationSummary,
}: DataTableProps<T>) {
  const resolvedDefaultPageSize = defaultPageSize ?? pageSizeOptions[0] ?? 10;
  const [internalQuery, setInternalQuery] = useState('');
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>('asc');
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(resolvedDefaultPageSize);
  const [advancedOpen, setAdvancedOpen] = useState(advancedDefaultOpen);

  const isQueryControlled = query != null;
  const queryValue = isQueryControlled ? (query ?? '') : internalQuery;
  const activeSortKey = manualSorting ? (externalSortKey ?? null) : internalSortKey;
  const activeSortDirection = manualSorting ? externalSortDirection : internalSortDirection;

  const setQueryValue = (nextValue: string) => {
    if (!isQueryControlled) {
      setInternalQuery(nextValue);
    }
    onQueryChange?.(nextValue);
  };

  const filteredRows = useMemo(() => {
    if (manualFiltering) return rows;
    if (!queryValue.trim()) return rows;
    if (filterFn) return rows.filter((row) => filterFn(row, queryValue));

    const normalized = queryValue.trim().toLowerCase();
    return rows.filter((row) =>
      columns.some((column) => {
        const accessor = column.accessor;
        if (!accessor) return false;
        const value = accessor(row);
        return value != null && String(value).toLowerCase().includes(normalized);
      })
    );
  }, [columns, filterFn, manualFiltering, queryValue, rows]);

  const sortedRows = useMemo(() => {
    if (manualSorting || !activeSortKey) return filteredRows;
    const column = columns.find((item) => item.key === activeSortKey);
    if (!column?.accessor) return filteredRows;

    const copy = [...filteredRows];
    copy.sort((left, right) => {
      const compared = compareValues(column.accessor?.(left), column.accessor?.(right));
      return activeSortDirection === 'asc' ? compared : -compared;
    });
    return copy;
  }, [activeSortDirection, activeSortKey, columns, filteredRows, manualSorting]);

  const totalRowsCount = manualPagination ? externalTotalRows ?? sortedRows.length : sortedRows.length;
  const effectivePageSize = manualPagination
    ? Math.max(1, externalPageSize ?? resolvedDefaultPageSize)
    : Math.max(1, internalPageSize);
  const computedTotalPages = Math.max(1, Math.ceil(Math.max(totalRowsCount, 0) / effectivePageSize));
  const totalPages = manualPagination
    ? Math.max(1, externalTotalPages ?? computedTotalPages)
    : computedTotalPages;
  const effectivePage = Math.min(
    Math.max(1, manualPagination ? externalPage ?? 1 : internalPage),
    totalPages
  );
  const pagedRows = paginationEnabled
    ? manualPagination
      ? sortedRows
      : sortedRows.slice((effectivePage - 1) * effectivePageSize, effectivePage * effectivePageSize)
    : sortedRows;

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    let nextSortKey: string | null = column.key;
    let nextDirection: SortDirection = 'asc';

    if (activeSortKey === column.key) {
      if (activeSortDirection === 'asc') {
        nextDirection = 'desc';
      } else {
        nextSortKey = null;
        nextDirection = 'asc';
      }
    }

    if (manualSorting) {
      onSortChange?.(nextSortKey, nextDirection);
    } else {
      setInternalSortKey(nextSortKey);
      setInternalSortDirection(nextDirection);
    }
  };

  const applySearch = () => {
    if (onSearch) {
      onSearch(queryValue.trim());
      return;
    }
    setQueryValue(queryValue.trim());
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    if (manualPagination) {
      onPageSizeChange?.(nextPageSize);
      onPageChange?.(1);
      return;
    }
    setInternalPageSize(nextPageSize);
    setInternalPage(1);
  };

  const goToPage = (nextPage: number) => {
    if (manualPagination) {
      onPageChange?.(Math.min(Math.max(1, nextPage), totalPages));
      return;
    }
    setInternalPage(Math.min(Math.max(1, nextPage), totalPages));
  };

  useEffect(() => {
    if (!paginationEnabled || manualPagination) return;
    setInternalPage(1);
  }, [activeSortDirection, activeSortKey, manualPagination, paginationEnabled, queryValue]);

  useEffect(() => {
    if (!paginationEnabled || manualPagination) return;
    setInternalPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [manualPagination, paginationEnabled, totalPages]);

  const sectionClassName = framed
    ? compact
      ? 'space-y-2 rounded-xl border border-base-300 bg-base-100 p-3'
      : 'space-y-3 rounded-xl border border-base-300 bg-base-100 p-4'
    : compact
      ? 'space-y-2'
      : 'space-y-3';
  const tableClassName = compact ? 'table table-zebra table-sm w-full' : 'table table-zebra w-full';

  return (
    <section className={sectionClassName}>
      {title ? <h2 className='text-lg font-semibold'>{title}</h2> : null}
      {description ? <p className='text-sm opacity-70'>{description}</p> : null}

      {showSearch || advancedFilters ? (
        <div className='flex flex-wrap items-center gap-2'>
          {showSearch ? (
            <div className='relative w-full md:max-w-sm'>
              <LuSearch className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60' />
              <input
                className='input input-bordered input-sm w-full pl-9 pr-10'
                placeholder={filterPlaceholder}
                value={queryValue}
                onChange={(event) => setQueryValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  applySearch();
                }}
              />
              <button
                type='button'
                aria-label='Filter rows'
                className='btn btn-ghost btn-xs absolute right-1 top-1/2 h-7 min-h-7 w-7 -translate-y-1/2 rounded-full opacity-70 hover:opacity-100'
                onClick={applySearch}
              >
                <LuSearch className='h-3.5 w-3.5' />
              </button>
            </div>
          ) : null}
          {advancedFilters ? (
            <button
              type='button'
              className={`btn btn-outline btn-sm gap-1.5 ${
                advancedOpen ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15' : ''
              }`}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-expanded={advancedOpen}
            >
              <LuSlidersHorizontal className='h-3.5 w-3.5' />
              <span>{advancedToggleLabel}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {advancedFilters && advancedOpen ? (
        <div className='rounded-box border border-base-300 bg-base-200/40 p-3'>{advancedFilters}</div>
      ) : null}

      <div className='overflow-x-auto'>
        <table className={tableClassName}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className}>
                  {column.sortable ? (
                    <button
                      type='button'
                      className='btn btn-ghost btn-xs h-7 min-h-7 px-1.5 normal-case font-medium'
                      onClick={() => handleSort(column)}
                    >
                      <span>{column.label}</span>
                      <span
                        aria-hidden
                        className={`inline-flex items-center ${activeSortKey === column.key ? 'opacity-100' : 'opacity-35'}`}
                      >
                        {activeSortKey !== column.key ? (
                          <LuArrowUpDown className='h-3.5 w-3.5' />
                        ) : activeSortDirection === 'asc' ? (
                          <LuArrowUp className='h-3.5 w-3.5' />
                        ) : (
                          <LuArrowDown className='h-3.5 w-3.5' />
                        )}
                      </span>
                    </button>
                  ) : (
                    <span className='inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-base-content/80'>
                      {column.label}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
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

      {pagedRows.length === 0 ? <p className='text-sm opacity-70'>{emptyText}</p> : null}

      {paginationEnabled ? (
        <div className='mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-base-300/50 pt-2'>
          <div className='flex flex-wrap items-center gap-2 text-xs text-base-content/70'>
            {paginationSummary ? (
              paginationSummary({ totalRows: totalRowsCount, page: effectivePage, totalPages })
            ) : (
              <>
                <span>Records: {totalRowsCount}</span>
                <span aria-hidden className='opacity-50'>•</span>
                <span>Page {effectivePage}/{totalPages}</span>
              </>
            )}
          </div>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <label className='label cursor-pointer gap-2 py-0 text-xs'>
              <span className='label-text text-xs opacity-70'>{rowsPerPageLabel}</span>
              <select
                className='select select-bordered select-sm h-8 min-h-8 w-20'
                value={effectivePageSize}
                onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className='join'>
              <button
                type='button'
                className='btn btn-outline btn-sm join-item h-8 min-h-8 px-3'
                disabled={manualPagination ? !(externalHasPrev ?? effectivePage > 1) : effectivePage <= 1}
                onClick={() => goToPage(effectivePage - 1)}
              >
                {previousLabel}
              </button>
              <button
                type='button'
                className='btn btn-outline btn-sm join-item h-8 min-h-8 px-3'
                disabled={manualPagination ? !(externalHasNext ?? effectivePage < totalPages) : effectivePage >= totalPages}
                onClick={() => goToPage(effectivePage + 1)}
              >
                {nextLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
