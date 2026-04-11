import { Response } from 'express';
import { sanitizeErrorMessageForClient } from './errorExposure';

type ErrorDetails = unknown;

export const sendError = (
  res: Response,
  status: number,
  message: string,
  details?: ErrorDetails
) => {
  const { message: safeMessage, redacted } = sanitizeErrorMessageForClient(status, message);

  const payload: { error: { message: string; details?: ErrorDetails } } = {
    error: { message: safeMessage },
  };

  if (details !== undefined && !redacted) {
    payload.error.details = details;
  }

  return res.status(status).json(payload);
};
