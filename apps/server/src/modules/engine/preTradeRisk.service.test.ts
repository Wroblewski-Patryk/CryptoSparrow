import { describe, expect, it } from 'vitest';
import { PreTradeAnalysisInputSchema } from './preTrade.types';
import { evaluatePreTradeRiskReasons } from './preTradeRisk.service';

const parseInput = (overrides?: Record<string, unknown>) =>
  PreTradeAnalysisInputSchema.parse({
    userId: 'u1',
    botId: 'b1',
    symbol: 'BTCUSDT',
    mode: 'LIVE',
    ...overrides,
  });

describe('evaluatePreTradeRiskReasons', () => {
  it('returns live guardrail reasons when bot config is not eligible', () => {
    const reasons = evaluatePreTradeRiskReasons({
      parsed: parseInput(),
      userOpenPositions: 0,
      botOpenPositions: 0,
      hasOpenPositionOnSymbol: false,
      botLiveConfig: {
        mode: 'PAPER',
        marketType: 'FUTURES',
        liveOptIn: false,
        consentTextVersion: null,
      },
    });

    expect(reasons).toContain('live_mode_bot_required');
    expect(reasons).toContain('live_opt_in_required');
    expect(reasons).toContain('live_consent_version_required');
  });

  it('returns position-limit reasons when thresholds are exceeded', () => {
    const reasons = evaluatePreTradeRiskReasons({
      parsed: parseInput({
        mode: 'PAPER',
        maxOpenPositionsPerUser: 2,
        maxOpenPositionsPerBot: 1,
      }),
      userOpenPositions: 2,
      botOpenPositions: 1,
      hasOpenPositionOnSymbol: false,
      botLiveConfig: null,
    });

    expect(reasons).toContain('user_open_positions_limit_reached');
    expect(reasons).toContain('bot_open_positions_limit_reached');
  });

  it('returns symbol-uniqueness reason when position already exists', () => {
    const reasons = evaluatePreTradeRiskReasons({
      parsed: parseInput({ mode: 'PAPER' }),
      userOpenPositions: 0,
      botOpenPositions: 0,
      hasOpenPositionOnSymbol: true,
      botLiveConfig: null,
    });

    expect(reasons).toContain('open_position_on_symbol_exists');
  });
});
