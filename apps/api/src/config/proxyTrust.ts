const normalizeIp = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
};

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split('.').map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 127) return true;
  return false;
};

const isPrivateIpv6 = (ip: string) =>
  ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd');

const parseExplicitTrustedProxyIps = () =>
  (process.env.TRUSTED_PROXY_IPS ?? process.env.OPS_TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => Boolean(entry));

const shouldTrustPrivateProxyRanges = () => {
  const raw = process.env.TRUST_PROXY_ALLOW_PRIVATE?.trim();
  if (raw) {
    return raw.toLowerCase() === 'true';
  }
  return process.env.NODE_ENV !== 'production';
};

export const createTrustProxyMatcher = () => {
  const explicitTrusted = new Set(parseExplicitTrustedProxyIps());
  const trustPrivateRanges = shouldTrustPrivateProxyRanges();

  return (ip: string) => {
    const normalized = normalizeIp(ip);
    if (!normalized) return false;

    if (explicitTrusted.has(normalized)) {
      return true;
    }

    if (trustPrivateRanges && (isPrivateIpv4(normalized) || isPrivateIpv6(normalized))) {
      return true;
    }

    return false;
  };
};
