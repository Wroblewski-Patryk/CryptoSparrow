type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const logLevelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const normalizeLogLevel = (value: string | undefined): LogLevel => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return 'info';
};

const configuredLogLevel = normalizeLogLevel(process.env.LOG_LEVEL);

const shouldLog = (level: LogLevel) => {
  if (process.env.NODE_ENV === 'test') return false;
  return logLevelPriority[level] >= logLevelPriority[configuredLogLevel];
};

const serializeValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
};

const sanitizeFields = (fields: LogFields | undefined): LogFields => {
  if (!fields) return {};
  const sanitized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sanitized[key] = serializeValue(value);
  }
  return sanitized;
};

const writeLog = (level: LogLevel, module: string, event: string, fields?: LogFields) => {
  if (!shouldLog(level)) return;

  const payload = {
    level,
    module,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeFields(fields),
  };

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
};

export const createModuleLogger = (module: string) => ({
  debug: (event: string, fields?: LogFields) => writeLog('debug', module, event, fields),
  info: (event: string, fields?: LogFields) => writeLog('info', module, event, fields),
  warn: (event: string, fields?: LogFields) => writeLog('warn', module, event, fields),
  error: (event: string, fields?: LogFields) => writeLog('error', module, event, fields),
});

