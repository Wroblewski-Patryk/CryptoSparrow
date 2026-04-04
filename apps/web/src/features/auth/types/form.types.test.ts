import { describe, expect, it } from 'vitest';
import { registerSchema } from './form.types';

describe('registerSchema', () => {
  it('accepts password with minimum complexity', () => {
    const parsed = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'abc12345',
      terms: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects password shorter than 8 chars', () => {
    const parsed = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a1b2c3',
      terms: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects password without a letter', () => {
    const parsed = registerSchema.safeParse({
      email: 'user@example.com',
      password: '12345678',
      terms: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects password without a digit', () => {
    const parsed = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'abcdefgh',
      terms: true,
    });

    expect(parsed.success).toBe(false);
  });
});
