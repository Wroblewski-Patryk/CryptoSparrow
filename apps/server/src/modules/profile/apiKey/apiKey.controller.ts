import { Request, Response } from 'express';
import * as apiKeyService from './apiKey.service';
import { apiKeyRotateSchema, apiKeySchema } from './apiKey.types';
import { sendValidationError } from '../../../utils/formatZodError';
import { sendError } from '../../../utils/apiError';

export const list = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const keys = await apiKeyService.listApiKeys(userId);
  res.json(keys);
};

export const create = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    apiKeySchema.parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const key = await apiKeyService.createApiKey(userId, req.body);
  res.status(201).json(key);
};

export const update = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    apiKeySchema.partial().parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const result = await apiKeyService.updateApiKey(userId, req.params.id, req.body);
  if (!result) return sendError(res, 404, 'Not found');
  res.json(result);
};

export const remove = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const deleted = await apiKeyService.deleteApiKey(userId, req.params.id);
  if (!deleted) return sendError(res, 404, 'Not found');
  res.status(204).end();
};

export const rotate = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    apiKeyRotateSchema.parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const result = await apiKeyService.rotateApiKeySecretPair(userId, req.params.id, req.body);
  if (!result) return sendError(res, 404, 'Not found');

  return res.json(result);
};

export const revoke = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const revoked = await apiKeyService.revokeApiKey(userId, req.params.id);
  if (!revoked) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};
