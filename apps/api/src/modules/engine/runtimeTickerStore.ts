import { StreamTickerEvent } from '../market-stream/binanceStream.types';

const tickerStore = new Map<string, StreamTickerEvent>();

export const upsertRuntimeTicker = (event: StreamTickerEvent) => {
  tickerStore.set(event.symbol.toUpperCase(), event);
};

export const getRuntimeTicker = (symbol: string) => {
  return tickerStore.get(symbol.toUpperCase()) ?? null;
};

