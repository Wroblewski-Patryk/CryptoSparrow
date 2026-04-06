import { describe, expect, it } from 'vitest';
import {
  buildCancelExecutionDedupeKey,
  buildCloseExecutionDedupeKey,
  buildDcaExecutionDedupeKey,
  buildOpenExecutionDedupeKey,
} from './runtimeExecutionDedupe.service';

describe('runtimeExecutionDedupe key builders', () => {
  it('builds deterministic OPEN dedupe key with normalized interval/symbol', () => {
    const key = buildOpenExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      botMarketGroupId: 'group-1',
      symbol: 'btcusdt',
      interval: '1 min',
      candleOpenTime: 1_000,
      candleCloseTime: 59_000,
      direction: 'LONG',
    });

    expect(key).toBe('v1|OPEN|user-1|bot-1|BTCUSDT|group-1|1m|1000|59000|LONG');
  });

  it('builds CLOSE dedupe key with normalized reason code', () => {
    const key = buildCloseExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'ETHUSDT',
      positionId: 'pos-1',
      closeReason: 'trailing_stop',
    });

    expect(key).toBe('v1|CLOSE|user-1|bot-1|ETHUSDT|pos-1|TSL');
  });

  it('builds DCA and CANCEL keys with stable scopes', () => {
    const dcaKey = buildDcaExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'SOLUSDT',
      positionId: 'pos-1',
      dcaLevelIndex: 2,
      positionSide: 'SHORT',
    });
    const cancelKey = buildCancelExecutionDedupeKey({
      userId: 'user-1',
      botId: 'bot-1',
      symbol: 'SOLUSDT',
      orderId: 'order-1',
      reasonCode: 'runtime_dca_finalize',
    });

    expect(dcaKey).toBe('v1|DCA|user-1|bot-1|SOLUSDT|pos-1|level:2|SHORT');
    expect(cancelKey).toBe('v1|CANCEL|user-1|bot-1|SOLUSDT|order-1|runtime_dca_finalize');
  });
});
