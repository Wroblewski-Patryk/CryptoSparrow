import { describe, expect, it } from 'vitest';
import {
  normalizeBaseCurrencies,
  normalizeBaseCurrency,
  normalizeSymbol,
  normalizeSymbolStrict,
  normalizeSymbols,
  resolveUniverseSymbols,
} from './symbols';

describe('symbols normalization helpers', () => {
  it('normalizes symbol by trimming and uppercasing', () => {
    expect(normalizeSymbol(' btcusdt ')).toBe('BTCUSDT');
    expect(normalizeSymbol(null)).toBe('');
  });

  it('normalizes strict symbol by removing non alphanumeric tokens', () => {
    expect(normalizeSymbolStrict(' btc/usdt-perp ')).toBe('BTCUSDTPERP');
    expect(normalizeSymbolStrict(undefined)).toBe('');
  });

  it('normalizes base currency with fallback', () => {
    expect(normalizeBaseCurrency(' usdt ')).toBe('USDT');
    expect(normalizeBaseCurrency('')).toBe('USDT');
    expect(normalizeBaseCurrency(undefined, ' usd ')).toBe('USD');
  });

  it('normalizes symbol lists to unique sorted values', () => {
    expect(normalizeSymbols([' btcusdt ', 'ETHUSDT', 'ethusdt', '', 'btcusdt'])).toEqual([
      'BTCUSDT',
      'ETHUSDT',
    ]);
  });

  it('normalizes base currency lists to unique sorted values', () => {
    expect(normalizeBaseCurrencies([' usdt ', 'USD', 'usd', '', 'EUR'])).toEqual([
      'EUR',
      'USD',
      'USDT',
    ]);
  });

  it('resolves universe symbols from whitelist minus blacklist after normalization', () => {
    expect(resolveUniverseSymbols([' btcusdt ', 'ETHUSDT', 'XRPUSDT'], ['ethusdt', ' xrpusdt '])).toEqual([
      'BTCUSDT',
    ]);
  });
});
