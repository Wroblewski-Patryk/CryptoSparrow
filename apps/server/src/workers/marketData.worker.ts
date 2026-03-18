import { bootstrapWorker } from './workerBootstrap';
import { getQueueTuning } from '../queue/queueTuning';

bootstrapWorker({
  workerName: 'market-data',
  queueName: process.env.WORKER_MARKET_DATA_QUEUE ?? 'market-data',
  queueTuning: getQueueTuning('market-data'),
});
