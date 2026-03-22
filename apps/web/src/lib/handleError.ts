type ErrorLike = {
  response?: {
    data?: {
      error?:
        | string
        | {
            message?: string;
            details?: Array<{ field?: string; message?: string }>;
          };
      message?: string;
    };
    status?: number;
  };
  message?: string;
};

export const handleError = (err: unknown): string => {
  const error = err as ErrorLike | undefined;
  const payloadError = error?.response?.data?.error;

  if (typeof payloadError === 'object' && payloadError?.details?.length) {
    return payloadError.details
      .map(item => item.message)
      .filter(Boolean)
      .join(', ');
  }

  return (
    (typeof payloadError === 'string' ? payloadError : payloadError?.message) ||
    error?.response?.data?.message ||
    error?.message ||
    "Wystapil blad"
  );
};
