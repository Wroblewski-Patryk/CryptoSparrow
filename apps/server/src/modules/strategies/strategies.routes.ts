import { Router } from 'express';
import * as strategyController from './strategies.controller';
import indicatorsRouter from './indicators/indicators.routes';
import { createRateLimiter } from '../../middleware/rateLimit';

const strategiesRouter = Router();
const tradingReadLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });
const tradingWriteLimiter = createRateLimiter({ windowMs: 60_000, max: 40 });

// Submodule - Indicators
strategiesRouter.use('/indicators', indicatorsRouter);

//Main
strategiesRouter.get('/', tradingReadLimiter, strategyController.getStrategies);
strategiesRouter.post('/import', tradingWriteLimiter, strategyController.importStrategy);
strategiesRouter.get('/:id', tradingReadLimiter, strategyController.getStrategy);
strategiesRouter.get('/:id/export', tradingReadLimiter, strategyController.exportStrategy);
strategiesRouter.post('/', tradingWriteLimiter, strategyController.createStrategy);
strategiesRouter.put('/:id', tradingWriteLimiter, strategyController.updateStrategy);
strategiesRouter.delete('/:id', tradingWriteLimiter, strategyController.deleteStrategy);



export default strategiesRouter;
