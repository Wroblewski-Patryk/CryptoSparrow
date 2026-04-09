import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const walletFormPageContentMock = vi.hoisted(() => vi.fn());

vi.mock('../../_components/WalletFormPageContent', () => ({
  default: (props: { mode: 'create' | 'edit'; editId?: string }) => {
    walletFormPageContentMock(props);
    return <div data-testid='wallet-form-page'>{props.mode}:{props.editId ?? '-'}</div>;
  },
}));

describe('Wallet edit page', () => {
  it('renders edit mode with wallet id', async () => {
    const { default: WalletEditPage } = await import('./page');
    const ui = await WalletEditPage({
      params: Promise.resolve({ id: 'wallet-888' }),
    });

    render(ui);

    expect(screen.getByTestId('wallet-form-page')).toHaveTextContent('edit:wallet-888');
    expect(walletFormPageContentMock).toHaveBeenCalledWith({ mode: 'edit', editId: 'wallet-888' });
  });
});
