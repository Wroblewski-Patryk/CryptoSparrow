import { Prisma } from '@prisma/client';

const isProduction = () => process.env.NODE_ENV === 'production';

const SENSITIVE_ERROR_PATTERNS: RegExp[] = [
  /Invalid\s+`prisma\./i,
  /Can't reach database server/i,
  /database server at/i,
  /PrismaClientInitializationError/i,
  /PrismaClientRustPanicError/i,
  /\bP10\d{2}\b/i,
  /\b(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN)\b/i,
  /`[a-z0-9.-]+:\d{2,5}`/i,
];

const CONNECTION_PRISMA_CODE = /^P10\d{2}$/i;

export const isSensitiveErrorMessage = (message: string): boolean =>
  SENSITIVE_ERROR_PATTERNS.some((pattern) => pattern.test(message));

export const isSensitiveInternalError = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CONNECTION_PRISMA_CODE.test(error.code)
  ) {
    return true;
  }

  return error instanceof Error && isSensitiveErrorMessage(error.message);
};

const getFallbackMessageForStatus = (status: number): string =>
  status >= 500 ? 'Service temporarily unavailable' : 'Request could not be completed';

export const sanitizeErrorMessageForClient = (
  status: number,
  message: string
): { message: string; redacted: boolean } => {
  if (!isProduction()) {
    return { message, redacted: false };
  }

  if (!isSensitiveErrorMessage(message)) {
    return { message, redacted: false };
  }

  return { message: getFallbackMessageForStatus(status), redacted: true };
};
