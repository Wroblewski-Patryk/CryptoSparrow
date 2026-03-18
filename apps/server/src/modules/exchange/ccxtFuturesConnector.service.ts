import {
  CcxtFuturesConnectorConfig,
  CcxtFuturesConnectorConfigSchema,
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
};

export interface CcxtExchangeLikeClient {
  setSandboxMode?: (enabled: boolean) => void;
  loadMarkets: () => Promise<unknown>;
  fetchTicker: (symbol: string) => Promise<{ last?: number | null }>;
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

    if (this.config.marketType === 'future' && typeof request.reduceOnly === 'boolean') {
      params.reduceOnly = request.reduceOnly;
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
      raw: order,
    };
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
}
