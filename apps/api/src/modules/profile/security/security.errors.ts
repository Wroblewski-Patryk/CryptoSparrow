import { DomainError } from '../../../lib/errors';

export const PROFILE_SECURITY_ERROR_CODES = {
  userNotFound: 'USER_NOT_FOUND',
  invalidPassword: 'INVALID_PASSWORD',
} as const;

type ProfileSecurityErrorCode =
  (typeof PROFILE_SECURITY_ERROR_CODES)[keyof typeof PROFILE_SECURITY_ERROR_CODES];

export class ProfileSecurityDomainError extends DomainError {
  constructor(code: ProfileSecurityErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'ProfileSecurityDomainError',
    });
  }
}

export const profileSecurityErrors = {
  userNotFound: () => new ProfileSecurityDomainError(PROFILE_SECURITY_ERROR_CODES.userNotFound, 404),
  invalidPassword: () =>
    new ProfileSecurityDomainError(PROFILE_SECURITY_ERROR_CODES.invalidPassword, 400),
};
