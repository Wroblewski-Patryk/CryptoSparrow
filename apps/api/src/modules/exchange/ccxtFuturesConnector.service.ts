import {
  CcxtFetchOrderWithFillsInput,
  CcxtFetchOrderWithFillsInputSchema,
  CcxtFetchTradesForOrderInput,
  CcxtFetchTradesForOrderInputSchema,
  CcxtFuturesConnectorConfig,
  CcxtFuturesConnectorConfigSchema,
  CcxtFuturesOrderFill,
  CcxtFuturesOrderRequest,
  CcxtFuturesOrderRequestSchema,
  CcxtFuturesOrderResult,
} from './ccxtFuturesConnector.types';

type CcxtOrderLike = {
  id?: string;
  status?: string;
  symbol?: string;
  side?: string;
  type?: string;
  amount?: number;
  filled?: number;
  price?: number;
  average?: number;
  trades?: unknown[];
  fills?: unknown[];
  info?: Record<string, unknown>;
};

type CcxtTradeFeeLike = {
  cost?: number;
  currency?: string;
  rate?: number;
};

type CcxtTradeLike = {
  id?: string;
  order?: string;
  orderId?: string;
  symbol?: string;
  side?: string;
  price?: number;
  amount?: number;
  cost?: number;
  timestamp?: number;
  datetime?: string;
  fee?: CcxtTradeFeeLike | null;
  fees?: CcxtTradeFeeLike[];
  info?: Record<string, unknown>;
};

export interface CcxtExchangeLikeClient {
  setSandboxMode?: (enabled: boolean) => void;
  loadMarkets: () => Promise<unknown>;
  fetchTicker: (symbol: string) => Promise<{ last?: number | null }>;
  fetchOrder?: (
    id: string,
    symbol?: string,
    params?: Record<string, unknown>
  ) => Promise<CcxtOrderLike>;
  fetchMyTrades?: (
    symbol?: string,
    since?: number,
    limit?: number,
    params?: Record<string, unknown>
  ) => Promise<CcxtTradeLike[]>;
  createOrder: (
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number,
    params?: Record<string, unknown>
  ) => Promise<CcxtOrderLike>;
  close?: () => Promise<void>;
}

type CcxtModuleLike = {
  [exchangeId: string]: new (config: Record<string, unknown>) => CcxtExchangeLikeClient;
};

export type CcxtClientFactory = (
  exchangeId: string,
  config: Record<string, unknown>
) => Promise<CcxtExchangeLikeClient>;

const defaultCcxtClientFactory: CcxtClientFactory = async (exchangeId, config) => {
  const ccxtModule = (await import('ccxt')) as unknown as CcxtModuleLike;
  const ExchangeCtor = ccxtModule[exchangeId];
  if (!ExchangeCtor) {
    throw new Error(`Unsupported CCXT exchange: ${exchangeId}`);
  }

  return new ExchangeCtor(config);
};

export class CcxtFuturesConnector {
  private readonly config: CcxtFuturesConnectorConfig;
  private client: CcxtExchangeLikeClient | null = null;

  constructor(
    config: CcxtFuturesConnectorConfig,
    private readonly clientFactory: CcxtClientFactory = defaultCcxtClientFactory
  ) {
    this.config = CcxtFuturesConnectorConfigSchema.parse(config);
  }

  async connect() {
    const client = await this.getOrCreateClient();
    await client.loadMarkets();
  }

  async fetchMarkPrice(symbol: string) {
    const client = await this.getOrCreateClient();
    const ticker = await client.fetchTicker(symbol);
    const markPrice = ticker.last;

    if (typeof markPrice !== 'number' || Number.isNaN(markPrice)) {
      throw new Error(`Unable to resolve mark price for ${symbol}`);
    }

    return markPrice;
  }

