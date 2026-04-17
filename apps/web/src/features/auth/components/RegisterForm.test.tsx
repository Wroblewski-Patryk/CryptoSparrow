import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RegisterForm from './RegisterForm';
import { I18nProvider } from '@/i18n/I18nProvider';

const mockUseRegisterForm = vi.fn();

vi.mock('../hooks/useRegisterForm', () => ({
  useRegisterForm: () => mockUseRegisterForm(),
}));

describe('RegisterForm', () => {
  afterEach(() => {
    window.localStorage.removeItem('cryptosparrow-locale');
    window.history.pushState({}, '', '/');
  });

  const renderWithI18n = () => {
    window.history.pushState({}, '', '/auth/register');
    return render(
      <I18nProvider>
        <RegisterForm />
      </I18nProvider>
    );
  };

  it('renders email and password fields', () => {
    mockUseRegisterForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
    });

    renderWithI18n();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('toggles password visibility', () => {
    mockUseRegisterForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
    });

    renderWithI18n();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('uses Polish auth namespace copy when locale is pl', async () => {
    window.localStorage.setItem('cryptosparrow-locale', 'pl');
    mockUseRegisterForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
    });

    renderWithI18n();

    await waitFor(() => {
      expect(screen.getByText('Masz konto?')).toBeInTheDocument();
    });
  });
});
