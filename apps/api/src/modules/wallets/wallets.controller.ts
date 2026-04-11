import { Request, Response } from 'express';
import { ExchangeNotImplementedError } from '../exchange/exchangeCapabilities';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import * as walletsService from './wallets.service';
import {
  CreateWalletSchema,
  ListWalletsQuerySchema,
  UpdateWalletSchema,
  WalletBalancePreviewSchema,
} from './wallets.types';

export const listWallets = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListWalletsQuerySchema.parse(req.query);
    const wallets = await walletsService.listWallets(userId, query);
    return res.json(wallets);
  } catch (error) {
    return sendValidationError(res, error);
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

export const createWallet = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateWalletSchema.parse(req.body);
    const created = await walletsService.createWallet(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    if (error instanceof Error && error.message === 'WALLET_LIVE_API_KEY_REQUIRED') {
      return sendError(res, 400, 'apiKeyId is required for LIVE wallet');
    }
    if (error instanceof Error && error.message === 'WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH') {
      return sendError(res, 400, 'apiKeyId exchange must match wallet exchange');
    }
    return sendValidationError(res, error);
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
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    if (error instanceof Error && error.message === 'WALLET_LIVE_API_KEY_REQUIRED') {
      return sendError(res, 400, 'apiKeyId is required for LIVE wallet');
    }
    if (error instanceof Error && error.message === 'WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH') {
      return sendError(res, 400, 'apiKeyId exchange must match wallet exchange');
    }
    return sendValidationError(res, error);
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
    if (error instanceof Error && error.message === 'WALLET_IN_USE_CANNOT_DELETE') {
      return sendError(res, 409, 'wallet is used by at least one bot and cannot be deleted');
    }
    return sendError(res, 500, 'Internal server error');
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
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    if (error instanceof Error && error.message === 'WALLET_PREVIEW_API_KEY_NOT_FOUND') {
      return sendError(res, 404, 'api key not found for selected exchange context');
    }
    if (error instanceof Error && error.message === 'WALLET_PREVIEW_FETCH_FAILED') {
      return sendError(res, 502, 'Unable to fetch exchange wallet balance preview');
    }
    return sendValidationError(res, error);
  }
};
