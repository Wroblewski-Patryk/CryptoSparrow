import { resolveUiErrorMessage } from './errorResolver';
import { normalizeBaseCurrency, normalizeSymbol } from './symbols';

export const normalizeFormText = (value: string | null | undefined) =>
  (value ?? '').trim();

export const hasFormText = (value: string | null | undefined) =>
  normalizeFormText(value).length > 0;

export const normalizeFormSymbol = (value: string | null | undefined) =>
  normalizeSymbol(value);

export const normalizeFormBaseCurrency = (
  value: string | null | undefined,
  fallback = 'USDT'
) => normalizeBaseCurrency(value) || fallback;

export const resolveFormErrorMessage = (error: unknown, fallback: string) =>
  resolveUiErrorMessage(error, { fallback }) ?? fallback;