  async placeOrder(input: CcxtFuturesOrderRequest): Promise<CcxtFuturesOrderResult> {
    const request = CcxtFuturesOrderRequestSchema.parse(input);
    const client = await this.getOrCreateClient();
    const params: Record<string, unknown> = {};

    if (this.config.marketType === 'future') {
      if (typeof request.reduceOnly === 'boolean') {
        params.reduceOnly = request.reduceOnly;
      }
      if (request.positionMode === 'HEDGE') {
        if (!request.positionSide) {
          throw new Error('positionSide is required in HEDGE mode');
        }
        params.positionSide = request.positionSide;
      }
    } else if (this.config.marketType === 'spot') {
      if (typeof request.reduceOnly === 'boolean') {
        throw new Error('reduceOnly is not supported in SPOT mode');
      }
      if (request.positionMode === 'HEDGE' || request.positionSide) {
        throw new Error('HEDGE position parameters are not supported in SPOT mode');
      }
    }
    if (request.clientOrderId) {
      params.clientOrderId = request.clientOrderId;
    }

    const order = await client.createOrder(
      request.symbol,
      request.type,
      request.side,
      request.amount,
      request.price,
      params
    );

    const fills = this.normalizeOrderFills(order, request.symbol, 'createOrder');

    return {
      id: order.id ?? '',
      status: order.status,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      amount: order.amount,
      filled: order.filled,
      price: order.price,
      average: order.average,
      fills,
      raw: order,
    };
  }

  async fetchOrderWithFills(
    input: CcxtFetchOrderWithFillsInput
  ): Promise<{ order: CcxtFuturesOrderResult; fills: CcxtFuturesOrderFill[] }> {
    const request = CcxtFetchOrderWithFillsInputSchema.parse(input);
    const client = await this.getOrCreateClient();
    if (typeof client.fetchOrder !== 'function') {
      throw new Error('fetchOrder is not supported by this CCXT connector');
    }

    const order = await client.fetchOrder(request.orderId, request.symbol);
    const fills = this.normalizeOrderFills(order, request.symbol, 'fetchOrder');

    return {
      order: this.normalizeOrderResult(order, fills),
      fills,
    };
  }

  async fetchTradesForOrder(input: CcxtFetchTradesForOrderInput): Promise<CcxtFuturesOrderFill[]> {
    const request = CcxtFetchTradesForOrderInputSchema.parse(input);
    const client = await this.getOrCreateClient();
    if (typeof client.fetchMyTrades !== 'function') {
      throw new Error('fetchMyTrades is not supported by this CCXT connector');
    }

    const trades = await client.fetchMyTrades(request.symbol, request.since, request.limit, {
      orderId: request.orderId,
    });

    return trades
      .filter((trade) => {
        const orderIdFromTrade =
          trade.order ?? trade.orderId ?? this.readString(trade.info?.orderId);
        return orderIdFromTrade === request.orderId;
      })
      .map((trade) => this.normalizeTradeFill(trade, request.symbol, 'fetchMyTrades'));
  }

  async disconnect() {
    if (!this.client) return;

    if (typeof this.client.close === 'function') {
      await this.client.close();
    }
    this.client = null;
  }

  private async getOrCreateClient() {
    if (this.client) return this.client;

    const client = await this.clientFactory(this.config.exchangeId, {
      apiKey: this.config.apiKey,
      secret: this.config.secret,
      password: this.config.password,
      enableRateLimit: this.config.enableRateLimit,
      options: {
        defaultType: this.config.marketType,
      },
    });

    if (this.config.sandbox && typeof client.setSandboxMode === 'function') {
      client.setSandboxMode(true);
    }

    this.client = client;
    return client;
  }

  private normalizeOrderResult(
    order: CcxtOrderLike,
    fills: CcxtFuturesOrderFill[]
  ): CcxtFuturesOrderResult {
    return {
      id: order.id ?? '',
      status: order.status,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      amount: order.amount,
      filled: order.filled,
      price: order.price,
      average: order.average,
      fills,
      raw: order,
    };
  }

