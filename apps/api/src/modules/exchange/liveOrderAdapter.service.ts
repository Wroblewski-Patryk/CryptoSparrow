import { CcxtFuturesConnector } from './ccxtFuturesConnector.service';
import { CcxtFuturesOrderResult } from './ccxtFuturesConnector.types';
import { reconcileLiveOrderFee } from './liveFeeReconciliation.service';
import {
  PlaceLiveOrderInput,
  PlaceLiveOrderInputSchema,
  PlaceLiveOrderWithFeesResult,
} from './liveOrderAdapter.types';
import { metricsStore } from '../../observability/metrics';

type SleepFn = (delayMs: number) => Promise<void>;
type LogLevel = 'info' | 'warn' | 'error';
type ExchangeLogPayload = {
  event: string;
  attempt?: number;
  maxAttempts?: number;
  symbol?: string;
  orderType?: string;
  side?: string;
  delayMs?: number;
  error?: string;
};

type ExchangeLogger = {
  info: (payload: ExchangeLogPayload) => void;
  warn: (payload: ExchangeLogPayload) => void;
  error: (payload: ExchangeLogPayload) => void;
};

const defaultSleep: SleepFn = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const emitDefaultLog = (level: LogLevel, payload: ExchangeLogPayload) => {
  if (process.env.NODE_ENV === 'test') return;

  const entry = {
    level,
    module: 'exchange.live-order-adapter',
    timestamp: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(entry));
};

const defaultExchangeLogger: ExchangeLogger = {
  info: (payload) => emitDefaultLog('info', payload),
  warn: (payload) => emitDefaultLog('warn', payload),
  error: (payload) => emitDefaultLog('error', payload),
};

const retryableErrorPatterns = [/timeout/i, /network/i, /rate.?limit/i, /temporar/i];

const isRetryableError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return retryableErrorPatterns.some((pattern) => pattern.test(error.message));
};

export class LiveOrderAdapter {
  constructor(
    private readonly connector: CcxtFuturesConnector,
    private readonly sleep: SleepFn = defaultSleep,
    private readonly logger: ExchangeLogger = defaultExchangeLogger
  ) {}

  async placeLiveOrderWithRetry(input: PlaceLiveOrderInput): Promise<CcxtFuturesOrderResult> {
    const parsed = PlaceLiveOrderInputSchema.parse(input);
    const { maxAttempts, baseDelayMs } = parsed.retryPolicy;

    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      attempt += 1;
      metricsStore.recordExchangeOrderAttempt();
      try {
        const result = await this.connector.placeOrder(parsed.order);
        this.logger.info({
          event: 'exchange.live_order.success',
          attempt,
          maxAttempts,
          symbol: parsed.order.symbol,
          orderType: parsed.order.type,
          side: parsed.order.side,
        });
        return result;
      } catch (error) {
        lastError = error;
        const retryable = isRetryableError(error);
        const canRetry = attempt < maxAttempts && retryable;
        if (!canRetry) {
          metricsStore.recordExchangeOrderFailure();
          metricsStore.recordRuntimeExecutionError(
            retryable ? 'live_order_retry_exhausted' : 'live_order_non_retryable'
          );
          this.logger.error({
            event: 'exchange.live_order.failed',
            attempt,
            maxAttempts,
            symbol: parsed.order.symbol,
            orderType: parsed.order.type,
            side: parsed.order.side,
            error: error instanceof Error ? error.message : 'unknown_error',
          });
          break;
        }

        const delay = baseDelayMs * attempt;
        metricsStore.recordExchangeOrderRetry();
        this.logger.warn({
          event: 'exchange.live_order.retry',
          attempt,
          maxAttempts,
          symbol: parsed.order.symbol,
          orderType: parsed.order.type,
          side: parsed.order.side,
          delayMs: delay,
          error: error instanceof Error ? error.message : 'unknown_error',
        });
        await this.sleep(delay);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Live order placement failed');
  }

  async placeLiveOrderWithFees(input: PlaceLiveOrderInput): Promise<PlaceLiveOrderWithFeesResult> {
    const parsed = PlaceLiveOrderInputSchema.parse(input);
    const orderResult = await this.placeLiveOrderWithRetry(parsed);
    const reconciliationStartedAt = Date.now();
    const feeReconciliation = await reconcileLiveOrderFee(this.connector, {
      symbol: parsed.order.symbol,
      exchangeOrderId: orderResult.id || null,
      inlineFills: orderResult.fills ?? [],
    });
    metricsStore.recordRuntimeReconciliationDelay(
      Date.now() - reconciliationStartedAt,
      feeReconciliation.feePending
    );

    return {
      exchangeOrderId: orderResult.id || null,
      status: orderResult.status,
      fee: feeReconciliation.fee,
      feeSource: feeReconciliation.feeSource,
      feePending: feeReconciliation.feePending,
      feeCurrency: feeReconciliation.feeCurrency,
      effectiveFeeRate: feeReconciliation.effectiveFeeRate,
      exchangeTradeId: feeReconciliation.exchangeTradeId,
      fills: feeReconciliation.fills,
      rawOrderStatus: orderResult.status,
    };
  }
}

export const createLiveOrderAdapter = (connector: CcxtFuturesConnector) => {
  return new LiveOrderAdapter(connector);
};
