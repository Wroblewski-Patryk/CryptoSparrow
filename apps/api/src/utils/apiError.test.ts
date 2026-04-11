import { describe, expect, it, afterEach, vi } from 'vitest';
import { sendError } from './apiError';

const originalNodeEnv = process.env.NODE_ENV;

const restoreNodeEnv = () => {
  process.env.NODE_ENV = originalNodeEnv;
};

const createMockResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
};

describe('sendError', () => {
  afterEach(() => {
    restoreNodeEnv();
    vi.restoreAllMocks();
  });

  it('redacts sensitive infrastructure message in production', () => {
    process.env.NODE_ENV = 'production';
    const res = createMockResponse();

    sendError(
      res as never,
      401,
      "Invalid `prisma.user.findUnique()` invocation: Can't reach database server at `x11cfnz1dd9x0yzccftqzcoe:5432`.",
      { host: 'x11cfnz1dd9x0yzccftqzcoe' }
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Request could not be completed' },
    });
  });

  it('keeps safe public message in production', () => {
    process.env.NODE_ENV = 'production';
    const res = createMockResponse();

    sendError(res as never, 503, 'Auth service temporarily unavailable');

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Auth service temporarily unavailable' },
    });
  });

  it('keeps detailed message in non-production', () => {
    process.env.NODE_ENV = 'development';
    const res = createMockResponse();

    sendError(
      res as never,
      500,
      "Invalid `prisma.user.findUnique()` invocation: Can't reach database server at `x11cfnz1dd9x0yzccftqzcoe:5432`.",
      { host: 'x11cfnz1dd9x0yzccftqzcoe' }
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message:
          "Invalid `prisma.user.findUnique()` invocation: Can't reach database server at `x11cfnz1dd9x0yzccftqzcoe:5432`.",
        details: { host: 'x11cfnz1dd9x0yzccftqzcoe' },
      },
    });
  });
});
