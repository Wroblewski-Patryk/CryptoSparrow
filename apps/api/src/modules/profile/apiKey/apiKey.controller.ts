import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import * as apiKeyService from './apiKey.service';
import { apiKeyRotateSchema, apiKeySchema, apiKeyTestSchema } from './apiKey.types';
import { sendValidationError } from '../../../utils/formatZodError';
import { sendError } from '../../../utils/apiError';

const mapApiKeyPersistenceError = (error: unknown): { status: number; message: string } => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2003') {
      return { status: 401, message: 'Session expired. Please sign in again.' };
    }

    if (error.code === 'P2025') {
      return { status: 404, message: 'User not found.' };
    }
  }

  if (!(error instanceof Error)) return { status: 500, message: 'Internal server error' };

  if (
    error.message.includes('Missing active encryption key version') ||
    error.message.includes('Missing encryption key for version')
  ) {
    return { status: 500, message: 'API key encryption is not configured on server.' };
  }

  return { status: 500, message: 'Internal server error' };
};

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

  try {
    const key = await apiKeyService.createApiKey(userId, req.body);
    res.status(201).json(key);
  } catch (error) {
    const mapped = mapApiKeyPersistenceError(error);
    return sendError(res, mapped.status, mapped.message);
  }
};

export const update = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    apiKeySchema.partial().parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  let result: Awaited<ReturnType<typeof apiKeyService.updateApiKey>>;
  try {
    result = await apiKeyService.updateApiKey(userId, req.params.id, req.body);
  } catch (error) {
    const mapped = mapApiKeyPersistenceError(error);
    return sendError(res, mapped.status, mapped.message);
  }

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

  let result: Awaited<ReturnType<typeof apiKeyService.rotateApiKeySecretPair>>;
  try {
    result = await apiKeyService.rotateApiKeySecretPair(userId, req.params.id, req.body);
  } catch (error) {
    const mapped = mapApiKeyPersistenceError(error);
    return sendError(res, mapped.status, mapped.message);
  }

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

export const testConnection = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    apiKeyTestSchema.parse(req.body);
  } catch (error) {
    return sendValidationError(res, error);
  }

  const result = await apiKeyService.testApiKeyConnection(userId, req.body);
  return res.status(200).json(result);
};
