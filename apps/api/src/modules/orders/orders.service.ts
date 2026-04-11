import { Exchange, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { CancelOrderDto, CloseOrderDto, ListOrdersQuery, OpenOrderDto } from './orders.types';
import { decrypt } from '../../utils/crypto';
import { CcxtFuturesConnector } from '../exchange/ccxtFuturesConnector.service';
import { createLiveOrderAdapter } from '../exchange/liveOrderAdapter.service';
import { CcxtFuturesOrderFill } from '../exchange/ccxtFuturesConnector.types';
import { parsePositiveInt } from '../../lib/env';

export const listOrders = async (userId: string, query: ListOrdersQuery) => {
  const skip = (query.page - 1) * query.limit;
  const where = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
  };

  return prisma.order.findMany({
    where,
    skip,
    take: query.limit,
    orderBy: { createdAt: 'desc' },
  });
};

export const getOrder = async (userId: string, id: string) => {
  return prisma.order.findFirst({
    where: { id, userId },
  });
};

type LiveBotContext = {
  id: string;
  exchange: Exchange;
  marketType: 'FUTURES' | 'SPOT';
  positionMode: 'ONE_WAY' | 'HEDGE';
  apiKeyId: string | null;
};

type LiveExecutionResult = {
  exchangeOrderId: string | null;
  status: 'OPEN' | 'FILLED';
  fee?: number | null;
  feeSource?: 'ESTIMATED' | 'EXCHANGE_FILL';
  feePending?: boolean;
  feeCurrency?: string | null;
  effectiveFeeRate?: number | null;
  exchangeTradeId?: string | null;
  fills?: CcxtFuturesOrderFill[];
};

type OpenOrderDeps = {
  executeLiveOrder: (params: {
    userId: string;
    bot: LiveBotContext;
    payload: OpenOrderDto;
  }) => Promise<LiveExecutionResult>;
};

const mapLiveOrderType = (type: OpenOrderDto['type']) => {
  if (type === 'MARKET') return 'market' as const;
  if (type === 'LIMIT') return 'limit' as const;
  throw new Error('LIVE_ORDER_TYPE_UNSUPPORTED');
};

const mapLiveOrderStatus = (status: string | undefined, fallbackType: OpenOrderDto['type']) => {
  if (status) {
    const normalized = status.toLowerCase();
    if (normalized.includes('filled') || normalized.includes('closed')) return 'FILLED' as const;
  }
  return fallbackType === 'MARKET' ? ('FILLED' as const) : ('OPEN' as const);
};

type SymbolTradingRules = {
  minAmount: number | null;
  minNotional: number | null;
  amountPrecision: number | null;
};

type CachedRules = {
  expiresAtMs: number;
  rules: SymbolTradingRules;
};

type CachedExposure = {
  expiresAtMs: number;
  hasOpenPosition: boolean;
};

const symbolRulesCache = new Map<string, CachedRules>();
const symbolExposureCache = new Map<string, CachedExposure>();
const liveMarginLeverageConvergenceCache = new Map<string, { expiresAtMs: number }>();

const parseBoolean = (raw: string | undefined, fallback: boolean) => {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const parseMarginMode = (raw: string | undefined): 'cross' | 'isolated' | null => {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'cross' || normalized === 'crossed') return 'cross';
  if (normalized === 'isolated' || normalized === 'isolate') return 'isolated';
  return null;
};

const RULES_CACHE_TTL_MS = parsePositiveInt(process.env.LIVE_PRETRADE_RULES_CACHE_TTL_MS, 5 * 60_000);
const EXPOSURE_CACHE_TTL_MS = parsePositiveInt(
  process.env.LIVE_PRETRADE_EXPOSURE_CACHE_TTL_MS,
  5_000
);
const LIVE_CONVERGENCE_CACHE_TTL_MS = parsePositiveInt(
  process.env.LIVE_PRETRADE_MARGIN_LEVERAGE_CACHE_TTL_MS,
  6 * 60 * 60_000
);
const LIVE_CONVERGENCE_ENABLED = parseBoolean(
  process.env.LIVE_PRETRADE_MARGIN_LEVERAGE_CONVERGENCE_ENABLED,
  true
);
const LIVE_CONVERGENCE_STRICT = parseBoolean(
  process.env.LIVE_PRETRADE_MARGIN_LEVERAGE_CONVERGENCE_STRICT,
  false
);
const LIVE_TARGET_MARGIN_MODE = parseMarginMode(process.env.LIVE_PRETRADE_MARGIN_MODE);

