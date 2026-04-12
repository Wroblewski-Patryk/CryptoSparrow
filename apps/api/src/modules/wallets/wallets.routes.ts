import { Router } from 'express';
import { createRateLimiter } from '../../middleware/rateLimit';
import {
  createWallet,
  deleteWallet,
  getWallet,
  listWalletMetadata,
  listWallets,
  previewBalance,
  updateWallet,
} from './wallets.controller';

const walletsRouter = Router();
const walletReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const walletWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });
const walletPreviewLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyScope: 'user_exchange' });

walletsRouter.get('/', walletReadLimiter, listWallets);
walletsRouter.get('/metadata', walletReadLimiter, listWalletMetadata);
walletsRouter.post('/preview-balance', walletPreviewLimiter, previewBalance);
walletsRouter.get('/:id', walletReadLimiter, getWallet);
walletsRouter.post('/', walletWriteLimiter, createWallet);
walletsRouter.put('/:id', walletWriteLimiter, updateWallet);
walletsRouter.delete('/:id', walletWriteLimiter, deleteWallet);

export default walletsRouter;
