import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());
const walletFormPageContentMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('../_components/WalletFormPageContent', () => ({
  default: (props: { mode: 'create' | 'edit'; editId?: string }) => {
    walletFormPageContentMock(props);
    return <div data-testid='wallet-form-page'>{props.mode}</div>;
  },
}));

describe('Wallet create page', () => {
  it('renders create mode for canonical create route', async () => {
    const { default: WalletCreatePage } = await import('./page');
    const ui = await WalletCreatePage({ searchParams: Promise.resolve({}) });

    render(ui);

    expect(screen.getByTestId('wallet-form-page')).toHaveTextContent('create');
    expect(walletFormPageContentMock).toHaveBeenCalledWith({ mode: 'create' });
  });

  it('redirects legacy editId query to canonical wallet edit route', async () => {
    const { default: WalletCreatePage } = await import('./page');

    await WalletCreatePage({
      searchParams: Promise.resolve({ editId: 'wallet-123' }),
    });

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/wallets/wallet-123/edit');
  });
});
