import { Router } from 'express';
import * as controller from './indicators.controller';

const indicatorsRouter = Router();

indicatorsRouter.route('/')
  .get((req, res) => controller.getIndicatorsController(req as any, res));

export default indicatorsRouter;
