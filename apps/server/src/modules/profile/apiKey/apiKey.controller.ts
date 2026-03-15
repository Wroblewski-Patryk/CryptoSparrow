import { Request, Response } from 'express';
import { ZodError } from 'zod';
import * as apiKeyService from './apiKey.service';
import { apiKeySchema } from './apiKey.types';
import { formatZodError } from '../../../utils/formatZodError';
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
    if (error instanceof ZodError) {
      return sendError(res, 400, 'Validation failed', formatZodError(error));
    }
    return sendError(res, 400, 'Validation failed');
  }

  const key = await apiKeyService.createApiKey(req.user.id, req.body);
  res.status(201).json(key);
};

export const update = async (req: UserRequest, res: Response) => {
  try {
    apiKeySchema.partial().parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return sendError(res, 400, 'Validation failed', formatZodError(error));
    }
    return sendError(res, 400, 'Validation failed');
  }

  const key = await apiKeyService.updateApiKey(req.user.id, req.params.id, req.body);
  res.json(key);
};

export const remove = async (req: UserRequest, res: Response) => {
  await apiKeyService.deleteApiKey(req.user.id, req.params.id);
  res.status(204).end();
};
