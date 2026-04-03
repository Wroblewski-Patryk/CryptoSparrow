import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoginForm } from './useLoginForm';

const mockReplace = vi.fn();
const mockRefetchUser = vi.fn();
const mockLoginUser = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    refetchUser: mockRefetchUser,
  }),
}));

vi.mock('../services/auth.service', () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
}));

vi.mock('../../../lib/handleError', () => ({
  handleError: (error: unknown) => (error instanceof Error ? error.message : 'unknown_error'),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn(),
    handleSubmit: (cb: (data: { email: string; password: string; remember: boolean }) => Promise<void>) => {
      return async () => {
        await cb({
          email: 'john@example.com',
          password: 'secret123',
          remember: true,
        });
      };
    },
    formState: {
      errors: {},
      isSubmitting: false,
    },
  }),
}));

describe('useLoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows error toast when login request fails', async () => {
    mockLoginUser.mockRejectedValueOnce(new Error('invalid_credentials'));

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.onFormSubmit();
    });

    expect(mockToastError).toHaveBeenCalledWith('Logowanie nieudane: invalid_credentials');
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows success toast and redirects to dashboard on successful login', async () => {
    mockLoginUser.mockResolvedValueOnce({});
    mockRefetchUser.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.onFormSubmit();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Zalogowano pomyslnie.');
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('treats missing session refresh after login as failure and does not redirect', async () => {
    mockLoginUser.mockResolvedValueOnce({});
    mockRefetchUser.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useLoginForm());

    await act(async () => {
      await result.current.onFormSubmit();
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
