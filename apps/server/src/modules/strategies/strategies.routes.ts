import { Router } from 'express';
import * as strategyController from './strategies.controller';
import indicatorsRouter from './indicators/indicators.routes';

const strategiesRouter = Router();

// Submodule - Indicators
strategiesRouter.use('/indicators', indicatorsRouter);

//Main
strategiesRouter.get('/', strategyController.getStrategies);
strategiesRouter.get('/:id', strategyController.getStrategy);
strategiesRouter.post('/', strategyController.createStrategy);
strategiesRouter.put('/:id', strategyController.updateStrategy);
strategiesRouter.delete('/:id', strategyController.deleteStrategy);



export default strategiesRouter;
