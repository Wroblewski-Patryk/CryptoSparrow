import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';
import { I18nProvider } from '@/i18n/I18nProvider';

const mockUseLoginForm = vi.fn();

vi.mock('../hooks/useLoginForm', () => ({
  useLoginForm: () => mockUseLoginForm(),
}));

describe('LoginForm', () => {
  afterEach(() => {
    window.localStorage.removeItem('cryptosparrow-locale');
    window.history.pushState({}, '', '/');
  });

  const renderWithI18n = () => {
    window.history.pushState({}, '', '/auth/login');
    return render(
      <I18nProvider>
        <LoginForm />
      </I18nProvider>
    );
  };

  it('renders email and password fields', () => {
    mockUseLoginForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
      serverError: null,
    });

    renderWithI18n();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    mockUseLoginForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
      serverError: null,
    });

    renderWithI18n();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('uses Portuguese auth namespace copy when locale is pt', async () => {
    window.localStorage.setItem('cryptosparrow-locale', 'pt');
    mockUseLoginForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
      serverError: null,
    });

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText('Lembrar este dispositivo')).toBeInTheDocument();
    });
  });
});