const getRulesCacheKey = (params: {
  exchange: Exchange;
  marketType: 'FUTURES' | 'SPOT';
  symbol: string;
}) => `${params.exchange}:${params.marketType}:${params.symbol.toUpperCase()}`;

const getExposureCacheKey = (params: {
  apiKeyId: string;
  symbol: string;
}) => `${params.apiKeyId}:${params.symbol.toUpperCase()}`;

const getLiveConvergenceCacheKey = (params: {
  apiKeyId: string;
  symbol: string;
  leverage: number | null;
  marginMode: 'cross' | 'isolated' | null;
}) =>
  `${params.apiKeyId}:${params.symbol.toUpperCase()}:${params.leverage ?? 'na'}:${params.marginMode ?? 'na'}`;

const normalizeAmountByPrecision = (value: number, precision: number | null) => {
  if (!Number.isFinite(value)) return value;
  if (precision == null || !Number.isFinite(precision)) return value;
  if (precision >= 1) {
    const factor = 10 ** Math.trunc(precision);
    return Math.round(value * factor) / factor;
  }
  if (precision > 0 && precision < 1) {
    const steps = Math.round(value / precision);
    return steps * precision;
  }
  return value;
};

const approxGreaterThan = (left: number, right: number, eps = 1e-12) => left - right > eps;
const approxLessThan = (left: number, right: number, eps = 1e-12) => right - left > eps;

const ensureLiveOrderAllowed = async (
  userId: string,
  payload: OpenOrderDto
): Promise<LiveBotContext | null> => {
  if (payload.mode !== 'LIVE') return null;
  if (!payload.riskAck) {
    throw new Error('LIVE_RISK_ACK_REQUIRED');
  }
  if (!payload.botId) {
    throw new Error('LIVE_BOT_REQUIRED');
  }

  const bot = await prisma.bot.findFirst({
    where: { id: payload.botId, userId },
    select: {
      id: true,
      mode: true,
      exchange: true,
      marketType: true,
      positionMode: true,
      apiKeyId: true,
      liveOptIn: true,
      isActive: true,
      consentTextVersion: true,
    },
  });

  if (!bot) throw new Error('LIVE_BOT_NOT_FOUND');
  if (bot.mode !== 'LIVE') throw new Error('LIVE_BOT_MODE_REQUIRED');
  if (!bot.liveOptIn || !bot.consentTextVersion) throw new Error('LIVE_BOT_OPT_IN_REQUIRED');
  if (!bot.isActive) throw new Error('LIVE_BOT_ACTIVE_REQUIRED');

  return {
    id: bot.id,
    exchange: bot.exchange,
    marketType: bot.marketType,
    positionMode: bot.positionMode,
    apiKeyId: bot.apiKeyId,
  };
};

type LiveExecutionApiKey = {
  id: string;
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
};

export const resolveLiveExecutionApiKey = async (params: {
  userId: string;
  bot: Pick<LiveBotContext, 'exchange' | 'apiKeyId'>;
}): Promise<LiveExecutionApiKey> => {
  if (params.bot.apiKeyId) {
    const botBoundApiKey = await prisma.apiKey.findFirst({
      where: { id: params.bot.apiKeyId, userId: params.userId },
      select: {
        id: true,
        exchange: true,
        apiKey: true,
        apiSecret: true,
      },
    });

    if (botBoundApiKey && botBoundApiKey.exchange === params.bot.exchange) {
      return botBoundApiKey;
    }
  }

  const fallbackApiKey = await prisma.apiKey.findFirst({
    where: {
      userId: params.userId,
      exchange: params.bot.exchange,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      exchange: true,
      apiKey: true,
      apiSecret: true,
    },
  });

  if (!fallbackApiKey) {
    throw new Error('LIVE_API_KEY_REQUIRED');
  }

  return fallbackApiKey;
};

const getSymbolTradingRulesCached = async (params: {
  connector: CcxtFuturesConnector;
  exchange: Exchange;
  marketType: 'FUTURES' | 'SPOT';
  symbol: string;
}) => {
  const cacheKey = getRulesCacheKey({
    exchange: params.exchange,
    marketType: params.marketType,
    symbol: params.symbol,
  });
  const nowMs = Date.now();
  const cached = symbolRulesCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.rules;
  }

  const rules = await params.connector.getSymbolTradingRules(params.symbol);
  symbolRulesCache.set(cacheKey, {
    expiresAtMs: nowMs + RULES_CACHE_TTL_MS,
    rules,
  });
  return rules;
};

