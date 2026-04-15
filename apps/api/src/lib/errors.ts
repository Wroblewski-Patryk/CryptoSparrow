type ErrorDetailsRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ErrorDetailsRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeStatus = (value: number, fallback = 500): number => {
  if (!Number.isInteger(value)) return fallback;
  if (value < 400 || value > 599) return fallback;
  return value;
};

const normalizeCode = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'APP_ERROR';
};

export type AppErrorOptions<TDetails = unknown> = {
  status: number;
  code: string;
  message: string;
  details?: TDetails;
  cause?: unknown;
  name?: string;
};

export class AppError<TDetails = unknown> extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: TDetails;

  constructor(options: AppErrorOptions<TDetails>) {
    super(options.message);

    this.name = options.name ?? 'AppError';
    this.status = normalizeStatus(options.status);
    this.code = normalizeCode(options.code);
    this.details = options.details;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  toDetails(): ErrorDetailsRecord {
    if (this.details === undefined) {
      return { code: this.code };
    }

    if (isRecord(this.details)) {
      return { code: this.code, ...this.details };
    }

    return {
      code: this.code,
      details: this.details,
    };
  }
}

export type DomainErrorOptions<TDetails = unknown> = {
  status?: number;
  details?: TDetails;
  cause?: unknown;
  name?: string;
};

export class DomainError<TDetails = unknown> extends AppError<TDetails> {
  constructor(
    code: string,
    message: string,
    options: DomainErrorOptions<TDetails> = {}
  ) {
    super({
      status: options.status ?? 400,
      code,
      message,
      details: options.details,
      cause: options.cause,
      name: options.name ?? 'DomainError',
    });
  }
}

export type AppErrorLike = Error & {
  status: number;
  code: string;
  toDetails?: () => unknown;
  details?: unknown;
};

export const isAppErrorLike = (value: unknown): value is AppErrorLike => {
  if (!(value instanceof Error)) return false;
  const candidate = value as Partial<AppErrorLike>;
  return (
    typeof candidate.status === 'number' &&
    Number.isFinite(candidate.status) &&
    typeof candidate.code === 'string' &&
    candidate.code.trim().length > 0
  );
};

export const normalizeHttpStatus = normalizeStatus;
