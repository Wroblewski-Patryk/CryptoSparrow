import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import { livePositionReconciliationLoop } from './livePositionReconciliation.service';
import { ListPositionsQuerySchema, UpdatePositionManagementModeSchema } from './positions.types';
import * as positionsService from './positions.service';

export const listPositions = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = ListPositionsQuerySchema.parse(req.query);
    const positions = await positionsService.listPositions(userId, query);
    return res.json(positions);
  } catch (error) {
    return sendValidationError(res, error);
  }
};

export const getPosition = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const { id } = req.params;
  const position = await positionsService.getPosition(userId, id);
  if (!position) return sendError(res, 404, 'Not found');

  return res.json(position);
};

export const getLiveReconciliationStatus = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const status = livePositionReconciliationLoop.getStatus();
  return res.json({
    ...status,
    workerHeartbeatAt: process.env.WORKER_LAST_HEARTBEAT_AT ?? null,
  });
};

export const getExchangeSnapshot = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const snapshot = await positionsService.fetchExchangePositionsSnapshot(userId);
    return res.json(snapshot);
  } catch (error) {
    if (error instanceof positionsService.ExchangeSnapshotError) {
      if (error.code === 'API_KEY_NOT_FOUND') {
        return sendError(res, 400, error.message);
      }
      return sendError(res, 502, error.message);
    }
    return sendError(res, 500, 'Internal server error');
  }
};

export const getExternalTakeoverStatus = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const takeoverStatus = await positionsService.listExternalTakeoverStatuses(userId);
  return res.json(takeoverStatus);
};

export const postExternalTakeoverRebind = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  const result = await positionsService.rebindExternalTakeoverOwnership(userId);
  return res.status(200).json(result);
};

export const updatePositionManagementMode = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const body = UpdatePositionManagementModeSchema.parse(req.body);
    const updated = await positionsService.updatePositionManagementMode(
      userId,
      req.params.id,
      body.managementMode
    );

    if (!updated) return sendError(res, 404, 'Not found');
    return res.json(updated);
  } catch (error) {
    return sendValidationError(res, error);
  }
};
