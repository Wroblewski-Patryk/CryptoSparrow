import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Header from './Header';

const useAuthMock = vi.hoisted(() => vi.fn());
const useI18nMock = vi.hoisted(() => vi.fn());

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => useI18nMock(),
}));

vi.mock('../../components/AppLogoLink', () => ({
  default: () => <span>Soar</span>,
}));

describe('Public Header', () => {
  it('shows dashboard and admin buttons for logged-in admin user', () => {
    useAuthMock.mockReturnValue({
      user: { email: 'admin@example.com', userId: 'u1', role: 'ADMIN' },
      loading: false,
    });
    useI18nMock.mockReturnValue({ locale: 'en' });

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });

  it('does not show admin button for non-admin logged-in user', () => {
    useAuthMock.mockReturnValue({
      user: { email: 'user@example.com', userId: 'u2', role: 'USER' },
      loading: false,
    });
    useI18nMock.mockReturnValue({ locale: 'en' });

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
