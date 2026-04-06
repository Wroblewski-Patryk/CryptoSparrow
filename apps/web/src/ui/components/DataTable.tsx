'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuArrowDown, LuArrowUp, LuArrowUpDown, LuColumns3, LuSearch, LuSlidersHorizontal } from 'react-icons/lu';
import api from '../../lib/api';
import InlinePager from './InlinePager';

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
  toolbarClassName?: string;
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
  defaultSortKey?: string | null;
  defaultSortDirection?: SortDirection;
  persistSortKey?: string;
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
  paginationClassName?: string;
  rowsPerPageSuffixLabel?: string;
  rowsTotalLabel?: string;
  pageLabel?: string;
  columnsToggleLabel?: string;
  columnVisibilityEnabled?: boolean;
  columnVisibilityPreferenceKey?: string;
};

type SortDirection = 'asc' | 'desc';

const compareValues = (a: string | number | null | undefined, b: string | number | null | undefined) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
};

type TableColumnVisibilityState = Record<string, boolean>;

type ProfileUiPreferences = {
  tableColumnVisibility?: Record<string, TableColumnVisibilityState>;
};

type ProfileBasicResponse = {
  uiPreferences?: ProfileUiPreferences;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const normalizeColumnVisibilityState = (
  raw: unknown,
  columns: string[]
): TableColumnVisibilityState | null => {
  if (!isRecord(raw)) return null;
  const knownKeys = new Set(columns);
  const normalized: TableColumnVisibilityState = {};
  let hasKnownKey = false;

  for (const [key, value] of Object.entries(raw)) {
    if (!knownKeys.has(key) || typeof value !== 'boolean') continue;
    normalized[key] = value;
    hasKnownKey = true;
  }

  return hasKnownKey ? normalized : null;
};

const buildDefaultColumnVisibility = (columns: string[]): TableColumnVisibilityState =>
  Object.fromEntries(columns.map((key) => [key, true]));

const mergeColumnVisibilityState = (
  defaults: TableColumnVisibilityState,
  incoming: TableColumnVisibilityState | null
) => {
  if (!incoming) return defaults;
  const next = { ...defaults };
  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in next)) continue;
    next[key] = value;
  }
  return next;
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
  toolbarClassName = '',
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
  defaultSortKey = null,
  defaultSortDirection = 'asc',
  persistSortKey,
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
  paginationClassName = '',
  rowsPerPageSuffixLabel = 'per page',
  rowsTotalLabel = 'Rows',
  pageLabel = 'Page',
  columnsToggleLabel = 'Columns',
  columnVisibilityEnabled = false,
  columnVisibilityPreferenceKey,
}: DataTableProps<T>) {
  const resolvedDefaultPageSize = defaultPageSize ?? pageSizeOptions[0] ?? 10;
  const [internalQuery, setInternalQuery] = useState('');
  const [internalSortKey, setInternalSortKey] = useState<string | null>(defaultSortKey);
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(
    defaultSortDirection
  );
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(resolvedDefaultPageSize);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [advancedOpen, setAdvancedOpen] = useState(advancedDefaultOpen);
  const [columnVisibilityState, setColumnVisibilityState] = useState<TableColumnVisibilityState>({});
  const [columnVisibilityReady, setColumnVisibilityReady] = useState(false);
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const lastSerializedColumnVisibilityRef = useRef('');
  const columnsDropdownRef = useRef<HTMLDivElement | null>(null);

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

  const columnKeys = useMemo(() => columns.map((column) => column.key), [columns]);
  const columnKeysSignature = useMemo(() => columnKeys.join('|'), [columnKeys]);
  const defaultColumnVisibility = useMemo(
    () => buildDefaultColumnVisibility(columnKeys),
    [columnKeys]
  );
  const resolvedColumnVisibility = useMemo(() => {
    if (!columnVisibilityEnabled) return defaultColumnVisibility;
    return mergeColumnVisibilityState(
      defaultColumnVisibility,
      normalizeColumnVisibilityState(columnVisibilityState, columnKeys)
    );
  }, [columnKeys, columnVisibilityEnabled, columnVisibilityState, defaultColumnVisibility]);
  const visibleColumns = useMemo(() => {
    const next = columns.filter((column) => resolvedColumnVisibility[column.key] !== false);
    return next.length > 0 ? next : columns;
  }, [columns, resolvedColumnVisibility]);
  const visibleColumnCount = visibleColumns.length;

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

  const commitPageInput = () => {
    const parsed = Number(pageInputValue.trim());
    if (!Number.isFinite(parsed)) {
      setPageInputValue(String(effectivePage));
      return;
    }
    const clampedPage = Math.min(Math.max(1, Math.trunc(parsed)), totalPages);
    goToPage(clampedPage);
    setPageInputValue(String(clampedPage));
  };

  const handlePageInputChange = (nextRawValue: string) => {
    setPageInputValue(nextRawValue);
    const parsed = Number(nextRawValue.trim());
    if (!Number.isFinite(parsed)) return;
    const clampedPage = Math.min(Math.max(1, Math.trunc(parsed)), totalPages);
    goToPage(clampedPage);
    setPageInputValue(String(clampedPage));
  };

  useEffect(() => {
    if (!paginationEnabled || manualPagination) return;
    setInternalPage(1);
  }, [activeSortDirection, activeSortKey, manualPagination, paginationEnabled, queryValue]);

  useEffect(() => {
    if (!paginationEnabled || manualPagination) return;
    setInternalPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [manualPagination, paginationEnabled, totalPages]);

  useEffect(() => {
    setPageInputValue(String(effectivePage));
  }, [effectivePage]);

  useEffect(() => {
    if (manualSorting || !persistSortKey || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(persistSortKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { sortKey?: unknown; sortDirection?: unknown };
      const nextSortKey = typeof parsed.sortKey === 'string' ? parsed.sortKey : null;
      const nextSortDirection = parsed.sortDirection === 'desc' ? 'desc' : 'asc';
      setInternalSortKey(nextSortKey);
      setInternalSortDirection(nextSortDirection);
    } catch {
      // Ignore malformed localStorage payloads.
    }
  }, [manualSorting, persistSortKey]);

  useEffect(() => {
    if (manualSorting || !persistSortKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        persistSortKey,
        JSON.stringify({
          sortKey: internalSortKey,
          sortDirection: internalSortDirection,
        })
      );
    } catch {
      // Ignore localStorage write failures.
    }
  }, [internalSortDirection, internalSortKey, manualSorting, persistSortKey]);

  useEffect(() => {
    if (!columnVisibilityEnabled || !columnVisibilityPreferenceKey) {
      setColumnVisibilityState(defaultColumnVisibility);
      setColumnVisibilityReady(true);
      return;
    }

    let cancelled = false;
    setColumnVisibilityReady(false);

    const localStorageKey = `datatable.columns.${columnVisibilityPreferenceKey}`;
    const localPayload =
      typeof window === 'undefined' ? null : window.localStorage.getItem(localStorageKey);
    const parsedLocalPayload = (() => {
      if (!localPayload) return null;
      try {
        return normalizeColumnVisibilityState(JSON.parse(localPayload), columnKeys);
      } catch {
        return null;
      }
    })();

    const localResolved = mergeColumnVisibilityState(defaultColumnVisibility, parsedLocalPayload);
    setColumnVisibilityState(localResolved);
    lastSerializedColumnVisibilityRef.current = JSON.stringify(localResolved);

    const hydrateFromProfile = async () => {
      try {
        const response = await api.get<ProfileBasicResponse>('/dashboard/profile/basic');
        const remoteRaw =
          response.data?.uiPreferences?.tableColumnVisibility?.[columnVisibilityPreferenceKey];
        const remoteParsed = normalizeColumnVisibilityState(remoteRaw, columnKeys);
        if (!remoteParsed || cancelled) return;

        const remoteResolved = mergeColumnVisibilityState(defaultColumnVisibility, remoteParsed);
        setColumnVisibilityState(remoteResolved);
        lastSerializedColumnVisibilityRef.current = JSON.stringify(remoteResolved);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(localStorageKey, JSON.stringify(remoteResolved));
        }
      } catch {
        // Ignore profile preference hydration failures.
      }
    };

    void hydrateFromProfile().finally(() => {
      if (cancelled) return;
      setColumnVisibilityReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [
    columnKeys,
    columnKeysSignature,
    columnVisibilityEnabled,
    columnVisibilityPreferenceKey,
    defaultColumnVisibility,
  ]);

  useEffect(() => {
    if (!columnVisibilityEnabled || !columnVisibilityPreferenceKey || !columnVisibilityReady) return;

    const serialized = JSON.stringify(resolvedColumnVisibility);
    if (serialized === lastSerializedColumnVisibilityRef.current) return;

    const localStorageKey = `datatable.columns.${columnVisibilityPreferenceKey}`;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(localStorageKey, serialized);
      }
    } catch {
      // Ignore localStorage write failures.
    }

    const timeout = window.setTimeout(async () => {
      try {
        await api.patch('/dashboard/profile/basic', {
          uiPreferences: {
            tableColumnVisibility: {
              [columnVisibilityPreferenceKey]: resolvedColumnVisibility,
            },
          },
        });
        lastSerializedColumnVisibilityRef.current = serialized;
      } catch {
        // Ignore profile preference sync failures.
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    columnVisibilityEnabled,
    columnVisibilityPreferenceKey,
    columnVisibilityReady,
    resolvedColumnVisibility,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!columnsDropdownOpen) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (columnsDropdownRef.current?.contains(target)) return;
      setColumnsDropdownOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (!columnsDropdownOpen || event.key !== 'Escape') return;
      setColumnsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [columnsDropdownOpen]);

  const sectionClassName = framed
    ? compact
      ? 'space-y-2 rounded-box border border-base-300/60 bg-base-100/80 p-3'
      : 'space-y-3 rounded-box border border-base-300/60 bg-base-100/80 p-4'
    : compact
      ? 'space-y-2'
      : 'space-y-3';
  const softZebraClassName =
    '[&>tbody>tr:nth-child(odd)>td]:bg-base-100/5 [&>tbody>tr:nth-child(even)>td]:bg-base-200/18 [&>tbody>tr>td]:transition-colors';
  const tableClassName = compact
    ? `table table-sm w-full ${softZebraClassName}`
    : `table w-full ${softZebraClassName}`;

  return (
    <section className={sectionClassName}>
      {title ? <h2 className='text-lg font-semibold'>{title}</h2> : null}
      {description ? <p className='text-sm opacity-70'>{description}</p> : null}

      {showSearch || advancedFilters ? (
        <div className={`flex flex-wrap items-center gap-2 ${toolbarClassName}`.trim()}>
          {showSearch ? (
            <div className='relative w-full md:max-w-sm'>
              <LuSearch className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60' />
              <input
                className='input input-bordered input-sm w-full pl-3 pr-10'
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
                advancedOpen ? 'border-base-content/25 bg-base-200 text-base-content hover:bg-base-200' : ''
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
        <div className='rounded-box border border-base-300/60 bg-base-200/45 p-3'>{advancedFilters}</div>
      ) : null}

      <div className='overflow-x-auto'>
        <table className={tableClassName}>
          <thead>
            <tr>
              {visibleColumns.map((column) => (
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
                  {visibleColumns.map((column) => (
                    <td key={`${getRowId(row)}-${column.key}`} className={column.className}>
                      {column.render ? column.render(row) : column.accessor?.(row) ?? '-'}
                    </td>
                  ))}
                </tr>
                {isRowExpanded?.(row) && renderExpandedRow ? (
                  <tr>
                    <td colSpan={visibleColumns.length}>{renderExpandedRow(row)}</td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {pagedRows.length === 0 ? <p className='text-sm opacity-70'>{emptyText}</p> : null}

      {paginationEnabled ? (
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${paginationClassName}`.trim()}>
          <div className='order-2 flex flex-wrap items-center gap-2 text-xs text-base-content/70 sm:order-1'>
            {columnVisibilityEnabled ? (
              <div
                ref={columnsDropdownRef}
                className={`dropdown dropdown-top ${columnsDropdownOpen ? 'dropdown-open' : ''}`}
              >
                <button
                  type='button'
                  className='btn btn-ghost btn-sm gap-1.5'
                  onClick={() => setColumnsDropdownOpen((prev) => !prev)}
                  aria-expanded={columnsDropdownOpen}
                >
                  <LuColumns3 className='h-4 w-4' />
                  <span className='hidden sm:inline'>{columnsToggleLabel}</span>
                </button>
                {columnsDropdownOpen ? (
                  <ul className='menu dropdown-content z-[40] mb-2 w-56 rounded-box border border-base-300/70 bg-base-100 p-2 shadow-lg'>
                    {columns.map((column) => {
                      const isVisible = resolvedColumnVisibility[column.key] !== false;
                      const disableHide = isVisible && visibleColumnCount <= 1;

                      return (
                        <li key={`column-visibility-${column.key}`}>
                          <label className='label cursor-pointer justify-start gap-2 px-2 py-1.5'>
                            <input
                              type='checkbox'
                              className='checkbox checkbox-xs'
                              checked={isVisible}
                              disabled={disableHide}
                              onChange={(event) => {
                                const nextVisible = event.target.checked;
                                setColumnVisibilityState((prev) => ({
                                  ...mergeColumnVisibilityState(defaultColumnVisibility, prev),
                                  [column.key]: nextVisible,
                                }));
                                setColumnsDropdownOpen(false);
                              }}
                            />
                            <span className='label-text text-xs'>{column.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <span>{rowsTotalLabel}: {totalRowsCount}</span>
            <span aria-hidden className='opacity-50'>|</span>
            <span className='inline-flex items-center gap-2'>
              <span>{rowsPerPageLabel}</span>
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
              <span>{rowsPerPageSuffixLabel}</span>
            </span>
            {paginationSummary ? (
              <>
                <span aria-hidden className='opacity-50'>|</span>
                <span>{paginationSummary({ totalRows: totalRowsCount, page: effectivePage, totalPages })}</span>
              </>
            ) : null}
          </div>
          <div className='order-1 flex w-full flex-wrap items-center justify-center gap-2 sm:order-2 sm:w-auto sm:justify-end'>
            <span className='inline-flex items-center gap-2 text-xs text-base-content/70'>
              <span>{pageLabel}</span>
              <input
                type='number'
                inputMode='numeric'
                min={1}
                max={totalPages}
                className='input input-bordered input-xs h-8 min-h-8 w-16 text-center'
                value={pageInputValue}
                onChange={(event) => handlePageInputChange(event.target.value)}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commitPageInput();
                }}
                aria-label={`${pageLabel} input`}
              />
              <span>/ {totalPages}</span>
              {totalPages > 1 ? (
                <InlinePager
                  size='sm'
                  className='shrink-0'
                  previousLabel={previousLabel}
                  nextLabel={nextLabel}
                  previousDisabled={manualPagination ? !(externalHasPrev ?? effectivePage > 1) : effectivePage <= 1}
                  nextDisabled={manualPagination ? !(externalHasNext ?? effectivePage < totalPages) : effectivePage >= totalPages}
                  onPrevious={() => goToPage(effectivePage - 1)}
                  onNext={() => goToPage(effectivePage + 1)}
                />
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
