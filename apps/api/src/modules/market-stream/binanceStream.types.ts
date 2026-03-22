export type TradeMarketType = 'FUTURES' | 'SPOT';

export type StreamTickerEvent = {
  type: 'ticker';
  marketType: TradeMarketType;
  symbol: string;
  eventTime: number;
  lastPrice: number;
  priceChangePercent24h: number;
};

export type StreamCandleEvent = {
  type: 'candle';
  marketType: TradeMarketType;
  symbol: string;
  interval: string;
  eventTime: number;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isFinal: boolean;
};

export type MarketStreamEvent = StreamTickerEvent | StreamCandleEvent;

export type StreamLogger = {
  info: (payload: Record<string, unknown>) => void;
  warn: (payload: Record<string, unknown>) => void;
  error: (payload: Record<string, unknown>) => void;
};
