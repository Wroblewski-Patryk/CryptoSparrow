export type UiErrorResolveOptions = {
  fallback?: string;
};

type ErrorDetailsItem = {
  message?: string;
};

type ErrorPayload = {
  error?:
    | string
    | {
        message?: string;
        details?: ErrorDetailsItem[];
      };
  message?: string;
};

type ErrorLike = {
  response?: {
    data?: ErrorPayload;
  };
  message?: string;
};

const pickMessage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const pickDetailsMessage = (details: ErrorDetailsItem[] | undefined): string | undefined => {
  if (!Array.isArray(details) || details.length === 0) return undefined;
  const values = details
    .map((item) => pickMessage(item?.message))
    .filter((message): message is string => Boolean(message));
  return values.length > 0 ? values.join(', ') : undefined;
};

export const resolveUiErrorMessage = (
  err: unknown,
  options: UiErrorResolveOptions = {}
): string | undefined => {
  const error = err as ErrorLike | undefined;
  const payload = error?.response?.data;
  const payloadError = payload?.error;

  if (typeof payloadError === 'object' && payloadError) {
    return (
      pickDetailsMessage(payloadError.details) ??
      pickMessage(payloadError.message) ??
      pickMessage(payload?.message) ??
      pickMessage(error?.message) ??
      options.fallback
    );
  }

  return (
    pickMessage(payloadError) ??
    pickMessage(payload?.message) ??
    pickMessage(error?.message) ??
    options.fallback
  );
};
