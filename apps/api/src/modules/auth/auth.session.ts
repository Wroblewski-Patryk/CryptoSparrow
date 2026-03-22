export const SESSION_TTL_MS = 60 * 60 * 1000; // 1h
export const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export const SESSION_JWT_EXPIRES_IN = "1h";
export const REMEMBER_ME_JWT_EXPIRES_IN = "30d";

export const getSessionTtlMs = (remember?: boolean) =>
  remember ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS;

export const getSessionJwtExpiresIn = (remember?: boolean) =>
  remember ? REMEMBER_ME_JWT_EXPIRES_IN : SESSION_JWT_EXPIRES_IN;
