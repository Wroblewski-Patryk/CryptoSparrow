import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../index';
import { prisma } from '../../prisma/client';

describe('POST /auth/register', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('should register a user successfully', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'test1234',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('should reject weak password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'fail@example.com',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('password');
  });

  it('should reject duplicate email', async () => {
    await prisma.user.create({
      data: {
        email: 'dupe@example.com',
        password: 'hashed', // może być byle co
      },
    });

    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'dupe@example.com',
        password: 'test1234',
      });

    expect(res.status).toBe(500); // bo rzuca Error w service
    expect(res.body.error).toBe('Internal server error');
  });
});
