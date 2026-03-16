import { z } from "zod";

export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
