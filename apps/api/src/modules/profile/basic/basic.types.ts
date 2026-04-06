import { z } from "zod";

export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  uiPreferences?: {
    tableColumnVisibility?: Record<string, Record<string, boolean>>;
  };
  createdAt: Date;
  updatedAt: Date;
};

const tableColumnVisibilitySchema = z.record(z.string(), z.record(z.string(), z.boolean()));

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
  uiPreferences: z
    .object({
      tableColumnVisibility: tableColumnVisibilitySchema.optional(),
    })
    .optional(),
});

export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