const hasOpenExposureCached = async (params: {
  connector: CcxtFuturesConnector;
  apiKeyId: string;
  symbol: string;
}) => {
  const cacheKey = getExposureCacheKey({
    apiKeyId: params.apiKeyId,
    symbol: params.symbol,
  });
  const nowMs = Date.now();
  const cached = symbolExposureCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.hasOpenPosition;
  }

  const hasOpenPosition = await params.connector.hasOpenPosition(params.symbol);
  symbolExposureCache.set(cacheKey, {
    expiresAtMs: nowMs + EXPOSURE_CACHE_TTL_MS,
    hasOpenPosition,
  });
  return hasOpenPosition;
};

const resolveLiveTargetLeverage = async (params: {
  userId: string;
  marketType: 'FUTURES' | 'SPOT';
  payload: OpenOrderDto;
}): Promise<number | null> => {
  if (params.marketType !== 'FUTURES') return null;
  if (!params.payload.strategyId) return null;

  const strategy = await prisma.strategy.findFirst({
    where: {
      id: params.payload.strategyId,
      userId: params.userId,
    },
    select: {
      leverage: true,
    },
  });

  if (!strategy || !Number.isFinite(strategy.leverage)) return null;
  return Math.max(1, Math.floor(strategy.leverage));
};

const convergeLiveMarginAndLeverageIfNeeded = async (params: {
  connector: CcxtFuturesConnector;
  apiKeyId: string;
  symbol: string;
  targetLeverage: number | null;
}) => {
  if (!LIVE_CONVERGENCE_ENABLED) return;
  if (params.targetLeverage == null && LIVE_TARGET_MARGIN_MODE == null) return;

  const cacheKey = getLiveConvergenceCacheKey({
    apiKeyId: params.apiKeyId,
    symbol: params.symbol,
    leverage: params.targetLeverage,
    marginMode: LIVE_TARGET_MARGIN_MODE,
  });
  const nowMs = Date.now();
  const cached = liveMarginLeverageConvergenceCache.get(cacheKey);
  if (cached && cached.expiresAtMs > nowMs) {
    return;
  }

  try {
    await params.connector.convergeFuturesLeverageAndMargin({
      symbol: params.symbol,
      leverage: params.targetLeverage,
      marginMode: LIVE_TARGET_MARGIN_MODE,
    });
    liveMarginLeverageConvergenceCache.set(cacheKey, {
      expiresAtMs: nowMs + LIVE_CONVERGENCE_CACHE_TTL_MS,
    });
  } catch (error) {
    if (LIVE_CONVERGENCE_STRICT) {
      throw new Error('LIVE_PRETRADE_MARGIN_LEVERAGE_CONVERGENCE_FAILED');
    }
    const message = error instanceof Error ? error.message : 'unknown_error';
    console.warn(
      `[OrdersService] live_margin_leverage_convergence_failed symbol=${params.symbol} apiKey=${params.apiKeyId} error=${message}`
    );
  }
};

const enforceLivePretradeGuards = async (params: {
  connector: CcxtFuturesConnector;
  apiKeyId: string;
  exchange: Exchange;
  marketType: 'FUTURES' | 'SPOT';
  payload: OpenOrderDto;
}) => {
  const normalizedSymbol = params.payload.symbol.toUpperCase();
  const quantity = Number(params.payload.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('LIVE_PRETRADE_INVALID_QUANTITY');
  }

  const hasExposure = await hasOpenExposureCached({
    connector: params.connector,
    apiKeyId: params.apiKeyId,
    symbol: normalizedSymbol,
  });
  if (hasExposure) {
    throw new Error('LIVE_PRETRADE_EXTERNAL_POSITION_OPEN');
  }

  const rules = await getSymbolTradingRulesCached({
    connector: params.connector,
    exchange: params.exchange,
    marketType: params.marketType,
    symbol: normalizedSymbol,
  });

  if (typeof rules.minAmount === 'number' && approxLessThan(quantity, rules.minAmount)) {
    throw new Error('LIVE_PRETRADE_AMOUNT_BELOW_MIN');
  }

  const normalizedByPrecision = normalizeAmountByPrecision(quantity, rules.amountPrecision);
  if (Number.isFinite(normalizedByPrecision) && approxGreaterThan(Math.abs(quantity - normalizedByPrecision), 1e-12)) {
    throw new Error('LIVE_PRETRADE_AMOUNT_PRECISION');
  }

  if (typeof rules.minNotional === 'number') {
    let priceForNotional: number | null = null;
    if (typeof params.payload.price === 'number' && Number.isFinite(params.payload.price)) {
      priceForNotional = params.payload.price;
    } else {
      priceForNotional = await params.connector.fetchMarkPrice(normalizedSymbol).catch(() => null);
    }
    if (typeof priceForNotional === 'number' && Number.isFinite(priceForNotional)) {
      const notional = quantity * priceForNotional;
      if (approxLessThan(notional, rules.minNotional)) {
        throw new Error('LIVE_PRETRADE_NOTIONAL_BELOW_MIN');
      }
    }
  }
};

