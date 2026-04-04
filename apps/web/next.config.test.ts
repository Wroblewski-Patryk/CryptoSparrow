import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next security headers', () => {
  it('exposes baseline security headers contract for all routes', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const rules = await nextConfig.headers?.();
    const globalRule = rules?.find((rule) => rule.source === '/:path*');
    expect(globalRule).toBeTruthy();
    const headers = globalRule?.headers ?? [];
    const findHeader = (key: string) => headers.find((item) => item.key === key)?.value;

    expect(findHeader('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(findHeader('X-Frame-Options')).toBe('DENY');
    expect(findHeader('X-Content-Type-Options')).toBe('nosniff');
    expect(findHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(findHeader('Permissions-Policy')).toContain('camera=()');
  });
});

