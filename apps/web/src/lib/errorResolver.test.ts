import { describe, expect, it } from 'vitest';
import { resolveUiErrorMessage } from './errorResolver';
import { getAxiosMessage } from './getAxiosMessage';
import { handleError } from './handleError';

const createAxiosLikeError = (data: unknown, message = 'axios fallback') =>
  ({
    isAxiosError: true,
    response: { data },
    message,
  }) as unknown;

describe('resolveUiErrorMessage', () => {
  it('prefers validation detail messages when present', () => {
    const error = createAxiosLikeError({
      error: {
        details: [{ message: 'symbol is required' }, { message: 'mode is invalid' }],
        message: 'payload message',
      },
    });

    expect(resolveUiErrorMessage(error)).toBe('symbol is required, mode is invalid');
  });

  it('resolves message from payload error/message fallback chain', () => {
    expect(resolveUiErrorMessage(createAxiosLikeError({ error: '  service unavailable  ' }))).toBe(
      'service unavailable'
    );
    expect(resolveUiErrorMessage(createAxiosLikeError({ message: 'request failed' }))).toBe(
      'request failed'
    );
    expect(resolveUiErrorMessage(new Error('plain error'))).toBe('plain error');
  });

  it('applies fallback when no message is available', () => {
    expect(resolveUiErrorMessage({}, { fallback: 'fallback message' })).toBe('fallback message');
  });
});

describe('compat wrappers', () => {
  it('returns undefined for non-axios in getAxiosMessage', () => {
    expect(getAxiosMessage(new Error('boom'))).toBeUndefined();
  });

  it('uses shared resolver for axios payloads in getAxiosMessage', () => {
    const error = createAxiosLikeError({ error: { message: 'api payload message' } });
    expect(getAxiosMessage(error)).toBe('api payload message');
  });

  it('keeps default fallback behavior in handleError', () => {
    expect(handleError({})).toBe('Wystapil blad');
  });
});
