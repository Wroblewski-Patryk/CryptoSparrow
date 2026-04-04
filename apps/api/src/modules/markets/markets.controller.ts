import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import { ExchangeNotImplementedError } from '../exchange/exchangeCapabilities';
import * as marketsService from './markets.service';
import {
  MarketCatalogQuerySchema,
  MarketUniverseCreateSchema,
  MarketUniverseUpdateSchema,
} from './markets.types';

export const listMarketCatalog = async (req: Request, res: Response) => {
  try {
    const query = MarketCatalogQuerySchema.parse(req.query);
    const catalog = await marketsService.getMarketCatalog(query.baseCurrency, query.marketType, query.exchange);
    return res.json(catalog);
  } catch (error) {
    if (error instanceof ExchangeNotImplementedError) {
      return sendError(res, error.status, error.message, error.toDetails());
    }
    return sendValidationError(res, error);
  }
};

export const listMarketUniverses = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const universes = await marketsService.listUniverses(userId);
  return res.json(universes);
};

export const getMarketUniverse = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const universe = await marketsService.getUniverse(userId, id);
  if (!universe) return sendError(res, 404, 'Not found');

  return res.json(universe);
};

export const createMarketUniverse = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = MarketUniverseCreateSchema.parse(req.body);
    const created = await marketsService.createUniverse(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const updateMarketUniverse = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = MarketUniverseUpdateSchema.parse(req.body);
    const { id } = req.params;
    const updated = await marketsService.updateUniverse(userId, id, payload);
    if (!updated) return sendError(res, 404, 'Not found');

    return res.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'MARKET_UNIVERSE_USED_BY_ACTIVE_BOT') {
      return sendError(res, 409, 'market universe is used by active bot and cannot be edited');
    }
    return sendValidationError(res, error);
  }
};

export const deleteMarketUniverse = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const { id } = req.params;
    const deleted = await marketsService.deleteUniverse(userId, id);
    if (!deleted) return sendError(res, 404, 'Not found');

    return res.status(204).end();
  } catch (error) {
    if (error instanceof Error && error.message === 'MARKET_UNIVERSE_USED_BY_ACTIVE_BOT') {
      return sendError(res, 409, 'market universe is used by active bot and cannot be deleted');
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2003', 'P2014', 'P2025', 'P2022'].includes(error.code)
    ) {
      return sendError(res, 409, 'market universe has linked records and cannot be deleted');
    }
    return sendError(res, 500, 'Internal server error');
  }
};
