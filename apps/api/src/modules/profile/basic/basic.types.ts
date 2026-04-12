import { z } from "zod";

export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  uiPreferences?: {
    tableColumnVisibility?: Record<string, Record<string, boolean>>;
    timeZonePreference?: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

const tableColumnVisibilitySchema = z.record(z.string(), z.record(z.string(), z.boolean()));

const AUTO_TIME_ZONE = "auto";

const isValidTimeZone = (value: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const timeZonePreferenceSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === AUTO_TIME_ZONE || isValidTimeZone(value),
    "timeZonePreference must be a valid IANA zone or 'auto'"
  );

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  uiPreferences: z
    .object({
      tableColumnVisibility: tableColumnVisibilitySchema.optional(),
      timeZonePreference: timeZonePreferenceSchema.optional(),
    })
    .optional(),
});

export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
