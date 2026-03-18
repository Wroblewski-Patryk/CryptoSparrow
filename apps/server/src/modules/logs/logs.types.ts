import { z } from "zod";
import { LogLevel } from "@prisma/client";

export const LogsQuerySchema = z.object({
  source: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).optional(),
  severity: z.nativeEnum(LogLevel).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  page: z.coerce.number().int().min(1).default(1),
});

export type LogsQuery = z.infer<typeof LogsQuerySchema>;
