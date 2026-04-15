import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { mapErrorToHttpResponse } from '../../lib/httpErrorMapper';
import { CancelOrderSchema, CloseOrderSchema, ListOrdersQuerySchema, OpenOrderSchema } from './orders.types';
import * as ordersService from './orders.service';
import { ORDER_ERROR_CODES } from './orders.errors';

const handleOrderError = (res: Response, error: unknown) => {
  const mapped = mapErrorToHttpResponse(error);

  if (mapped.code === ORDER_ERROR_CODES.liveRiskAckRequired) {
    return sendError(res, 400, 'riskAck is required for LIVE order open', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveBotRequired) {
    return sendError(res, 400, 'botId is required for LIVE order open', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveBotNotFound) {
    return sendError(res, 404, 'LIVE bot not found', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveBotModeRequired) {
    return sendError(res, 400, 'bot must be in LIVE mode', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveBotOptInRequired) {
    return sendError(res, 400, 'bot live opt-in with consent is required', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveBotActiveRequired) {
    return sendError(res, 400, 'bot must be active for LIVE order open', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveApiKeyRequired) {
    return sendError(res, 400, 'Compatible API key is required for LIVE order open', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveOrderTypeUnsupported) {
    return sendError(res, 400, 'LIVE supports MARKET and LIMIT order types only', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.liveExecutionFailed) {
    return sendError(res, 502, 'LIVE exchange order placement failed', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.orderNotCancelable) {
    return sendError(res, 400, 'Order cannot be canceled in current status', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.orderCancelRiskAckRequired) {
    return sendError(res, 400, 'riskAck is required to cancel order', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.orderNotClosable) {
    return sendError(res, 400, 'Order cannot be closed in current status', mapped.details);
  }
  if (mapped.code === ORDER_ERROR_CODES.orderCloseRiskAckRequired) {
    return sendError(res, 400, 'riskAck is required to close order', mapped.details);
  }

  return sendError(res, mapped.status, mapped.message, mapped.details);
};

export const listOrders = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListOrdersQuerySchema.parse(req.query);
    const orders = await ordersService.listOrders(userId, query);
    return res.json(orders);
  } catch (error) {
    return handleOrderError(res, error);
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
    return handleOrderError(res, error);
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
    return handleOrderError(res, error);
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
    return handleOrderError(res, error);
  }
};
