import { Request, Response } from 'express';
import { sendError } from '../../../utils/apiError';
import { sendValidationError } from '../../../utils/formatZodError';
import { getCookieDomain, getSessionCookieBaseOptions } from '../../auth/auth.cookie';
import { changePasswordSchema, deleteAccountSchema } from './security.types';
import * as securityService from './security.service';

type ProfileRequest = Request & { user?: { id: string } };

const clearSessionCookie = (res: Response) => {
  const cookieDomain = getCookieDomain();
  const baseOptions = getSessionCookieBaseOptions();

  res.clearCookie('token', baseOptions);
  if (cookieDomain) {
    res.clearCookie('token', { ...baseOptions, domain: cookieDomain });
  }
};

export const updatePassword = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = changePasswordSchema.parse(req.body);
    await securityService.changePassword(req.user.id, payload);
    return res.status(204).end();
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      return sendError(res, 400, 'Invalid current password');
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return sendError(res, 404, 'Not found');
    }
    return sendValidationError(res, error);
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
    if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
      return sendError(res, 400, 'Invalid password');
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return sendError(res, 404, 'Not found');
    }
    return sendValidationError(res, error);
  }
};

