import { Request, Response } from 'express';
import { sendError } from '../../../utils/apiError';
import * as subscriptionService from './subscription.service';

type ProfileRequest = Request & { user?: { id: string } };

export const getSubscription = async (req: ProfileRequest, res: Response) => {
  if (!req.user?.id) return sendError(res, 401, 'Unauthorized');

  const payload = await subscriptionService.getProfileSubscription(req.user.id);
  return res.json(payload);
};

