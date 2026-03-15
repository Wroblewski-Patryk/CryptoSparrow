import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import * as botsService from './bots.service';
import { CreateBotSchema, UpdateBotSchema } from './bots.types';

export const listBots = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const bots = await botsService.listBots(userId);
  return res.json(bots);
};

export const getBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const bot = await botsService.getBot(userId, id);
  if (!bot) return sendError(res, 404, 'Not found');

  return res.json(bot);
};

export const createBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = CreateBotSchema.parse(req.body);
    const created = await botsService.createBot(userId, payload);
    return res.status(201).json(created);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const updateBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = UpdateBotSchema.parse(req.body);
    const { id } = req.params;
    const updated = await botsService.updateBot(userId, id, payload);
    if (!updated) return sendError(res, 404, 'Not found');

    return res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const deleteBot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const deleted = await botsService.deleteBot(userId, id);
  if (!deleted) return sendError(res, 404, 'Not found');

  return res.status(204).end();
};
