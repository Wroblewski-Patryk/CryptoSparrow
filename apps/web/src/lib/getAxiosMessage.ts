import axios from 'axios';

export const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  const payload = err.response?.data as
    | {
        message?: string;
        error?: {
          message?: string;
        };
      }
    | undefined;
  return payload?.error?.message ?? payload?.message;
};
