import type { QueueTuning } from '../queue/queueTuning';
type WorkerName = 'market-data' | 'backtest' | 'execution' | 'market-stream';

type WorkerBootstrapConfig = {
  workerName: WorkerName;
  heartbeatIntervalMs?: number;
  queueName?: string;
  queueTuning?: QueueTuning;
};

const logWorkerEvent = (worker: WorkerName, event: string, extra?: Record<string, unknown>) => {
  if (process.env.NODE_ENV === 'test') return;
  console.log(
    JSON.stringify({
      level: 'info',
      module: `worker.${worker}`,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    })
  );
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
