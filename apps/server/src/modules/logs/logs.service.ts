import { prisma } from "../../prisma/client";
import { LogsQuery } from "./logs.types";

export const listLogs = async (userId: string, query: LogsQuery) => {
  return prisma.log.findMany({
    where: {
      userId,
      ...(query.source && { source: query.source }),
      ...(query.actor && { actor: query.actor }),
      ...(query.severity && { level: query.severity }),
    },
    orderBy: { occurredAt: "desc" },
    take: query.limit,
  });
};
