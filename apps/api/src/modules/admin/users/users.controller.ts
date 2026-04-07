import { Request, Response } from 'express';
import { sendError } from '../../../utils/apiError';
import { sendValidationError } from '../../../utils/formatZodError';
import {
  AdminUserParamsSchema,
  AdminUsersListQuerySchema,
  UpdateAdminUserSchema,
} from './users.types';
import * as service from './users.service';

export const listUsers = async (req: Request, res: Response) => {
  try {
    const query = AdminUsersListQuerySchema.parse(req.query);
    const result = await service.listAdminUsers(query);
    return res.json(result);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const params = AdminUserParamsSchema.parse(req.params);
    const payload = UpdateAdminUserSchema.parse(req.body);

    if (!req.user?.id) {
      return sendError(res, 401, 'Missing token');
    }

    const result = await service.updateAdminUser({
      actorUserId: req.user.id,
      userId: params.userId,
      ...payload,
    });

    if (result.status === 'not_found') {
      return sendError(res, 404, 'User not found');
    }
    if (result.status === 'self_demotion_forbidden') {
      return sendError(res, 400, 'You cannot demote your own admin account');
    }
    if (result.status === 'last_admin_demotion_forbidden') {
      return sendError(res, 409, 'Cannot demote the last admin account');
    }
    if (result.status === 'subscription_plan_not_found') {
      return sendError(res, 404, 'Subscription plan not found');
    }

    return res.json(result.user);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

