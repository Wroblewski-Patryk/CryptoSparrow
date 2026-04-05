import { Request, Response } from 'express';
import { sendError } from '../../utils/apiError';
import { sendValidationError } from '../../utils/formatZodError';
import { lookupCoinIcons } from './icons.service';
import { CoinIconLookupQuerySchema } from './icons.types';

export const lookupIcons = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return sendError(res, 401, 'Unauthorized');

  try {
    const query = CoinIconLookupQuerySchema.parse(req.query);
    const items = await lookupCoinIcons(query.symbols);
    return res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    return sendValidationError(res, error);
  }
};