const executeLiveOrderOnExchange: OpenOrderDeps['executeLiveOrder'] = async (params) => {
  const apiKey = await resolveLiveExecutionApiKey({
    userId: params.userId,
    bot: {
      exchange: params.bot.exchange,
      apiKeyId: params.bot.apiKeyId,
    },
  });

  const connector = new CcxtFuturesConnector({
    exchangeId: apiKey.exchange.toLowerCase(),
    apiKey: decrypt(apiKey.apiKey),
    secret: decrypt(apiKey.apiSecret),
    marketType: params.bot.marketType,
  });

  const liveAdapter = createLiveOrderAdapter(connector);
  try {
    const targetLeverage = await resolveLiveTargetLeverage({
      userId: params.userId,
      marketType: params.bot.marketType,
      payload: params.payload,
    });
    await enforceLivePretradeGuards({
      connector,
      apiKeyId: apiKey.id,
      exchange: apiKey.exchange,
      marketType: params.bot.marketType,
      payload: params.payload,
    });
    await convergeLiveMarginAndLeverageIfNeeded({
      connector,
      apiKeyId: apiKey.id,
      symbol: params.payload.symbol.toUpperCase(),
      targetLeverage,
    });

    const result = await liveAdapter.placeLiveOrderWithFees({
      order: {
        symbol: params.payload.symbol.toUpperCase(),
        side: params.payload.side === 'BUY' ? 'buy' : 'sell',
        type: mapLiveOrderType(params.payload.type),
        amount: params.payload.quantity,
        price: params.payload.price,
        positionMode: params.bot.positionMode,
      },
    });

    return {
      exchangeOrderId: result.exchangeOrderId,
      status: mapLiveOrderStatus(result.rawOrderStatus ?? result.status, params.payload.type),
      fee: result.fee,
      feeSource: result.feeSource,
      feePending: result.feePending,
      feeCurrency: result.feeCurrency,
      effectiveFeeRate: result.effectiveFeeRate,
      exchangeTradeId: result.exchangeTradeId,
      fills: result.fills,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('LIVE_PRETRADE_')
    ) {
      throw error;
    }
    throw new Error('LIVE_EXECUTION_FAILED');
  } finally {
    await connector.disconnect().catch(() => undefined);
  }
};

const defaultOpenOrderDeps: OpenOrderDeps = {
  executeLiveOrder: executeLiveOrderOnExchange,
};

const writeOrderAudit = async (params: {
  userId: string;
  orderId: string;
  action: 'order.opened' | 'order.canceled' | 'order.closed';
  level: 'INFO' | 'WARN';
  metadata?: Record<string, unknown>;
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        action: params.action,
        level: params.level,
        source: 'orders.service',
        message: `Order lifecycle event: ${params.action}`,
        category: 'TRADING_DECISION',
        entityType: 'ORDER',
        entityId: params.orderId,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Audit failures should not block order lifecycle.
  }
};

