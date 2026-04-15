import api from "@/lib/api";
import type { User } from "../types/user.type";

type ProfileBasicCacheOptions = {
  force?: boolean;
  ttlMs?: number;
};

type TableColumnVisibilityState = Record<string, boolean>;

const DEFAULT_PROFILE_TTL_MS = 15_000;

let cachedProfile: User | null = null;
let cachedAtMs = 0;
let inFlightProfileRequest: Promise<User> | null = null;

const mergeProfilePatch = (base: User, patch: Partial<User>): User => {
  const basePreferences = base.uiPreferences ?? {};
  const patchPreferences = patch.uiPreferences ?? {};
  return {
    ...base,
    ...patch,
    uiPreferences: {
      ...basePreferences,
      ...patchPreferences,
      tableColumnVisibility: {
        ...(basePreferences.tableColumnVisibility ?? {}),
        ...(patchPreferences.tableColumnVisibility ?? {}),
      },
    },
  };
};

const setCachedProfile = (next: User) => {
  cachedProfile = next;
  cachedAtMs = Date.now();
};

export const readProfileBasic = async (
  options: ProfileBasicCacheOptions = {}
): Promise<User> => {
  const ttlMs = options.ttlMs ?? DEFAULT_PROFILE_TTL_MS;
  const now = Date.now();

  if (!options.force && cachedProfile && now - cachedAtMs <= ttlMs) {
    return cachedProfile;
  }

  if (inFlightProfileRequest) {
    return inFlightProfileRequest;
  }

  inFlightProfileRequest = api
    .get<User>("/dashboard/profile/basic")
    .then((response) => {
      setCachedProfile(response.data);
      return response.data;
    })
    .finally(() => {
      inFlightProfileRequest = null;
    });

  return inFlightProfileRequest;
};

export const updateProfileBasic = async (patch: Partial<User>): Promise<User> => {
  const previous = cachedProfile;
  if (previous) {
    setCachedProfile(mergeProfilePatch(previous, patch));
  }

  try {
    const response = await api.patch<User>("/dashboard/profile/basic", patch);
    setCachedProfile(response.data);
    return response.data;
  } catch (error) {
    if (previous) {
      setCachedProfile(previous);
    }
    throw error;
  }
};

export const readTableColumnVisibilityPreference = async (
  preferenceKey: string,
  options: ProfileBasicCacheOptions = {}
): Promise<TableColumnVisibilityState | null> => {
  const profile = await readProfileBasic(options);
  return profile.uiPreferences?.tableColumnVisibility?.[preferenceKey] ?? null;
};

export const saveTableColumnVisibilityPreference = async (
  preferenceKey: string,
  value: TableColumnVisibilityState
) => {
  await updateProfileBasic({
    uiPreferences: {
      tableColumnVisibility: {
        [preferenceKey]: value,
      },
    },
  });
};
