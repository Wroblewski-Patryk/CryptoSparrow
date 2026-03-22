import { Request, Response } from 'express';
import * as userService from './basic.service';
import { sendError } from '../../../utils/apiError';
import { sendValidationError } from '../../../utils/formatZodError';
import { updateUserSchema } from './basic.types';

type ProfileRequest = Request & { user?: { id: string } };

export const getProfile = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');
  const user = await userService.getUser(req.user.id);
  res.json(user);
};

export const updateProfile = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = updateUserSchema.parse(req.body);
    const updated = await userService.updateUser(req.user.id, payload);
    res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const deleteUser = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');
  await userService.deleteUser(req.user.id);
  return res.status(204).end();
};
