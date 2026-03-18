import { bootstrapWorker } from './workerBootstrap';
import { getQueueTuning } from '../queue/queueTuning';

bootstrapWorker({
  workerName: 'execution',
  queueName: process.env.WORKER_EXECUTION_QUEUE ?? 'execution',
  queueTuning: getQueueTuning('execution'),
});
