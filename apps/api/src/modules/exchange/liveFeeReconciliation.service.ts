import { CcxtFuturesConnector } from './ccxtFuturesConnector.service';
import { CcxtFuturesOrderFill } from './ccxtFuturesConnector.types';

type LiveFeeReconciliationInput = {
  symbol: string;
  exchangeOrderId: string | null;
  inlineFills?: CcxtFuturesOrderFill[];
  nowMs?: number;
};

export type LiveFeeReconciliationResult = {
  fee: number | null;
  feeSource: 'ESTIMATED' | 'EXCHANGE_FILL';
  feePending: boolean;
  feeCurrency: string | null;
  effectiveFeeRate: number | null;
  exchangeTradeId: string | null;
  fills: CcxtFuturesOrderFill[];
};

const hasFeeData = (fills: CcxtFuturesOrderFill[]) =>
  fills.some((fill) => typeof fill.feeCost === 'number' && Number.isFinite(fill.feeCost));

const dedupeFills = (fills: CcxtFuturesOrderFill[]) => {
  const seen = new Set<string>();
  const output: CcxtFuturesOrderFill[] = [];

  for (const fill of fills) {
    const key = [
      fill.exchangeTradeId ?? '-',
      fill.exchangeOrderId ?? '-',
      fill.symbol,
      fill.price,
      fill.quantity,
      fill.executedAt?.toISOString() ?? '-',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(fill);
  }

  return output;
};

const summarizeFills = (fills: CcxtFuturesOrderFill[]): LiveFeeReconciliationResult => {
  const unique = dedupeFills(fills);
  const hasAnyFee = hasFeeData(unique);
  const feeTotal = hasAnyFee
    ? unique.reduce(
        (sum, fill) => sum + (typeof fill.feeCost === 'number' && Number.isFinite(fill.feeCost) ? fill.feeCost : 0),
        0
      )
    : null;
  const notional = unique.reduce((sum, fill) => sum + (Number.isFinite(fill.notional) ? fill.notional : 0), 0);
  const currencies = Array.from(new Set(unique.map((fill) => fill.feeCurrency).filter((v): v is string => !!v)));

  return {
    fee: feeTotal,
    feeSource: hasAnyFee ? 'EXCHANGE_FILL' : 'ESTIMATED',
    feePending: !hasAnyFee,
    feeCurrency: currencies.length === 1 ? currencies[0] : null,
    effectiveFeeRate:
      hasAnyFee && typeof feeTotal === 'number' && Number.isFinite(feeTotal) && notional > 0
        ? feeTotal / notional
        : null,
    exchangeTradeId: unique.find((fill) => fill.exchangeTradeId)?.exchangeTradeId ?? null,
    fills: unique,
  };
};

export const reconcileLiveOrderFee = async (
  connector: CcxtFuturesConnector,
  input: LiveFeeReconciliationInput
): Promise<LiveFeeReconciliationResult> => {
  const symbol = input.symbol.toUpperCase();
  const orderId = input.exchangeOrderId;
  const nowMs = input.nowMs ?? Date.now();

  const collected: CcxtFuturesOrderFill[] = [...(input.inlineFills ?? [])];

  const tryFetchOrder = async () => {
    if (!orderId) return;
    try {
      const snapshot = await connector.fetchOrderWithFills({ symbol, orderId });
      collected.push(...snapshot.fills);
    } catch {
      // Best-effort reconciliation: do not fail execution path.
    }
  };

  const tryFetchTrades = async () => {
    if (!orderId) return;
    try {
      const trades = await connector.fetchTradesForOrder({
        symbol,
        orderId,
        since: nowMs - 30 * 60_000,
        limit: 300,
      });
      collected.push(...trades);
    } catch {
      // Best-effort reconciliation: do not fail execution path.
    }
  };

  if (!hasFeeData(collected)) {
    await tryFetchOrder();
  }
  if (!hasFeeData(collected)) {
    await tryFetchTrades();
  }

  if (collected.length === 0) {
    return {
      fee: null,
      feeSource: 'ESTIMATED',
      feePending: true,
      feeCurrency: null,
      effectiveFeeRate: null,
      exchangeTradeId: null,
      fills: [],
    };
  }

  return summarizeFills(collected);
};
