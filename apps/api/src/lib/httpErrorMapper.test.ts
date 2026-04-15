import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { DomainError } from './errors';
import { mapErrorToHttpResponse } from './httpErrorMapper';

class LegacyHttpError extends Error {
  readonly status = 409;

  constructor() {
    super('legacy conflict');
    this.name = 'LegacyHttpError';
  }

  toDetails() {
    return { source: 'legacy' };
  }
}

describe('mapErrorToHttpResponse', () => {
  it('maps ZodError to validation payload', () => {
    const schema = z.object({
      symbol: z.string().min(3),
    });
    const parsed = schema.safeParse({
      symbol: 1,
    });

    if (parsed.success) {
      throw new Error('Expected validation failure');
    }

    const mapped = mapErrorToHttpResponse(parsed.error);
    expect(mapped.status).toBe(400);
    expect(mapped.message).toBe('Validation failed');
    expect(mapped.source).toBe('validation');
    expect(Array.isArray(mapped.details)).toBe(true);
  });

  it('maps DomainError to app payload with details', () => {
    const mapped = mapErrorToHttpResponse(
      new DomainError('WALLET_NOT_FOUND', 'wallet not found', {
        status: 404,
        details: { walletId: 'wallet-1' },
      })
    );

    expect(mapped).toEqual({
      status: 404,
      message: 'wallet not found',
      details: { code: 'WALLET_NOT_FOUND', walletId: 'wallet-1' },
      code: 'WALLET_NOT_FOUND',
      source: 'app',
    });
  });

  it('maps legacy status-based errors for compatibility', () => {
    const mapped = mapErrorToHttpResponse(new LegacyHttpError());

    expect(mapped).toEqual({
      status: 409,
      message: 'legacy conflict',
      details: { source: 'legacy' },
      source: 'legacy',
    });
  });

  it('maps unknown errors to internal-server fallback', () => {
    const mapped = mapErrorToHttpResponse('unexpected');

    expect(mapped).toEqual({
      status: 500,
      message: 'Internal server error',
      source: 'unknown',
    });
  });
});
