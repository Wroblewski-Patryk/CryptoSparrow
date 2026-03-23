import { PositionSide } from '@prisma/client';
import { decideExecutionAction } from '../engine/sharedExecutionCore';

export type ReplayMarketType = 'SPOT' | 'FUTURES';
export type ReplayMarginMode = 'CROSSED' | 'ISOLATED' | 'NONE';

export type ReplayCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ReplayTradeDraft = {
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  openedAt: Date;
  closedAt: Date;
  pnl: number;
  fee: number;
  exitReason: 'SIGNAL_EXIT' | 'FINAL_CANDLE' | 'LIQUIDATION';
  liquidated: boolean;
};

export type ReplaySymbolSimulationResult = {
  trades: ReplayTradeDraft[];
  liquidations: number;
};

type ReplayRuntimeConfig = {
  longThresholdPct: number;
  shortThresholdPct: number;
  exitBandPct: number;
};

const defaultConfig: ReplayRuntimeConfig = {
  longThresholdPct: 1,
  shortThresholdPct: -1,
  exitBandPct: 0.2,
};

const toSignalDirection = (
  current: ReplayCandle,
  previous: ReplayCandle,
  config: ReplayRuntimeConfig
): 'LONG' | 'SHORT' | 'EXIT' | null => {
  const base = previous.close > 0 ? previous.close : 1;
  const changePct = ((current.close - previous.close) / base) * 100;
  if (changePct >= config.longThresholdPct) return 'LONG';
  if (changePct <= config.shortThresholdPct) return 'SHORT';
  if (Math.abs(changePct) <= config.exitBandPct) return 'EXIT';
  return null;
};

export const simulateTradesForSymbolReplay = (input: {
  symbol: string;
  candles: ReplayCandle[];
  marketType: ReplayMarketType;
  leverage: number;
  marginMode: ReplayMarginMode;
  config?: Partial<ReplayRuntimeConfig>;
}): ReplaySymbolSimulationResult => {
  const { symbol, candles, marketType, marginMode } = input;
  if (candles.length < 3) return { trades: [], liquidations: 0 };

  const config: ReplayRuntimeConfig = {
    longThresholdPct: input.config?.longThresholdPct ?? defaultConfig.longThresholdPct,
    shortThresholdPct: input.config?.shortThresholdPct ?? defaultConfig.shortThresholdPct,
    exitBandPct: input.config?.exitBandPct ?? defaultConfig.exitBandPct,
  };

  const effectiveLeverage = marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const trades: ReplayTradeDraft[] = [];
  let liquidations = 0;
  let openPosition:
    | {
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        openedAt: Date;
      }
    | null = null;

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const direction = toSignalDirection(current, previous, config);
    if (!direction) continue;

    const decision = decideExecutionAction(
      direction,
      openPosition
        ? {
            side: openPosition.side,
            quantity: openPosition.quantity,
            managementMode: 'BOT_MANAGED',
          }
        : null
    );

    if (decision.kind === 'open') {
      openPosition = {
        side: decision.positionSide,
        entryPrice: current.close,
        quantity: 1,
        openedAt: new Date(current.openTime),
      };
      continue;
    }

    if (decision.kind !== 'close' || !openPosition) {
      continue;
    }

    const fee = (openPosition.entryPrice + current.close) * 0.0004 * effectiveLeverage;
    const rawPnl =
      openPosition.side === 'LONG'
        ? (current.close - openPosition.entryPrice) * openPosition.quantity * effectiveLeverage
        : (openPosition.entryPrice - current.close) * openPosition.quantity * effectiveLeverage;

    const adverseMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8)
        : (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8);

    const isolatedLiquidationThreshold = 1 / Math.max(1, effectiveLeverage);
    const isIsolatedLiquidated =
      marketType === 'FUTURES' &&
      marginMode === 'ISOLATED' &&
      adverseMoveRatio >= isolatedLiquidationThreshold;

    if (isIsolatedLiquidated) {
      liquidations += 1;
    }

    const pnl = isIsolatedLiquidated
      ? -(openPosition.entryPrice * openPosition.quantity) / Math.max(1, effectiveLeverage)
      : rawPnl - fee;

    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: current.close,
      quantity: openPosition.quantity,
      openedAt: openPosition.openedAt,
      closedAt: new Date(current.closeTime),
      pnl,
      fee,
      exitReason: isIsolatedLiquidated ? 'LIQUIDATION' : 'SIGNAL_EXIT',
      liquidated: isIsolatedLiquidated,
    });
    openPosition = null;
  }

  if (openPosition) {
    const last = candles[candles.length - 1];
    const fee = (openPosition.entryPrice + last.close) * 0.0004 * effectiveLeverage;
    const rawPnl =
      openPosition.side === 'LONG'
        ? (last.close - openPosition.entryPrice) * openPosition.quantity * effectiveLeverage
        : (openPosition.entryPrice - last.close) * openPosition.quantity * effectiveLeverage;
    trades.push({
      symbol,
      side: openPosition.side as PositionSide,
      entryPrice: openPosition.entryPrice,
      exitPrice: last.close,
      quantity: openPosition.quantity,
      openedAt: openPosition.openedAt,
      closedAt: new Date(last.closeTime),
      pnl: rawPnl - fee,
      fee,
      exitReason: 'FINAL_CANDLE',
      liquidated: false,
    });
  }

  return { trades, liquidations };
};
