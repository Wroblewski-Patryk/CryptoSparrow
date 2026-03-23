import { describe, expect, it, vi } from 'vitest';
import { orchestrateAssistantDecision } from './assistantOrchestrator.service';

const buildInput = (mode: 'BACKTEST' | 'PAPER' | 'LIVE') => ({
  requestId: `parity-${mode}`,
  userId: 'user-1',
  botId: 'bot-parity-1',
  botMarketGroupId: 'group-1',
  symbol: 'BTCUSDT',
  intervalWindow: '5m',
  mode,
  subagents: [
    { slotIndex: 1, role: 'TREND', enabled: true, timeoutMs: 1200 },
    { slotIndex: 2, role: 'RISK', enabled: true, timeoutMs: 1200 },
  ],
});

describe('Assistant orchestration parity across BACKTEST/PAPER/LIVE', () => {
  it('returns consistent final decision for the same deterministic inputs', async () => {
    const planner = {
      createPlan: vi.fn(async () => ({
        planId: 'plan-parity',
        steps: [
          { slotIndex: 1, role: 'TREND', task: 'trend check' },
          { slotIndex: 2, role: 'RISK', task: 'risk check' },
        ],
      })),
    };

    const subagentGateway = {
      runStep: vi.fn(async (_input: unknown, step: { slotIndex: number }) => {
        if (step.slotIndex === 1) {
          return {
            proposal: 'LONG' as const,
            confidence: 0.8,
            rationale: 'trend long',
          };
        }
        return {
          proposal: 'LONG' as const,
          confidence: 0.7,
          rationale: 'risk confirms long',
        };
      }),
    };

    const deps = {
      planner,
      subagentGateway,
      traceWriter: { write: vi.fn(async () => undefined) },
      nowMs: () => 1000,
    };

    const backtest = await orchestrateAssistantDecision(buildInput('BACKTEST'), deps);
    const paper = await orchestrateAssistantDecision(buildInput('PAPER'), deps);
    const live = await orchestrateAssistantDecision(buildInput('LIVE'), deps);

    expect(backtest.finalDecision).toBe('LONG');
    expect(paper.finalDecision).toBe('LONG');
    expect(live.finalDecision).toBe('LONG');
    expect(backtest.finalReason).toBe(paper.finalReason);
    expect(paper.finalReason).toBe(live.finalReason);
  });
});
