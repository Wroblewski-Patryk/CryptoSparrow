import { Prisma } from '@prisma/client';
import { prisma } from '../../../prisma/client';
import { UpdateUserPayload } from './basic.types';
import { publicUserSelect } from '../../users/publicUser';

type TableColumnVisibilityMap = Record<string, Record<string, boolean>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const toJsonObject = (value: unknown): Prisma.JsonObject => {
  if (!isRecord(value)) return {};
  return value as Prisma.JsonObject;
};

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
} satisfies Prisma.UserSelect;

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
    select: { uiPreferences: true } satisfies Prisma.UserSelect,
  });

  const existingPreferences = toJsonObject(existingUser?.uiPreferences);
  const incomingPreferences = toJsonObject(uiPreferences);
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
  const mergedUiPreferences: Prisma.InputJsonValue = {
    ...existingPreferences,
    ...incomingPreferences,
    tableColumnVisibility: mergedTableColumnVisibility,
  };

  const updateData: Prisma.UserUpdateInput = {
    ...basicData,
    uiPreferences: mergedUiPreferences,
  };

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: profileUserSelect,
  });
};
export const deleteUser = async (id: string) => {
  return prisma.user.delete({ where: { id } });
};
