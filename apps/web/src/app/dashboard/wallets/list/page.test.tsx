import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WalletsListPage from './page';
import { I18nProvider } from '@/i18n/I18nProvider';

const pushMock = vi.hoisted(() => vi.fn());
const listWalletsMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/features/wallets/services/wallets.service', () => ({
  listWallets: listWalletsMock,
}));

vi.mock('@/features/wallets/components/WalletsListTable', () => ({
  default: ({ rows }: { rows: Array<{ id: string }> }) => (
    <div data-testid='wallets-list-table'>{rows.length}</div>
  ),
}));

const renderWithI18n = () => {
  window.localStorage.setItem('cryptosparrow-locale', 'en');
  return render(
    <I18nProvider>
      <WalletsListPage />
    </I18nProvider>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  pushMock.mockReset();
  listWalletsMock.mockReset();
});

describe('Wallets list page', () => {
  it('renders list view and routes Add action to wallets create route', async () => {
    listWalletsMock.mockResolvedValue([
      {
        id: 'wallet-1',
        name: 'Main wallet',
      },
    ]);

    renderWithI18n();

    await waitFor(() => {
      expect(listWalletsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Wallets')).toBeInTheDocument();
    expect(screen.getByTestId('wallets-list-table')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(pushMock).toHaveBeenCalledWith('/dashboard/wallets/create');
  });

  it('shows empty state when no wallets are returned', async () => {
    listWalletsMock.mockResolvedValue([]);

    renderWithI18n();

    await waitFor(() => {
      expect(listWalletsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('No wallets')).toBeInTheDocument();
    expect(screen.getByText('Add your first wallet to assign it to bots.')).toBeInTheDocument();
  });
});

