import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../prisma/client';
import { registerUser } from './auth.service';

describe('registerUser', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('should register new user', async () => {
    const user = await registerUser({
      email: 'test@user.com',
      password: 'test123',
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('test@user.com');
    expect(user.password).not.toBe('test123'); 
  });

  it('should throw if user exists', async () => {
    await registerUser({
      email: 'duplikat@user.com',
      password: 'test123',
    });

    await expect(() =>
      registerUser({
        email: 'duplikat@user.com',
        password: 'test123',
      })
    ).rejects.toThrow('User already exists');
  });
});
