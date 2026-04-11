import type { QueueTuning } from '../queue/queueTuning';
import { createModuleLogger } from '../lib/logger';

type WorkerName = 'market-data' | 'backtest' | 'execution' | 'market-stream';

type WorkerBootstrapConfig = {
  workerName: WorkerName;
  heartbeatIntervalMs?: number;
  queueName?: string;
  queueTuning?: QueueTuning;
};

const workerLoggers: Record<WorkerName, ReturnType<typeof createModuleLogger>> = {
  'market-data': createModuleLogger('worker.market-data'),
  backtest: createModuleLogger('worker.backtest'),
  execution: createModuleLogger('worker.execution'),
  'market-stream': createModuleLogger('worker.market-stream'),
};

const logWorkerEvent = (worker: WorkerName, event: string, extra?: Record<string, unknown>) => {
  workerLoggers[worker].info(event, extra);
};

export const bootstrapWorker = (config: WorkerBootstrapConfig) => {
  const heartbeatIntervalMs = config.heartbeatIntervalMs ?? 15_000;
  logWorkerEvent(config.workerName, 'worker_started', {
    heartbeatIntervalMs,
    queueName: config.queueName ?? null,
    queueTuning: config.queueTuning ?? null,
  });

  setInterval(() => {
    process.env.WORKER_LAST_HEARTBEAT_AT = new Date().toISOString();
    logWorkerEvent(config.workerName, 'worker_heartbeat');
  }, heartbeatIntervalMs);
};
