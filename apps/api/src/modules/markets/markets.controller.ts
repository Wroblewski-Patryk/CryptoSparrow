import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import * as marketsService from './markets.service';
import {
  MarketCatalogQuerySchema,
  MarketUniverseCreateSchema,
  MarketUniverseUpdateSchema,
} from './markets.types';

export const listMarketCatalog = async (req: Request, res: Response) => {
  try {
    const query = MarketCatalogQuerySchema.parse(req.query);
    const catalog = await marketsService.getMarketCatalog(query.baseCurrency, query.marketType);
    return res.json(catalog);
  } catch (error) {
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
    return sendValidationError(res, error);
  }
};

export const deleteMarketUniverse = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const deleted = await marketsService.deleteUniverse(userId, id);
  if (!deleted) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};
