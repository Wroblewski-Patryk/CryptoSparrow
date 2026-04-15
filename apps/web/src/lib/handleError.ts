import { resolveUiErrorMessage } from './errorResolver';

/** @deprecated Use `resolveUiErrorMessage` from `lib/errorResolver` directly. */
export const handleError = (err: unknown): string => {
  return resolveUiErrorMessage(err, { fallback: 'Wystapil blad' }) ?? 'Wystapil blad';
};
