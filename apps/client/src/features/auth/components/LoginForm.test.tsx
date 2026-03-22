import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';

const mockUseLoginForm = vi.fn();

vi.mock('../hooks/useLoginForm', () => ({
  useLoginForm: () => mockUseLoginForm(),
}));

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    mockUseLoginForm.mockReturnValue({
      register: () => ({ name: 'field', onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() }),
      onFormSubmit: vi.fn(),
      errors: {},
      isSubmitting: false,
      serverError: null,
    });

    render(<LoginForm />);

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

    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
