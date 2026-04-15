import { Request, Response } from 'express';
import { sendError } from '../../../utils/apiError';
import { mapErrorToHttpResponse } from '../../../lib/httpErrorMapper';
import { getCookieDomain, getSessionCookieBaseOptions } from '../../auth/auth.cookie';
import { changePasswordSchema, deleteAccountSchema } from './security.types';
import * as securityService from './security.service';
import { PROFILE_SECURITY_ERROR_CODES } from './security.errors';

type ProfileRequest = Request & { user?: { id: string } };

const clearSessionCookie = (res: Response) => {
  const cookieDomain = getCookieDomain();
  const baseOptions = getSessionCookieBaseOptions();

  res.clearCookie('token', baseOptions);
  if (cookieDomain) {
    res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
  }
};

const handleSecurityError = (
  res: Response,
  error: unknown,
  invalidPasswordMessage: string
) => {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.code === PROFILE_SECURITY_ERROR_CODES.invalidPassword) {
    return sendError(res, 400, invalidPasswordMessage, mapped.details);
  }
  if (mapped.code === PROFILE_SECURITY_ERROR_CODES.userNotFound) {
    return sendError(res, 404, 'Not found', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

export const updatePassword = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = changePasswordSchema.parse(req.body);
    await securityService.changePassword(req.user.id, payload);
    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) {
    return handleSecurityError(res, error, 'Invalid current password');
  }
};

export const deleteAccount = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = deleteAccountSchema.parse(req.body);
    await securityService.deleteAccount(req.user.id, payload);
    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) {
    return handleSecurityError(res, error, 'Invalid password');
  }
};
