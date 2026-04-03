import { afterEach, describe, expect, it } from 'vitest';
import { getCookieDomain, getSessionCookieBaseOptions } from './auth.cookie';

const originalCookieDomain = process.env.COOKIE_DOMAIN;
const originalCookieSameSite = process.env.COOKIE_SAME_SITE;
const originalNodeEnv = process.env.NODE_ENV;
const originalClientUrl = process.env.CLIENT_URL;

afterEach(() => {
  process.env.COOKIE_DOMAIN = originalCookieDomain;
  process.env.COOKIE_SAME_SITE = originalCookieSameSite;
  process.env.NODE_ENV = originalNodeEnv;
  process.env.CLIENT_URL = originalClientUrl;
});

describe('auth.cookie', () => {
  it('normalizes COOKIE_DOMAIN from URL input', () => {
    process.env.COOKIE_DOMAIN = 'https://api.example.com';
    expect(getCookieDomain()).toBe('api.example.com');
  });

  it('returns undefined for localhost/ip COOKIE_DOMAIN', () => {
    process.env.COOKIE_DOMAIN = 'localhost';
    expect(getCookieDomain()).toBeUndefined();

    process.env.COOKIE_DOMAIN = '127.0.0.1';
    expect(getCookieDomain()).toBeUndefined();
  });

  it('falls back to CLIENT_URL domain when COOKIE_DOMAIN is missing', () => {
    process.env.COOKIE_DOMAIN = '';
    process.env.CLIENT_URL = 'https://soar.luckysparrow.ch';

    expect(getCookieDomain()).toBe('soar.luckysparrow.ch');
  });

  it('defaults sameSite=lax and secure=false outside production', () => {
    process.env.COOKIE_SAME_SITE = '';
    process.env.NODE_ENV = 'development';

    expect(getSessionCookieBaseOptions()).toEqual({
      httpOnly: true,
      secure: false,
      path: '/',
      sameSite: 'lax',
    });
  });

  it('supports sameSite=none and secure=true in production', () => {
    process.env.COOKIE_SAME_SITE = 'none';
    process.env.NODE_ENV = 'production';

    expect(getSessionCookieBaseOptions()).toEqual({
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'none',
    });
  });
});
