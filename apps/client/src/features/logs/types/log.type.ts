export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type AuditLogEntry = {
  id: string;
  action: string;
  level: LogLevel;
  source: string;
  message: string;
  category?: string | null;
  actor?: string | null;
  occurredAt: string;
  metadata?: unknown;
};

export type ListLogsParams = {
  source?: string;
  actor?: string;
  severity?: LogLevel;
  limit?: number;
};
