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

export type ReplayEventType = 'ENTRY' | 'EXIT' | 'DCA' | 'TP' | 'SL' | 'TRAILING' | 'LIQUIDATION';

export type ReplayEventDraft = {
  symbol: string;
  type: ReplayEventType;
  side: PositionSide;
  timestamp: Date;
  price: number;
  pnl: number | null;
  tradeSequence: number;
  candleIndex: number;
};

export type ReplaySymbolSimulationResult = {
  trades: ReplayTradeDraft[];
  liquidations: number;
  events: ReplayEventDraft[];
  eventCounts: Record<ReplayEventType, number>;
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

const takeProfitPct = 0.012;
const stopLossPct = 0.01;
const trailingStopPct = 0.0075;
const dcaStepPct = 0.008;
const maxDcaPerTrade = 1;

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
  const initialEventCounts: Record<ReplayEventType, number> = {
    ENTRY: 0,
    EXIT: 0,
    DCA: 0,
    TP: 0,
    SL: 0,
    TRAILING: 0,
    LIQUIDATION: 0,
  };
  if (candles.length < 3) return { trades: [], liquidations: 0, events: [], eventCounts: initialEventCounts };

  const config: ReplayRuntimeConfig = {
    longThresholdPct: input.config?.longThresholdPct ?? defaultConfig.longThresholdPct,
    shortThresholdPct: input.config?.shortThresholdPct ?? defaultConfig.shortThresholdPct,
    exitBandPct: input.config?.exitBandPct ?? defaultConfig.exitBandPct,
  };

  const effectiveLeverage = marketType === 'SPOT' ? 1 : Math.max(1, input.leverage);
  const trades: ReplayTradeDraft[] = [];
  const events: ReplayEventDraft[] = [];
  const eventCounts: Record<ReplayEventType, number> = { ...initialEventCounts };
  let liquidations = 0;
  let tradeSequence = 0;
  let openPosition:
    | {
        side: 'LONG' | 'SHORT';
        entryPrice: number;
        quantity: number;
        openedAt: Date;
        dcaCount: number;
        bestPrice: number;
      }
    | null = null;

  const pushEvent = (
    type: ReplayEventType,
    side: PositionSide,
    timestamp: Date,
    price: number,
    pnl: number | null,
    candleIndex: number,
    sequence: number,
  ) => {
    events.push({
      symbol,
      type,
      side,
      timestamp,
      price,
      pnl,
      candleIndex,
      tradeSequence: sequence,
    });
    eventCounts[type] += 1;
  };

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
      tradeSequence += 1;
      openPosition = {
        side: decision.positionSide,
        entryPrice: current.close,
        quantity: 1,
        openedAt: new Date(current.openTime),
        dcaCount: 0,
        bestPrice: current.close,
      };
      pushEvent('ENTRY', decision.positionSide as PositionSide, new Date(current.openTime), current.close, null, index, tradeSequence);
      continue;
    }

    if (!openPosition) {
      continue;
    }

    if (openPosition.side === 'LONG') {
      openPosition.bestPrice = Math.max(openPosition.bestPrice, current.high);
    } else {
      openPosition.bestPrice = Math.min(openPosition.bestPrice, current.low);
    }

    const adverseMoveRatioForDca =
      openPosition.side === 'LONG'
        ? (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8)
        : (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8);

    if (openPosition.dcaCount < maxDcaPerTrade && adverseMoveRatioForDca >= dcaStepPct) {
      const previousQty = openPosition.quantity;
      const addedQty = 1;
      openPosition.quantity = previousQty + addedQty;
      openPosition.entryPrice =
        (openPosition.entryPrice * previousQty + current.close * addedQty) / openPosition.quantity;
      openPosition.dcaCount += 1;
      pushEvent('DCA', openPosition.side as PositionSide, new Date(current.openTime), current.close, null, index, tradeSequence);
    }

    const favorableMoveRatio =
      openPosition.side === 'LONG'
        ? (current.close - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - current.close) / Math.max(openPosition.entryPrice, 1e-8);
    const peakFavorableMoveRatio =
      openPosition.side === 'LONG'
        ? (openPosition.bestPrice - openPosition.entryPrice) / Math.max(openPosition.entryPrice, 1e-8)
        : (openPosition.entryPrice - openPosition.bestPrice) / Math.max(openPosition.entryPrice, 1e-8);

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

    const isTakeProfit = favorableMoveRatio >= takeProfitPct;
    const isStopLoss = adverseMoveRatio >= stopLossPct;
    const trailingActive = peakFavorableMoveRatio >= takeProfitPct * 0.5;
    const isTrailingExit = trailingActive
      ? openPosition.side === 'LONG'
        ? current.close <= openPosition.bestPrice * (1 - trailingStopPct)
        : current.close >= openPosition.bestPrice * (1 + trailingStopPct)
      : false;

    const shouldSignalExit = decision.kind === 'close';

    if (!isIsolatedLiquidated && !isTakeProfit && !isStopLoss && !isTrailingExit && !shouldSignalExit) {
      continue;
    }

    if (isIsolatedLiquidated) {
      liquidations += 1;
    }

    const pnl = isIsolatedLiquidated
      ? -(openPosition.entryPrice * openPosition.quantity) / Math.max(1, effectiveLeverage)
      : rawPnl - fee;

    const closeType: ReplayEventType = isIsolatedLiquidated
      ? 'LIQUIDATION'
      : isTakeProfit
        ? 'TP'
        : isStopLoss
          ? 'SL'
          : isTrailingExit
            ? 'TRAILING'
            : 'EXIT';

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
    pushEvent(
      closeType,
      openPosition.side as PositionSide,
      new Date(current.closeTime),
      current.close,
      pnl,
      index,
      tradeSequence
    );
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
    pushEvent(
      'EXIT',
      openPosition.side as PositionSide,
      new Date(last.closeTime),
      last.close,
      rawPnl - fee,
      candles.length - 1,
      tradeSequence
    );
  }

  return { trades, liquidations, events, eventCounts };
};
