import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('Wallet /:id route', () => {
  it('redirects to canonical edit route', async () => {
    const { default: WalletDetailsRedirectPage } = await import('./page');

    await WalletDetailsRedirectPage({
      params: Promise.resolve({ id: 'wallet-321' }),
    });

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/wallets/wallet-321/edit');
  });
});
