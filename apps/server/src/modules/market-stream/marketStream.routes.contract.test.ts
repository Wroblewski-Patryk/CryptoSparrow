import { describe, expect, it } from 'vitest';
import {
  MARKET_STREAM_MAX_SYMBOLS,
  formatSseComment,
  formatSseEvent,
  parseSymbols,
} from './marketStream.routes';

describe('marketStream.routes contract helpers', () => {
  it('normalizes symbols to uppercase and deduplicates input', () => {
    const symbols = parseSymbols('btcusdt, ETHUSDT ,btcusdt');
    expect([...symbols]).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('supports stream symbol guard contract max size', () => {
    const manySymbols = Array.from(
      { length: MARKET_STREAM_MAX_SYMBOLS + 1 },
      (_, index) => `s${index}usdt`
    ).join(',');

    const symbols = parseSymbols(manySymbols);
    expect(symbols.size).toBe(MARKET_STREAM_MAX_SYMBOLS + 1);
  });

  it('formats SSE event frame with id, event, and data lines', () => {
    const frame = formatSseEvent(42, 'ticker', { symbol: 'BTCUSDT', lastPrice: 1 });
    expect(frame).toContain('id: 42\n');
    expect(frame).toContain('event: ticker\n');
    expect(frame).toContain('"symbol":"BTCUSDT"');
    expect(frame.endsWith('\n\n')).toBe(true);
  });

  it('formats heartbeat comment frame', () => {
    expect(formatSseComment('ping')).toBe(': ping\n\n');
  });
});
