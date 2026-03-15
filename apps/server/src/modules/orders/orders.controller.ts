import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import { ListOrdersQuerySchema } from './orders.types';
import * as ordersService from './orders.service';

export const listOrders = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListOrdersQuerySchema.parse(req.query);
    const orders = await ordersService.listOrders(userId, query);
    return res.json(orders);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const getOrder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const order = await ordersService.getOrder(userId, id);
  if (!order) return sendError(res, 404, 'Not found');

  return res.json(order);
};
