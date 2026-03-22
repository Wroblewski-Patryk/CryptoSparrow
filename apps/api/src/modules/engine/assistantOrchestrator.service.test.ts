import { describe, expect, it, vi } from 'vitest';
import { orchestrateAssistantDecision } from './assistantOrchestrator.service';

const baseInput = {
  requestId: 'req-1',
  userId: 'user-1',
  botId: 'bot-1',
  botMarketGroupId: 'group-1',
  symbol: 'BTCUSDT',
  intervalWindow: '5m',
  mode: 'PAPER' as const,
  subagents: [
    { slotIndex: 1, role: 'TREND', enabled: true, timeoutMs: 200 },
    { slotIndex: 2, role: 'RISK', enabled: true, timeoutMs: 200 },
  ],
};

describe('orchestrateAssistantDecision', () => {
  it('uses fail-closed strategy_only mode when planner fails', async () => {
    const traceWriter = { write: vi.fn(async () => undefined) };
    const result = await orchestrateAssistantDecision(baseInput, {
      planner: {
        createPlan: vi.fn(async () => {
          throw new Error('planner_down');
        }),
      },
      subagentGateway: {
        runStep: vi.fn(async () => ({
          proposal: 'LONG',
          confidence: 0.9,
          rationale: 'ignored',
        })),
      },
      traceWriter,
      nowMs: () => 1000,
    });

    expect(result.mode).toBe('strategy_only');
    expect(result.finalDecision).toBe('NO_TRADE');
    expect(result.finalReason).toContain('fail_closed');
    expect(traceWriter.write).toHaveBeenCalledTimes(1);
  });

  it('handles partial subagent failure and timeout with deterministic merge', async () => {
    const traceWriter = { write: vi.fn(async () => undefined) };
    const runStep = vi
      .fn()
      .mockImplementationOnce(async () => ({
        proposal: 'LONG',
        confidence: 0.8,
        rationale: 'trend says long',
      }))
      .mockImplementationOnce(
        async () =>
          await new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  proposal: 'SHORT',
                  confidence: 0.7,
                  rationale: 'risk says short',
                }),
              400
            )
          )
      );

    let now = 0;
    const result = await orchestrateAssistantDecision(baseInput, {
      planner: {
        createPlan: vi.fn(async () => ({
          planId: 'plan-1',
          steps: [
            { slotIndex: 1, role: 'TREND', task: 'analyze trend' },
            { slotIndex: 2, role: 'RISK', task: 'analyze risk' },
          ],
        })),
      },
      subagentGateway: { runStep },
      traceWriter,
      nowMs: () => {
        now += 25;
        return now;
      },
    });

    expect(result.statuses).toHaveLength(2);
    expect(result.statuses.find((status) => status.slotIndex === 2)?.status).toBe('timeout');
    expect(result.finalDecision).toBe('LONG');
    expect(result.finalReason).toBe('weighted_long');
  });

  it('sanitizes rationale and errors before trace logging', async () => {
    const captured: Array<unknown> = [];
    const result = await orchestrateAssistantDecision(baseInput, {
      planner: {
        createPlan: vi.fn(async () => ({
          planId: 'plan-1',
          steps: [
            { slotIndex: 1, role: 'TREND', task: 'analyze trend' },
            { slotIndex: 2, role: 'RISK', task: 'analyze risk' },
          ],
        })),
      },
      subagentGateway: {
        runStep: vi.fn(async () => ({
          proposal: 'EXIT',
          confidence: 1,
          rationale: 'exit now\u0000\u0001<script>alert(1)</script>',
        })),
      },
      traceWriter: {
        write: vi.fn(async (trace) => {
          captured.push(trace);
        }),
      },
      nowMs: () => 1000,
    });

    expect(result.finalDecision).toBe('EXIT');
    expect(JSON.stringify(captured[0])).not.toContain('\u0000');
    expect(JSON.stringify(captured[0])).toContain('exit now');
  });

  it('opens circuit breaker after repeated planner failures and degrades to strategy_only', async () => {
    const input = {
      ...baseInput,
      requestId: 'req-cb-1',
      botId: 'bot-circuit-1',
    };
    const planner = {
      createPlan: vi.fn(async () => {
        throw new Error('planner_down');
      }),
    };
    const traceWriter = { write: vi.fn(async () => undefined) };

    let now = 0;
    const nowMs = () => {
      now += 100;
      return now;
    };

    const first = await orchestrateAssistantDecision(input, {
      planner,
      subagentGateway: {
        runStep: vi.fn(async () => ({
          proposal: 'LONG',
          confidence: 1,
          rationale: 'n/a',
        })),
      },
      traceWriter,
      nowMs,
    });

    const second = await orchestrateAssistantDecision(
      { ...input, requestId: 'req-cb-2' },
      {
        planner,
        subagentGateway: {
          runStep: vi.fn(async () => ({
            proposal: 'LONG',
            confidence: 1,
            rationale: 'n/a',
          })),
        },
        traceWriter,
        nowMs,
      }
    );

    const third = await orchestrateAssistantDecision(
      { ...input, requestId: 'req-cb-3' },
      {
        planner,
        subagentGateway: {
          runStep: vi.fn(async () => ({
            proposal: 'LONG',
            confidence: 1,
            rationale: 'n/a',
          })),
        },
        traceWriter,
        nowMs,
      }
    );

    const fourth = await orchestrateAssistantDecision(
      { ...input, requestId: 'req-cb-4' },
      {
        planner,
        subagentGateway: {
          runStep: vi.fn(async () => ({
            proposal: 'LONG',
            confidence: 1,
            rationale: 'n/a',
          })),
        },
        traceWriter,
        nowMs,
      }
    );

    expect(first.finalReason).toBe('main_planner_failed_fail_closed');
    expect(second.finalReason).toBe('main_planner_failed_fail_closed');
    expect(third.finalReason).toBe('main_planner_failed_fail_closed');
    expect(fourth.finalReason).toBe('assistant_circuit_open');
    expect(fourth.mode).toBe('strategy_only');
  });
});
