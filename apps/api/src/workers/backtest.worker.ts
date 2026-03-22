import { bootstrapWorker } from './workerBootstrap';
import { getQueueTuning } from '../queue/queueTuning';

bootstrapWorker({
  workerName: 'backtest',
  queueName: process.env.WORKER_BACKTEST_QUEUE ?? 'backtest',
  queueTuning: getQueueTuning('backtest'),
});
