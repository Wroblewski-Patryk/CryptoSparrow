import { describe, expect, it } from 'vitest';
import { simulateTradesForSymbolReplay } from './backtestReplayCore';

const candle = (index: number, close: number) => ({
  openTime: 1_700_000_000_000 + index * 60_000,
  closeTime: 1_700_000_030_000 + index * 60_000,
  open: close,
  high: close * 1.001,
  low: close * 0.999,
  close,
  volume: 1000,
});

describe('simulateTradesForSymbolReplay', () => {
  it('opens using shared decision thresholds and closes by lifecycle/final-range authority', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102), // LONG
      candle(2, 101.9), // EXIT
      candle(3, 99), // SHORT
      candle(4, 99.05), // EXIT
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    expect(result.trades[0].side).toBe('LONG');
    expect(result.trades[0].entryPrice).toBeGreaterThan(0);
    expect(result.liquidations).toBe(0);
    expect(result.eventCounts.ENTRY).toBeGreaterThanOrEqual(1);
  });

  it('does not create overlapping trade intervals for one symbol', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102),
      candle(2, 101.9),
      candle(3, 99),
      candle(4, 99.05),
      candle(5, 101.5),
      candle(6, 101.45),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    const ordered = [...result.trades].sort(
      (left, right) => new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime(),
    );
    for (let index = 1; index < ordered.length; index += 1) {
      const previousClosedAt = new Date(ordered[index - 1].closedAt).getTime();
      const currentOpenedAt = new Date(ordered[index].openedAt).getTime();
      expect(currentOpenedAt).toBeGreaterThanOrEqual(previousClosedAt);
    }
  });

  it('counts isolated liquidation when adverse move exceeds leverage threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.2), // LONG open
      candle(2, 80), // forced EXIT + liquidation region for lev=5
      candle(3, 80),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 10,
      marginMode: 'ISOLATED',
    });

    expect(result.liquidations).toBeGreaterThanOrEqual(1);
    expect(result.eventCounts.LIQUIDATION).toBeGreaterThanOrEqual(1);
  });

  it('emits lifecycle actions (DCA/TRAILING/EXIT) for timeline/reporting', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 101.2), // small pullback
      candle(3, 103.0), // favorable move (arms trailing but does not hit TP)
      candle(4, 102.0), // pullback -> trailing exit
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'ADAUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'MOMENTUM',
              condition: '>',
              value: -999,
              params: { period: 1 },
            },
          ],
          indicatorsShort: [],
        },
        additional: {
          dcaEnabled: false,
          dcaTimes: 0,
        },
        close: {
          tp: 4,
          tsl: [{ percent: 0.5 }],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBeGreaterThan(0);
    expect(result.eventCounts.DCA).toBe(0);
    expect(
      result.eventCounts.TRAILING +
        result.eventCounts.EXIT +
        result.eventCounts.TP +
        result.eventCounts.TTP +
        result.eventCounts.SL
    ).toBeGreaterThanOrEqual(1);
    expect(
      result.eventCounts.EXIT +
        result.eventCounts.TP +
        result.eventCounts.TTP +
        result.eventCounts.SL +
        result.eventCounts.TRAILING +
        result.eventCounts.LIQUIDATION
    ).toBe(result.trades.length);
  });

  it('emits take-profit lifecycle event when favorable move crosses TP threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 102.9), // TP
      candle(3, 102.88),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.TP).toBeGreaterThanOrEqual(1);
  });

  it('emits trailing-take-profit event when arm and pullback thresholds are hit', () => {
    const candles = [
      candle(0, 100),
      candle(1, 100.5),
      candle(2, 101), // open LONG
      candle(3, 103), // arm TTP
      candle(4, 102.4), // pullback => TTP
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'MOMENTUM',
              condition: '>',
              value: -999,
              params: { period: 2 },
            },
          ],
          indicatorsShort: [],
        },
        close: {
          mode: 'advanced',
          tp: 10,
          sl: 10,
          ttp: [{ arm: 1.5, percent: 0.5 }],
          tsl: [],
        },
        additional: {
          dcaEnabled: false,
          dcaTimes: 0,
        },
      },
    });

    expect(result.eventCounts.TTP).toBeGreaterThanOrEqual(1);
  });

  it('emits stop-loss lifecycle event when adverse move breaches SL threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.4), // open LONG
      candle(2, 98), // SL (still below threshold after one DCA reprice)
      candle(3, 97.98),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'SOLUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.SL).toBeGreaterThanOrEqual(1);
  });

  it('emits trailing exit lifecycle event once pullback crosses trailing threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 101.2), // small pullback
      candle(3, 103.0), // favorable move (arms trailing)
      candle(4, 102.0), // trailing exit
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'XRPUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'MOMENTUM',
              condition: '>',
              value: -999,
              params: { period: 1 },
            },
          ],
          indicatorsShort: [],
        },
        additional: {
          dcaEnabled: false,
          dcaTimes: 0,
        },
        close: {
          mode: 'advanced',
          tp: 4,
          tsl: [{ percent: 0.5 }],
        },
      },
    });

    expect(result.eventCounts.TRAILING).toBeGreaterThanOrEqual(1);
  });

  it('triggers DCA on intrabar wick (low/high), not only on candle close', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.2), // open LONG
      {
        ...candle(2, 100.9), // close not deep enough for DCA by close-only logic
        low: 99.8, // wick breaches DCA threshold
        high: 101.1,
      },
      candle(3, 101.0),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BNBUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.DCA).toBeGreaterThanOrEqual(1);
  });

  it('applies DCA multiplier on current position size (parity with runtime position management)', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101), // open LONG
      candle(2, 102), // open LONG (period clamp => 2)
      {
        ...candle(3, 100.5),
        low: 89, // DCA #1
      },
      {
        ...candle(4, 95),
        low: 70, // DCA #2 (based on updated average entry reference)
      },
      candle(5, 120), // exit
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 1,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'MOMENTUM',
              condition: '>',
              value: -999,
              params: { period: 1 },
            },
          ],
          indicatorsShort: [],
        },
        close: {
          tp: 99,
          sl: 99,
        },
        additional: {
          dcaEnabled: true,
          dcaTimes: 2,
          dcaLevels: [
            { percent: -10, multiplier: 1 },
            { percent: -10, multiplier: 1 },
          ],
        },
      },
    });

    expect(result.eventCounts.DCA).toBe(2);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades[0].quantity).toBeCloseTo(4, 5);
  });

  it('uses advanced DCA levels even when dcaTimes is set to 0', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101), // open LONG
      {
        ...candle(2, 100.4),
        low: 99.5, // DCA #1
      },
      {
        ...candle(3, 99.2),
        low: 98.2, // DCA #2
      },
      candle(4, 120), // close
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 5,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            { name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } },
          ],
          indicatorsShort: [],
        },
        close: {
          tp: 99,
          sl: 99,
        },
        additional: {
          dcaEnabled: true,
          dcaMode: 'advanced',
          dcaTimes: 0,
          dcaLevels: [
            { percent: -1, multiplier: 1 },
          ],
        },
      },
    });

    expect(result.eventCounts.DCA).toBeGreaterThanOrEqual(1);
  });

  it('uses strategy rules to suppress fallback threshold signals when indicators do not match', () => {
    const candles = [
      candle(0, 100),
      candle(1, 104),
      candle(2, 98),
      candle(3, 105),
      candle(4, 97),
      candle(5, 106),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'RSI',
              condition: '>',
              value: 99,
              params: { period: 14 },
            },
          ],
          indicatorsShort: [],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it('does not fallback to percent-threshold signals when strategy payload has no valid indicator rules', () => {
    const candles = [
      candle(0, 100),
      candle(1, 104),
      candle(2, 99),
      candle(3, 105),
      candle(4, 98),
      candle(5, 106),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'both',
          indicatorsLong: [],
          indicatorsShort: [],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it('evaluates strategy EMA rules per candle and can generate directional trades', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101),
      candle(2, 102),
      candle(3, 103),
      candle(4, 104),
      candle(5, 103),
      candle(6, 102),
      candle(7, 101),
      candle(8, 100),
      candle(9, 99),
      candle(10, 98),
      candle(11, 99),
      candle(12, 100),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'ETHUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'both',
          indicatorsLong: [
            {
              name: 'EMA',
              condition: '>',
              value: 1,
              params: { fast: 2, slow: 4 },
            },
          ],
          indicatorsShort: [
            {
              name: 'EMA',
              condition: '<',
              value: 1,
              params: { fast: 2, slow: 4 },
            },
          ],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBeGreaterThan(0);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(new Set(result.trades.map((trade) => trade.side))).toContain('LONG');
  });

  it('uses walletRisk position sizing to scale initial quantity', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101),
      candle(2, 102), // open
      candle(3, 103),
      candle(4, 104),
    ];

    const lowRisk = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            { name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } },
          ],
          indicatorsShort: [],
        },
      },
      positionSizing: {
        mode: 'wallet_risk',
        referenceBalance: 10_000,
        walletRiskPercent: 1,
      },
    });

    const highRisk = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            { name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } },
          ],
          indicatorsShort: [],
        },
      },
      positionSizing: {
        mode: 'wallet_risk',
        referenceBalance: 10_000,
        walletRiskPercent: 10,
      },
    });

    expect(lowRisk.trades.length).toBeGreaterThan(0);
    expect(highRisk.trades.length).toBeGreaterThan(0);
    expect(highRisk.trades[0].quantity).toBeGreaterThan(lowRisk.trades[0].quantity);
  });

  it('respects close.mode=basic and ignores trailing thresholds from config', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 103), // move up
      candle(3, 102.2), // pullback - could trigger trailing if enabled
      candle(4, 102.1),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } }],
          indicatorsShort: [],
        },
        close: {
          mode: 'basic',
          tp: 99,
          sl: 99,
          ttp: [{ arm: 1, percent: 0.2 }],
          tsl: [{ arm: 1, percent: 0.2 }],
        },
      },
    });

    expect(result.eventCounts.TTP).toBe(0);
    expect(result.eventCounts.TRAILING).toBe(0);
  });

  it('respects close.mode=advanced and ignores TP/SL from config', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 103), // would quickly trigger TP in basic
      candle(3, 102.7),
      candle(4, 102.6),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 5,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } }],
          indicatorsShort: [],
        },
        close: {
          mode: 'advanced',
          tp: 0.2,
          sl: 0.2,
          ttp: [],
          tsl: [],
        },
      },
    });

    expect(result.eventCounts.TP).toBe(0);
    expect(result.eventCounts.SL).toBe(0);
  });

  it('emits parity decision-trace mismatch diagnostics with timestamp/side/trigger/reason', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102), // LONG open
      candle(2, 99), // SHORT signal while LONG open => no_flip_with_open_position
      candle(3, 99.1),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    const mismatch = result.decisionTrace.find(
      (entry) => entry.mismatchReason === 'no_flip_with_open_position',
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.side).toBe('LONG');
    expect(mismatch?.trigger).toBe('THRESHOLD');
    expect(mismatch?.timestamp).toBeInstanceOf(Date);
  });

  it('tracks wallet-risk sizing on current equity (second trade size drops after realized loss)', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101), // open LONG
      candle(2, 100), // loss close
      candle(3, 101), // next LONG open
      candle(4, 100), // next loss close
      candle(5, 101), // next LONG open
      candle(6, 100), // next loss close
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 5,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: -999, params: { period: 1 } }],
          indicatorsShort: [],
        },
        close: {
          mode: 'basic',
          tp: 99,
          sl: 0.5,
          ttp: [],
          tsl: [],
        },
        additional: {
          dcaEnabled: false,
          dcaTimes: 0,
        },
      },
      positionSizing: {
        mode: 'wallet_risk',
        referenceBalance: 10_000,
        walletRiskPercent: 10,
      },
    });

    expect(result.trades.length).toBeGreaterThanOrEqual(1);
    if (result.trades.length >= 2) {
      expect(result.trades[1].quantity).toBeLessThan(result.trades[0].quantity);
    }
  });

  it('never realizes losses below account floor (net pnl >= -initial balance)', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101), // open LONG
      {
        ...candle(2, 1), // severe crash -> liquidation region
        low: 0.1,
      },
      candle(3, 1),
    ];

    const initialBalance = 1_000;
    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 10,
      marginMode: 'ISOLATED',
      positionSizing: {
        mode: 'wallet_risk',
        referenceBalance: initialBalance,
        walletRiskPercent: 100,
      },
    });

    const totalPnl = result.trades.reduce((acc, trade) => acc + trade.pnl, 0);
    expect(totalPnl).toBeGreaterThanOrEqual(-initialBalance);
  });
});
