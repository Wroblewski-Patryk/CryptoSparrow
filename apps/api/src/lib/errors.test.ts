import { describe, expect, it } from 'vitest';
import { AppError, DomainError, isAppErrorLike, normalizeHttpStatus } from './errors';

describe('errors core primitives', () => {
  it('builds AppError details with code fallback', () => {
    const error = new AppError({
      status: 409,
      code: 'RESOURCE_CONFLICT',
      message: 'resource conflict',
      details: { resource: 'wallet' },
    });

    expect(error.status).toBe(409);
    expect(error.code).toBe('RESOURCE_CONFLICT');
    expect(error.toDetails()).toEqual({
      code: 'RESOURCE_CONFLICT',
      resource: 'wallet',
    });
  });

  it('wraps non-object details into stable payload', () => {
    const error = new AppError({
      status: 422,
      code: 'VALIDATION_RULE_FAILED',
      message: 'validation failed',
      details: 'field missing',
    });

    expect(error.toDetails()).toEqual({
      code: 'VALIDATION_RULE_FAILED',
      details: 'field missing',
    });
  });

  it('creates DomainError with 400 default status', () => {
    const error = new DomainError('BOT_NOT_FOUND', 'bot not found');

    expect(error.status).toBe(400);
    expect(error.code).toBe('BOT_NOT_FOUND');
    expect(error.name).toBe('DomainError');
  });

  it('detects app-like errors via type guard', () => {
    const error = new DomainError('WALLET_NOT_FOUND', 'wallet not found', {
      status: 404,
      details: { walletId: 'w1' },
    });

    expect(isAppErrorLike(error)).toBe(true);
    expect(isAppErrorLike(new Error('plain'))).toBe(false);
  });

  it('normalizes invalid HTTP status values', () => {
    expect(normalizeHttpStatus(404)).toBe(404);
    expect(normalizeHttpStatus(399)).toBe(500);
    expect(normalizeHttpStatus(700)).toBe(500);
  });
});
