import { prisma } from '../../../prisma/client';
import { UpdateUserPayload } from './basic.types';
import { publicUserSelect } from '../../users/publicUser';

type TableColumnVisibilityMap = Record<string, Record<string, boolean>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const normalizeColumnVisibilityMap = (value: unknown): TableColumnVisibilityMap => {
  if (!isRecord(value)) return {};
  const normalized: TableColumnVisibilityMap = {};

  for (const [tableKey, tableValue] of Object.entries(value)) {
    if (!isRecord(tableValue)) continue;
    const normalizedColumns: Record<string, boolean> = {};
    for (const [columnKey, visible] of Object.entries(tableValue)) {
      if (typeof visible !== 'boolean') continue;
      normalizedColumns[columnKey] = visible;
    }
    normalized[tableKey] = normalizedColumns;
  }

  return normalized;
};

const profileUserSelect = {
  ...publicUserSelect,
  uiPreferences: true,
} as any;

export const getUser = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: profileUserSelect,
  });
};

export const updateUser = async (id: string, data: UpdateUserPayload) => {
  const { uiPreferences, ...basicData } = data;

  if (!uiPreferences) {
    return prisma.user.update({
      where: { id },
      data: basicData,
      select: profileUserSelect,
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { uiPreferences: true } as any,
  });

  const existingPreferencesSource = (existingUser as { uiPreferences?: unknown } | null)?.uiPreferences;
  const existingPreferences = isRecord(existingPreferencesSource) ? existingPreferencesSource : {};
  const existingTableColumnVisibility = normalizeColumnVisibilityMap(
    existingPreferences.tableColumnVisibility
  );
  const incomingTableColumnVisibility = normalizeColumnVisibilityMap(
    uiPreferences.tableColumnVisibility
  );
  const mergedTableColumnVisibility: TableColumnVisibilityMap = {
    ...existingTableColumnVisibility,
    ...incomingTableColumnVisibility,
  };
  const mergedUiPreferences = {
    ...existingPreferences,
    ...uiPreferences,
    tableColumnVisibility: mergedTableColumnVisibility,
  };

  return prisma.user.update({
    where: { id },
    data: {
      ...basicData,
      uiPreferences: mergedUiPreferences,
    } as any,
    select: profileUserSelect,
  });
};
export const deleteUser = async (id: string) => {
  return prisma.user.delete({ where: { id } });
};
