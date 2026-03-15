type ErrorLike = {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message?: string;
};

export const handleError = (err: unknown): string => {
  const error = err as ErrorLike | undefined;

  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Wystapil blad"
  );
};
