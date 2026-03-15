import { Request, Response } from 'express';
import * as apiKeyService from './apiKey.service';
import { apiKeySchema } from './apiKey.types';
import { sendValidationError } from '../../../utils/formatZodError';
import { sendError } from '../../../utils/apiError';

type UserRequest = Request & { user: { id: string } };

export const list = async (req: UserRequest, res: Response) => {
  const keys = await apiKeyService.listApiKeys(req.user.id);
  res.json(keys);
};

export const create = async (req: UserRequest, res: Response) => {
  try {
    apiKeySchema.parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const key = await apiKeyService.createApiKey(req.user.id, req.body);
  res.status(201).json(key);
};

export const update = async (req: UserRequest, res: Response) => {
  try {
    apiKeySchema.partial().parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const result = await apiKeyService.updateApiKey(req.user.id, req.params.id, req.body);
  if (!result) return sendError(res, 404, 'Not found');
  res.json(result);
};

export const remove = async (req: UserRequest, res: Response) => {
  const deleted = await apiKeyService.deleteApiKey(req.user.id, req.params.id);
  if (!deleted) return sendError(res, 404, 'Not found');
  res.status(204).end();
};
