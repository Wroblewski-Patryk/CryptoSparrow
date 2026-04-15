import axios from 'axios';
import { resolveUiErrorMessage } from './errorResolver';

/** @deprecated Use `resolveUiErrorMessage` from `lib/errorResolver` directly. */
export const getAxiosMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) return undefined;
  return resolveUiErrorMessage(err);
};
