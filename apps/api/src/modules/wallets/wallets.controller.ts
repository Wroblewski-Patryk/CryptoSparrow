import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { mapErrorToHttpResponse } from '../../lib/httpErrorMapper';
import * as walletsService from './wallets.service';
import {
  CreateWalletSchema,
  ListWalletsQuerySchema,
  UpdateWalletSchema,
  WalletBalancePreviewSchema,
  WalletMetadataQuerySchema,
} from './wallets.types';
import { WALLET_ERROR_CODES } from './wallets.errors';

const handleWalletError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.code === WALLET_ERROR_CODES.liveApiKeyRequired) {
    return sendError(res, 400, 'apiKeyId is required for LIVE wallet', mapped.details);
  }
  if (mapped.code === WALLET_ERROR_CODES.liveApiKeyExchangeMismatch) {
    return sendError(res, 400, 'apiKeyId exchange must match wallet exchange', mapped.details);
  }
  if (mapped.code === WALLET_ERROR_CODES.inUseCannotDelete) {
    return sendError(res, 409, 'wallet is used by at least one bot and cannot be deleted', mapped.details);
  }
  if (mapped.code === WALLET_ERROR_CODES.previewApiKeyNotFound) {
    return sendError(res, 404, 'api key not found for selected exchange context', mapped.details);
  }
  if (mapped.code === WALLET_ERROR_CODES.previewFetchFailed) {
    return sendError(res, 502, 'Unable to fetch exchange wallet balance preview', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

export const listWallets = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListWalletsQuerySchema.parse(req.query);
    const wallets = await walletsService.listWallets(userId, query);
    return res.json(wallets);
  } catch (error) {
    return handleWalletError(res, error);
  }
};

export const getWallet = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const wallet = await walletsService.getWallet(userId, id);
  if (!wallet) return sendError(res, 404, 'Not found');

  return res.json(wallet);
};

export const listWalletMetadata = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = WalletMetadataQuerySchema.parse(req.query);
    const metadata = await walletsService.getWalletMetadata(query);
    return res.json(metadata);
  } catch (error) {
    return handleWalletError(res, error);
  }
};

export const createWallet = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateWalletSchema.parse(req.body);
    const created = await walletsService.createWallet(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    return handleWalletError(res, error);
  }
};

export const updateWallet = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpdateWalletSchema.parse(req.body);
    const { id } = req.params;
    const updated = await walletsService.updateWallet(userId, id, payload);
    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    return handleWalletError(res, error);
  }
};

export const deleteWallet = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const { id } = req.params;
    const deleted = await walletsService.deleteWallet(userId, id);
    if (!deleted) return sendError(res, 404, 'Not found');
    return res.status(204).end();
  } catch (error) {
    return handleWalletError(res, error);
  }
};

export const previewBalance = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = WalletBalancePreviewSchema.parse(req.body);
    const preview = await walletsService.previewWalletBalance(userId, payload);
    return res.status(200).json(preview);
  } catch (error) {
    return handleWalletError(res, error);
  }
};
