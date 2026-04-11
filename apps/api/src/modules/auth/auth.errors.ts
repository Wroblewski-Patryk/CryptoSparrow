import { isSensitiveInternalError } from '../../utils/errorExposure';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

type LoginErrorResponse = { status: number; message: string };

export const mapLoginError = (error: unknown): LoginErrorResponse => {
  if (error instanceof Error && error.message === INVALID_CREDENTIALS_MESSAGE) {
    return { status: 401, message: INVALID_CREDENTIALS_MESSAGE };
  }

  if (isSensitiveInternalError(error)) {
    return { status: 503, message: 'Auth service temporarily unavailable' };
  }

  return { status: 401, message: 'Login failed' };
};
