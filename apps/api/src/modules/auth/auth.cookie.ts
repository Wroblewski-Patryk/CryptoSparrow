type SessionSameSite = 'lax' | 'strict' | 'none';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const parseCookieDomainFromUrlLike = (value: string): string | null => {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname || null;
  } catch {
    return null;
  }
};

const normalizeDomain = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const fromUrl = parseCookieDomainFromUrlLike(trimmed);
  const rawHost = (fromUrl ?? trimmed).trim().replace(/^\./, '');
  if (!rawHost) return undefined;

  // Cookie domain must not contain port/path and should not be localhost or IP for host-only local setups.
  const hostOnly = rawHost.split('/')[0]?.split(':')[0]?.trim();
  if (!hostOnly) return undefined;
  const lowerHost = hostOnly.toLowerCase();
  if (LOCAL_HOSTS.has(lowerHost)) return undefined;
  if (lowerHost === 'undefined' || lowerHost === 'null') return undefined;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)) return undefined;

  return hostOnly;
};

export const getCookieDomain = (): string | undefined => {
  const explicitDomain = normalizeDomain(process.env.COOKIE_DOMAIN ?? '');
  if (explicitDomain) return explicitDomain;

  return normalizeDomain(process.env.CLIENT_URL ?? '');
};

const resolveSameSite = (): SessionSameSite => {
  const raw = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === 'none') return 'none';
  if (raw === 'strict') return 'strict';
  return 'lax';
};

export const getSessionCookieBaseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  sameSite: resolveSameSite(),
});
