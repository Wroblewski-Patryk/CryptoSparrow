import { MarketStreamEvent, StreamLogger, TradeMarketType } from './binanceStream.types';

type WebSocketMessage = { data: string };

export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((message: WebSocketMessage) => void) | null;
  onerror: ((error: unknown) => void) | null;
  onclose: (() => void) | null;
  send(payload: string): void;
  close(): void;
}

type WebSocketFactory = (url: string) => WebSocketLike;

const defaultLogger: StreamLogger = {
  info: (payload) => {
    if (process.env.NODE_ENV === 'test') return;
    console.log(JSON.stringify({ level: 'info', module: 'market-stream.binance', ...payload }));
  },
  warn: (payload) => {
    if (process.env.NODE_ENV === 'test') return;
    console.warn(JSON.stringify({ level: 'warn', module: 'market-stream.binance', ...payload }));
  },
  error: (payload) => {
    if (process.env.NODE_ENV === 'test') return;
    console.error(JSON.stringify({ level: 'error', module: 'market-stream.binance', ...payload }));
  },
};

const defaultWebSocketFactory: WebSocketFactory = (url) => {
  const ctor = (globalThis as { WebSocket?: new (streamUrl: string) => WebSocketLike }).WebSocket;
  if (!ctor) {
    throw new Error('Global WebSocket constructor is unavailable');
  }
  return new ctor(url);
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const toInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const toObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const toCombinedData = (payload: unknown) => {
  const root = toObject(payload);
  if (!root) return null;
  const data = toObject(root.data);
  return data ?? root;
};

export const normalizeBinanceStreamEvent = (
  payload: unknown,
  marketType: TradeMarketType = 'FUTURES'
): MarketStreamEvent | null => {
  const data = toCombinedData(payload);
  if (!data) return null;

  const eventType = typeof data.e === 'string' ? data.e : null;
  const symbol = typeof data.s === 'string' ? data.s.toUpperCase() : null;
  const eventTime = toInteger(data.E);
  if (!eventType || !symbol || eventTime === null) return null;

  if (eventType === '24hrTicker') {
    const lastPrice = toNumber(data.c);
    const priceChangePercent24h = toNumber(data.P);
    if (lastPrice === null || priceChangePercent24h === null) return null;

    return {
      type: 'ticker',
      exchange: 'BINANCE',
      marketType,
      symbol,
      eventTime,
      lastPrice,
      priceChangePercent24h,
    };
  }

  if (eventType === 'kline') {
    const kline = toObject(data.k);
    if (!kline) return null;

    const interval = typeof kline.i === 'string' ? kline.i : null;
    const openTime = toInteger(kline.t);
    const closeTime = toInteger(kline.T);
    const open = toNumber(kline.o);
    const high = toNumber(kline.h);
    const low = toNumber(kline.l);
    const close = toNumber(kline.c);
    const volume = toNumber(kline.v);
    const isFinal = typeof kline.x === 'boolean' ? kline.x : null;

    if (
      !interval ||
      openTime === null ||
      closeTime === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null ||
      volume === null ||
      isFinal === null
    ) {
      return null;
    }

    return {
      type: 'candle',
      exchange: 'BINANCE',
      marketType,
      symbol,
      interval,
      eventTime,
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      isFinal,
    };
  }

  return null;
};

type BinanceMarketStreamConfig = {
  streamUrl?: string;
  marketType?: TradeMarketType;
  symbols: string[];
  candleIntervals: string[];
  onEvent?: (event: MarketStreamEvent) => void | Promise<void>;
};

export class BinanceMarketStreamWorker {
  private socket: WebSocketLike | null = null;
  private readonly streamUrl: string;
  private readonly marketType: TradeMarketType;

  constructor(
    private readonly config: BinanceMarketStreamConfig,
    private readonly webSocketFactory: WebSocketFactory = defaultWebSocketFactory,
    private readonly logger: StreamLogger = defaultLogger
  ) {
    this.streamUrl = config.streamUrl ?? 'wss://stream.binance.com:9443/ws';
    this.marketType = config.marketType ?? 'FUTURES';
  }

  start() {
    if (this.socket) return;

    this.socket = this.webSocketFactory(this.streamUrl);

    this.socket.onopen = () => {
      const tickerStreams = this.config.symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`);
      const candleStreams = this.config.symbols.flatMap((symbol) =>
        this.config.candleIntervals.map((interval) => `${symbol.toLowerCase()}@kline_${interval}`)
      );
      const params = [...tickerStreams, ...candleStreams];

      this.socket?.send(
        JSON.stringify({
          method: 'SUBSCRIBE',
          params,
          id: Date.now(),
        })
      );

      this.logger.info({
        event: 'market_stream.subscribed',
        streamUrl: this.streamUrl,
        streamsCount: params.length,
      });
    };

    this.socket.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as unknown;
        const normalized = normalizeBinanceStreamEvent(parsed, this.marketType);
        if (!normalized) return;
        this.logger.info({
          event: `market_stream.${normalized.type}`,
          ...normalized,
        });
        void this.config.onEvent?.(normalized);
      } catch (error) {
        this.logger.warn({
          event: 'market_stream.parse_failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    };

    this.socket.onerror = (error) => {
      this.logger.error({
        event: 'market_stream.socket_error',
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    };

    this.socket.onclose = () => {
      this.logger.warn({
        event: 'market_stream.socket_closed',
      });
      this.socket = null;
    };
  }

  stop() {
    this.socket?.close();
    this.socket = null;
  }
}
