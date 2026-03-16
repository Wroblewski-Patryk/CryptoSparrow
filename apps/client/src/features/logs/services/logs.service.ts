import api from "../../../lib/api";
import { AuditLogEntry, ListLogsParams } from "../types/log.type";

export const listLogs = async (params?: ListLogsParams): Promise<AuditLogEntry[]> => {
  const res = await api.get<AuditLogEntry[]>("/dashboard/logs", { params });
  return res.data;
};
