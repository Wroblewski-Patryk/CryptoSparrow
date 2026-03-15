import { CcxtFuturesConnector } from './ccxtFuturesConnector.service';
import { CcxtFuturesOrderResult } from './ccxtFuturesConnector.types';
import { PlaceLiveOrderInput, PlaceLiveOrderInputSchema } from './liveOrderAdapter.types';

type SleepFn = (delayMs: number) => Promise<void>;

const defaultSleep: SleepFn = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const retryableErrorPatterns = [/timeout/i, /network/i, /rate.?limit/i, /temporar/i];

const isRetryableError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return retryableErrorPatterns.some((pattern) => pattern.test(error.message));
};

export class LiveOrderAdapter {
  constructor(
    private readonly connector: CcxtFuturesConnector,
    private readonly sleep: SleepFn = defaultSleep
  ) {}

  async placeLiveOrderWithRetry(input: PlaceLiveOrderInput): Promise<CcxtFuturesOrderResult> {
    const parsed = PlaceLiveOrderInputSchema.parse(input);
    const { maxAttempts, baseDelayMs } = parsed.retryPolicy;

    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await this.connector.placeOrder(parsed.order);
      } catch (error) {
        lastError = error;
        const canRetry = attempt < maxAttempts && isRetryableError(error);
        if (!canRetry) break;

        const delay = baseDelayMs * attempt;
        await this.sleep(delay);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Live order placement failed');
  }
}

export const createLiveOrderAdapter = (connector: CcxtFuturesConnector) => {
  return new LiveOrderAdapter(connector);
};
