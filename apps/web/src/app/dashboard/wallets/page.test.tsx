import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('Wallets index page', () => {
  it('redirects to canonical wallets list route', async () => {
    const { default: WalletsIndexPage } = await import('./page');

    await WalletsIndexPage();

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/wallets/list');
  });
});

