export const normalizeUppercaseToken = (value: string | null | undefined) =>
  (value ?? '').trim().toUpperCase();
