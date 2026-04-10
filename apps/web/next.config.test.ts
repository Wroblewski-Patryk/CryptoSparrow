import { describe, expect, it } from 'vitest';
import nextConfig, { buildCsp, themeBootstrapScriptSha256 } from './next.config';

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

  it('allows unsafe-eval only in development CSP and keeps production script policy without eval', () => {
    const devCsp = buildCsp('development');
    const prodCsp = buildCsp('production');

    expect(devCsp).toContain("'unsafe-eval'");
    expect(prodCsp).not.toContain("'unsafe-eval'");
    expect(devCsp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(prodCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(prodCsp).toContain(`'sha256-${themeBootstrapScriptSha256}'`);
    expect(devCsp).toContain("connect-src 'self' http: https: ws: wss:");
    expect(prodCsp).toContain("connect-src 'self' https: ws: wss:");
  });
});