export const openOrder = async (
  userId: string,
  payload: OpenOrderDto,
  deps: OpenOrderDeps = defaultOpenOrderDeps
) => {
  const liveBot = await ensureLiveOrderAllowed(userId, payload);

  const now = new Date();
  let exchangeOrderId: string | null = null;
  let exchangeTradeId: string | null = null;
  let status: 'OPEN' | 'FILLED' = payload.type === 'MARKET' ? 'FILLED' : 'OPEN';
  let fee: number | null = null;
  let feeSource: 'ESTIMATED' | 'EXCHANGE_FILL' = 'ESTIMATED';
  let feePending = payload.mode === 'LIVE';
  let feeCurrency: string | null = null;
  let effectiveFeeRate: number | null = null;
  let fills: CcxtFuturesOrderFill[] = [];

  if (payload.mode === 'LIVE' && process.env.NODE_ENV !== 'test') {
    if (!liveBot) {
      throw new Error('LIVE_BOT_NOT_FOUND');
    }
    const liveResult = await deps.executeLiveOrder({
      userId,
      bot: liveBot,
      payload,
    });
    exchangeOrderId = liveResult.exchangeOrderId;
    status = liveResult.status;
    exchangeTradeId = liveResult.exchangeTradeId ?? null;
    fee = typeof liveResult.fee === 'number' ? liveResult.fee : null;
    feeSource = liveResult.feeSource ?? 'ESTIMATED';
    feePending = liveResult.feePending ?? false;
    feeCurrency = liveResult.feeCurrency ?? null;
    effectiveFeeRate =
      typeof liveResult.effectiveFeeRate === 'number' ? liveResult.effectiveFeeRate : null;
    fills = Array.isArray(liveResult.fills) ? liveResult.fills : [];
  }

  const order = await prisma.order.create({
    data: {
      userId,
      botId: payload.botId,
      walletId: payload.walletId,
      strategyId: payload.strategyId,
      symbol: payload.symbol.toUpperCase(),
      side: payload.side,
      type: payload.type,
      status,
      quantity: payload.quantity,
      filledQuantity: status === 'FILLED' ? payload.quantity : 0,
      price: payload.price,
      fee,
      feeSource,
      feePending,
      feeCurrency,
      effectiveFeeRate,
      exchangeOrderId,
      exchangeTradeId,
      submittedAt: now,
      filledAt: status === 'FILLED' ? now : null,
    },
  });

  if (payload.mode === 'LIVE' && fills.length > 0) {
    await prisma.orderFill.createMany({
      data: fills.map((fill) => ({
        userId,
        botId: payload.botId ?? null,
        strategyId: payload.strategyId ?? null,
        orderId: order.id,
        tradeId: null,
        positionId: null,
        symbol: fill.symbol,
        side: payload.side,
        exchangeTradeId:
          fill.exchangeTradeId ?? `${exchangeOrderId ?? order.id}-${fill.executedAt?.toISOString() ?? 'na'}`,
        price: fill.price,
        quantity: fill.quantity,
        notional: fill.notional,
        feeCost: typeof fill.feeCost === 'number' ? fill.feeCost : null,
        feeCurrency: fill.feeCurrency,
        feeRate: fill.feeRate,
        executedAt: fill.executedAt ?? now,
        raw: (fill.raw ?? {}) as Prisma.InputJsonValue,
      })),
    });
  }

  await writeOrderAudit({
    userId,
    orderId: order.id,
    action: 'order.opened',
    level: 'INFO',
    metadata: {
      mode: payload.mode,
      riskAck: payload.riskAck,
      type: payload.type,
      status: order.status,
      exchangeOrderId: order.exchangeOrderId,
    },
  });

  return order;
};

export const cancelOrder = async (userId: string, id: string, payload: CancelOrderDto) => {
  const existing = await prisma.order.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;

  if (existing.status === 'CANCELED' || existing.status === 'FILLED') {
    throw new Error('ORDER_NOT_CANCELABLE');
  }

  if (!payload.riskAck) {
    throw new Error('ORDER_CANCEL_RISK_ACK_REQUIRED');
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date(),
    },
  });

  await writeOrderAudit({
    userId,
    orderId: updated.id,
    action: 'order.canceled',
    level: 'WARN',
    metadata: {
      previousStatus: existing.status,
      riskAck: payload.riskAck,
    },
  });

  return updated;
};

export const closeOrder = async (userId: string, id: string, payload: CloseOrderDto) => {
  const existing = await prisma.order.findFirst({
    where: { id, userId },
  });
  if (!existing) return null;

  if (!payload.riskAck) {
    throw new Error('ORDER_CLOSE_RISK_ACK_REQUIRED');
  }

  if (existing.status !== 'OPEN' && existing.status !== 'PARTIALLY_FILLED') {
    throw new Error('ORDER_NOT_CLOSABLE');
  }

  const now = new Date();
  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: 'FILLED',
      filledQuantity: existing.quantity,
      filledAt: now,
    },
  });

  if (existing.positionId) {
    await prisma.position.updateMany({
      where: {
        id: existing.positionId,
        userId,
        status: 'OPEN',
      },
      data: {
        status: 'CLOSED',
        closedAt: now,
      },
    });
  }

  await writeOrderAudit({
    userId,
    orderId: updated.id,
    action: 'order.closed',
    level: 'INFO',
    metadata: {
      previousStatus: existing.status,
      riskAck: payload.riskAck,
    },
  });

  return updated;
};
