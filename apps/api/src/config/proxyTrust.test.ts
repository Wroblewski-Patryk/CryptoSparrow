import { afterEach, describe, expect, it } from 'vitest';
import { createTrustProxyMatcher } from './proxyTrust';

const originalNodeEnv = process.env.NODE_ENV;
const originalTrustedProxyIps = process.env.TRUSTED_PROXY_IPS;
const originalOpsTrustedProxyIps = process.env.OPS_TRUSTED_PROXY_IPS;
const originalTrustProxyAllowPrivate = process.env.TRUST_PROXY_ALLOW_PRIVATE;

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
};

afterEach(() => {
  restoreEnv('NODE_ENV', originalNodeEnv);
  restoreEnv('TRUSTED_PROXY_IPS', originalTrustedProxyIps);
  restoreEnv('OPS_TRUSTED_PROXY_IPS', originalOpsTrustedProxyIps);
  restoreEnv('TRUST_PROXY_ALLOW_PRIVATE', originalTrustProxyAllowPrivate);
});

describe('createTrustProxyMatcher', () => {
  it('does not trust private ranges by default in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUSTED_PROXY_IPS;
    delete process.env.OPS_TRUSTED_PROXY_IPS;
    delete process.env.TRUST_PROXY_ALLOW_PRIVATE;

    const matcher = createTrustProxyMatcher();
    expect(matcher('10.20.30.40')).toBe(false);
  });

  it('trusts private ranges by default outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TRUSTED_PROXY_IPS;
    delete process.env.OPS_TRUSTED_PROXY_IPS;
    delete process.env.TRUST_PROXY_ALLOW_PRIVATE;

    const matcher = createTrustProxyMatcher();
    expect(matcher('10.20.30.40')).toBe(true);
  });

  it('trusts explicitly allowlisted proxy IPs', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUSTED_PROXY_IPS = '203.0.113.10, 198.51.100.11';
    process.env.TRUST_PROXY_ALLOW_PRIVATE = 'false';

    const matcher = createTrustProxyMatcher();
    expect(matcher('203.0.113.10')).toBe(true);
    expect(matcher('198.51.100.11')).toBe(true);
    expect(matcher('10.20.30.40')).toBe(false);
  });
});
