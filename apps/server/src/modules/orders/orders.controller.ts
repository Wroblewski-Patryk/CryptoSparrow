import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import { CancelOrderSchema, CloseOrderSchema, ListOrdersQuerySchema, OpenOrderSchema } from './orders.types';
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

export const openOrder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const payload = OpenOrderSchema.parse(req.body);
    const order = await ordersService.openOrder(userId, payload);
    return res.status(201).json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'LIVE_RISK_ACK_REQUIRED') {
        return sendError(res, 400, 'riskAck is required for LIVE order open');
      }
      if (error.message === 'LIVE_BOT_REQUIRED') {
        return sendError(res, 400, 'botId is required for LIVE order open');
      }
      if (error.message === 'LIVE_BOT_NOT_FOUND') {
        return sendError(res, 404, 'LIVE bot not found');
      }
      if (error.message === 'LIVE_BOT_MODE_REQUIRED') {
        return sendError(res, 400, 'bot must be in LIVE mode');
      }
      if (error.message === 'LIVE_BOT_OPT_IN_REQUIRED') {
        return sendError(res, 400, 'bot live opt-in with consent is required');
      }
      if (error.message === 'LIVE_BOT_ACTIVE_REQUIRED') {
        return sendError(res, 400, 'bot must be active for LIVE order open');
      }
    }
    return sendValidationError(res, error);
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;

  try {
    const payload = CancelOrderSchema.parse(req.body);
    const order = await ordersService.cancelOrder(userId, id, payload);
    if (!order) return sendError(res, 404, 'Not found');
    return res.json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_CANCELABLE') {
        return sendError(res, 400, 'Order cannot be canceled in current status');
      }
      if (error.message === 'ORDER_CANCEL_RISK_ACK_REQUIRED') {
        return sendError(res, 400, 'riskAck is required to cancel order');
      }
    }
    return sendValidationError(res, error);
  }
};

export const closeOrder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;

  try {
    const payload = CloseOrderSchema.parse(req.body);
    const order = await ordersService.closeOrder(userId, id, payload);
    if (!order) return sendError(res, 404, 'Not found');
    return res.json(order);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ORDER_NOT_CLOSABLE') {
        return sendError(res, 400, 'Order cannot be closed in current status');
      }
      if (error.message === 'ORDER_CLOSE_RISK_ACK_REQUIRED') {
        return sendError(res, 400, 'riskAck is required to close order');
      }
    }
    return sendValidationError(res, error);
  }
};