  private normalizeOrderFills(
    order: CcxtOrderLike,
    fallbackSymbol: string,
    source: CcxtFuturesOrderFill['source']
  ): CcxtFuturesOrderFill[] {
    const directTrades = Array.isArray(order.trades) ? order.trades : [];
    const directFills = Array.isArray(order.fills) ? order.fills : [];
    const binanceInfoFills = Array.isArray(order.info?.fills) ? order.info?.fills : [];
    const merged = [...directTrades, ...directFills, ...binanceInfoFills];

    return merged
      .map((entry) => this.normalizeTradeFill(entry, order.symbol ?? fallbackSymbol, source, order.id))
      .filter((fill) => fill.quantity > 0);
  }

  private normalizeTradeFill(
    tradeRaw: unknown,
    fallbackSymbol: string,
    source: CcxtFuturesOrderFill['source'],
    fallbackOrderId?: string
  ): CcxtFuturesOrderFill {
    const trade = (tradeRaw as CcxtTradeLike | undefined) ?? {};
    const topLevel = this.readRecord(tradeRaw) ?? {};
    const info = this.readRecord(trade.info) ?? topLevel;
    const quantity =
      this.readNumber(trade.amount) ??
      this.readNumber(topLevel.qty) ??
      this.readNumber(topLevel.executedQty) ??
      this.readNumber(info.qty) ??
      this.readNumber(info.executedQty) ??
      0;
    const price =
      this.readNumber(trade.price) ?? this.readNumber(topLevel.price) ?? this.readNumber(info.price) ?? 0;
    const notional =
      this.readNumber(trade.cost) ??
      this.readNumber(topLevel.quoteQty) ??
      this.readNumber(info.quoteQty) ??
      (price > 0 && quantity > 0 ? price * quantity : 0);
    const { feeCost, feeCurrency, feeRate } = this.extractFee({
      ...trade,
      info,
    });
    const executedAtMs =
      this.readNumber(trade.timestamp) ??
      this.readNumber(topLevel.time) ??
      this.readNumber(topLevel.timestamp) ??
      this.readNumber(info.time) ??
      this.readNumber(info.timestamp);

    return {
      exchangeTradeId:
        this.readString(trade.id) ??
        this.readString(topLevel.tradeId) ??
        this.readString(topLevel.id) ??
        this.readString(info.tradeId) ??
        this.readString(info.id),
      exchangeOrderId:
        this.readString(trade.order) ??
        this.readString(trade.orderId) ??
        this.readString(topLevel.orderId) ??
        this.readString(info.orderId) ??
        fallbackOrderId ??
        null,
      symbol:
        this.readString(trade.symbol) ??
        this.readString(topLevel.symbol) ??
        this.readString(info.symbol) ??
        fallbackSymbol,
      side:
        this.readString(trade.side) ??
        this.readString(topLevel.side) ??
        this.readString(topLevel.positionSide) ??
        this.readString(info.side) ??
        this.readString(info.positionSide) ??
        null,
      price,
      quantity,
      notional,
      feeCost,
      feeCurrency,
      feeRate,
      executedAt: typeof executedAtMs === 'number' ? new Date(executedAtMs) : null,
      source,
      raw: tradeRaw,
    };
  }

  private extractFee(trade: CcxtTradeLike): {
    feeCost: number;
    feeCurrency: string | null;
    feeRate: number | null;
  } {
    const fees = Array.isArray(trade.fees) ? trade.fees : [];
    if (fees.length > 0) {
      const total = fees.reduce((sum, fee) => sum + (this.readNumber(fee.cost) ?? 0), 0);
      const currency = this.readString(fees[0]?.currency) ?? null;
      const rate = this.readNumber(fees[0]?.rate) ?? null;
      return { feeCost: total, feeCurrency: currency, feeRate: rate };
    }

    const feeCost =
      this.readNumber(trade.fee?.cost) ??
      this.readNumber(trade.info?.commission) ??
      this.readNumber(trade.info?.fee) ??
      0;
    const feeCurrency =
      this.readString(trade.fee?.currency) ??
      this.readString(trade.info?.commissionAsset) ??
      this.readString(trade.info?.feeAsset) ??
      null;
    const feeRate = this.readNumber(trade.fee?.rate) ?? null;
    return { feeCost, feeCurrency, feeRate };
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null) return null;
    return value as Record<string, unknown>;
  }
}
