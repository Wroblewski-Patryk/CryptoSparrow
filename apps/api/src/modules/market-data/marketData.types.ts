import { z } from 'zod';

const TradeExchangeSchema = z.enum(['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE']);
const TradeMarketSchema = z.enum(['FUTURES', 'SPOT']);

export const OhlcvRequestSchema = z.object({
  exchange: TradeExchangeSchema.default('BINANCE'),
  marketType: TradeMarketSchema.default('FUTURES'),
  symbol: z.string().trim().min(1),
  timeframe: z.string().trim().min(1),
  limit: z.number().int().min(1).max(1000).default(200),
});

export const MarketSnapshotRequestSchema = z.object({
  exchange: TradeExchangeSchema.default('BINANCE'),
  marketType: TradeMarketSchema.default('FUTURES'),
  symbol: z.string().trim().min(1),
});

export const OrderBookRequestSchema = z.object({
  exchange: TradeExchangeSchema.default('BINANCE'),
  marketType: TradeMarketSchema.default('FUTURES'),
  symbol: z.string().trim().min(1),
  limit: z.number().int().min(1).max(500).default(50),
});

export type OhlcvRequest = z.input<typeof OhlcvRequestSchema>;
export type MarketSnapshotRequest = z.input<typeof MarketSnapshotRequestSchema>;
export type OrderBookRequest = z.input<typeof OrderBookRequestSchema>;

export interface OhlcvCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundingRateSnapshot {
  symbol: string;
  timestamp: number;
  fundingRate: number;
}

export interface OpenInterestSnapshot {
  symbol: string;
  timestamp: number;
  openInterest: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  timestamp: number;
  bids: [price: number, amount: number][];
  asks: [price: number, amount: number][];
}
