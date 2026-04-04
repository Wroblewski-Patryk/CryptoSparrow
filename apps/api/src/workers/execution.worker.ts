import { bootstrapWorker } from './workerBootstrap';
import { getQueueTuning } from '../queue/queueTuning';
import { livePositionReconciliationLoop } from '../modules/positions/livePositionReconciliation.service';
import { runtimeSignalLoop } from '../modules/engine/runtimeSignalLoop.service';
import { runtimeScanLoop } from '../modules/engine/runtimeScanLoop.service';
import { metricsStore } from '../observability/metrics';

const runtimeSignalLoopBootstrapIntervalMs = Math.max(
  5_000,
  Number.parseInt(process.env.RUNTIME_SIGNAL_LOOP_BOOTSTRAP_INTERVAL_MS ?? '15000', 10)
);

bootstrapWorker({
  workerName: 'execution',
  queueName: process.env.WORKER_EXECUTION_QUEUE ?? 'execution',
  queueTuning: getQueueTuning('execution'),
});

livePositionReconciliationLoop.start();
const ensureRuntimeSignalLoopStarted = async () => {
  try {
    await runtimeSignalLoop.start();
  } catch (error) {
    console.error('Execution worker failed to start runtimeSignalLoop:', error);
    metricsStore.recordRuntimeExecutionError('runtime_start_failure');
  }
};
void ensureRuntimeSignalLoopStarted();
const runtimeSignalLoopBootstrapTimer = setInterval(() => {
  if (runtimeSignalLoop.isRunning()) return;
  void ensureRuntimeSignalLoopStarted();
}, runtimeSignalLoopBootstrapIntervalMs);
runtimeSignalLoopBootstrapTimer.unref?.();
runtimeScanLoop.start();
