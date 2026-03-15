import { Response } from 'express';

type ErrorDetails = unknown;

export const sendError = (
  res: Response,
  status: number,
  message: string,
  details?: ErrorDetails
) => {
  const payload: { error: { message: string; details?: ErrorDetails } } = {
    error: { message },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return res.status(status).json(payload);
};
