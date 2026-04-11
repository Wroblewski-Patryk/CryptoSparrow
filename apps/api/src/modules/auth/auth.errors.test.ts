import { describe, expect, it } from 'vitest';
import { mapLoginError } from './auth.errors';

describe('mapLoginError', () => {
  it('returns 401 with invalid credentials message for auth mismatch', () => {
    const mapped = mapLoginError(new Error('Invalid email or password'));

    expect(mapped).toEqual({
      status: 401,
      message: 'Invalid email or password',
    });
  });

  it('returns 503 with generic auth service message for sensitive infrastructure errors', () => {
    const mapped = mapLoginError(
      new Error(
        "Invalid `prisma.user.findUnique()` invocation: Can't reach database server at `x11cfnz1dd9x0yzccftqzcoe:5432`."
      )
    );

    expect(mapped).toEqual({
      status: 503,
      message: 'Auth service temporarily unavailable',
    });
  });

  it('returns generic login failure for unknown non-sensitive errors', () => {
    const mapped = mapLoginError(new Error('unexpected_login_failure'));

    expect(mapped).toEqual({
      status: 401,
      message: 'Login failed',
    });
  });
});
