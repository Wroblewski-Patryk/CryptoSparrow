import { bootstrapWorker } from './workerBootstrap';
import { getQueueTuning } from '../queue/queueTuning';
import { livePositionReconciliationLoop } from '../modules/positions/livePositionReconciliation.service';

bootstrapWorker({
  workerName: 'execution',
  queueName: process.env.WORKER_EXECUTION_QUEUE ?? 'execution',
  queueTuning: getQueueTuning('execution'),
});

livePositionReconciliationLoop.start();
