import { metricsStore } from '../../observability/metrics';

export type AssistantDecision = 'LONG' | 'SHORT' | 'EXIT' | 'NO_TRADE';

export type AssistantMode = 'off' | 'strategy_only' | 'assistant';

export type AssistantRuntimeInput = {
  requestId: string;
  userId: string;
  botId: string;
  botMarketGroupId: string;
  symbol: string;
  intervalWindow: string;
  mode: 'BACKTEST' | 'PAPER' | 'LIVE';
  subagents: Array<{
    slotIndex: number;
    role: string;
    enabled: boolean;
    timeoutMs: number;
  }>;
};

export type AssistantMainPlanStep = {
  slotIndex: number;
  role: string;
  task: string;
};

export type AssistantMainPlan = {
  planId: string;
  steps: AssistantMainPlanStep[];
};

export type AssistantSubagentOutput = {
  slotIndex: number;
  role: string;
  proposal: AssistantDecision;
  confidence: number;
  rationale: string;
  latencyMs: number;
};

export type AssistantOrchestrationTrace = {
  requestId: string;
  botId: string;
  botMarketGroupId: string;
  symbol: string;
  mode: AssistantMode;
  statuses: Array<{
    slotIndex: number;
    role: string;
    status: 'ok' | 'timeout' | 'error' | 'skipped';
    latencyMs: number;
    message?: string;
  }>;
  outputs: AssistantSubagentOutput[];
  finalDecision: AssistantDecision;
  finalReason: string;
};

export interface AssistantMainPlannerGateway {
  createPlan(input: AssistantRuntimeInput): Promise<AssistantMainPlan>;
}

export interface AssistantSubagentGateway {
  runStep(
    input: AssistantRuntimeInput,
    step: AssistantMainPlanStep
  ): Promise<Omit<AssistantSubagentOutput, 'latencyMs' | 'slotIndex' | 'role'>>;
}

export interface AssistantTraceWriter {
  write(trace: AssistantOrchestrationTrace): Promise<void>;
}

const sanitizeText = (value: string, maxLength = 500) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

type CircuitState = {
  failures: number;
  openedAt: number | null;
};

const assistantCircuitByBot = new Map<string, CircuitState>();
const assistantCircuitFailureThreshold = Number.parseInt(
  process.env.ASSISTANT_CIRCUIT_FAILURE_THRESHOLD ?? '3',
  10
);
const assistantCircuitResetMs = Number.parseInt(
  process.env.ASSISTANT_CIRCUIT_RESET_MS ?? '60000',
  10
);

const defaultMainPlanner: AssistantMainPlannerGateway = {
  async createPlan(input) {
    return {
      planId: `plan:${input.requestId}`,
      steps: input.subagents
        .filter((slot) => slot.enabled)
        .map((slot) => ({
          slotIndex: slot.slotIndex,
          role: slot.role,
          task: `Analyze ${input.symbol} for ${input.intervalWindow}`,
        })),
    };
  },
};

const defaultSubagentGateway: AssistantSubagentGateway = {
  async runStep() {
    return {
      proposal: 'NO_TRADE',
      confidence: 0,
      rationale: 'No strategy edge detected by default scaffold.',
    };
  },
};

const defaultTraceWriter: AssistantTraceWriter = {
  async write() {
    // Intentionally no-op in scaffold. Runtime integration can bind DB writer.
  },
};

const runWithTimeout = async <T>(factory: () => Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      factory(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SUBAGENT_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const mergeAssistantOutputs = (outputs: AssistantSubagentOutput[]): {
  decision: AssistantDecision;
  reason: string;
} => {
  if (outputs.length === 0) return { decision: 'NO_TRADE', reason: 'no_subagent_outputs' };

  const exitOutput = outputs
    .filter((output) => output.proposal === 'EXIT')
    .sort((left, right) => left.slotIndex - right.slotIndex)[0];
  if (exitOutput) {
    return { decision: 'EXIT', reason: `exit_priority_slot_${exitOutput.slotIndex}` };
  }

  const longScore = outputs
    .filter((output) => output.proposal === 'LONG')
    .reduce((sum, output) => sum + output.confidence, 0);
  const shortScore = outputs
    .filter((output) => output.proposal === 'SHORT')
    .reduce((sum, output) => sum + output.confidence, 0);

  if (longScore === shortScore) return { decision: 'NO_TRADE', reason: 'tie' };
  if (longScore <= 0 && shortScore <= 0) return { decision: 'NO_TRADE', reason: 'weak_consensus' };
  return longScore > shortScore
    ? { decision: 'LONG', reason: 'weighted_long' }
    : { decision: 'SHORT', reason: 'weighted_short' };
};

export const orchestrateAssistantDecision = async (
  input: AssistantRuntimeInput,
  deps: {
    planner: AssistantMainPlannerGateway;
    subagentGateway: AssistantSubagentGateway;
    traceWriter: AssistantTraceWriter;
    nowMs: () => number;
  } = {
    planner: defaultMainPlanner,
    subagentGateway: defaultSubagentGateway,
    traceWriter: defaultTraceWriter,
    nowMs: () => Date.now(),
  }
) => {
  const circuit = assistantCircuitByBot.get(input.botId) ?? { failures: 0, openedAt: null };
  if (circuit.openedAt && deps.nowMs() - circuit.openedAt < assistantCircuitResetMs) {
    const trace: AssistantOrchestrationTrace = {
      requestId: input.requestId,
      botId: input.botId,
      botMarketGroupId: input.botMarketGroupId,
      symbol: input.symbol,
      mode: 'strategy_only',
      statuses: [],
      outputs: [],
      finalDecision: 'NO_TRADE',
      finalReason: 'assistant_circuit_open',
    };
    await deps.traceWriter.write(trace);
    return trace;
  }

  if (circuit.openedAt && deps.nowMs() - circuit.openedAt >= assistantCircuitResetMs) {
    assistantCircuitByBot.set(input.botId, { failures: 0, openedAt: null });
  }

  const enabledSubagents = input.subagents.filter((slot) => slot.enabled);
  if (enabledSubagents.length === 0) {
    const trace: AssistantOrchestrationTrace = {
      requestId: input.requestId,
      botId: input.botId,
      botMarketGroupId: input.botMarketGroupId,
      symbol: input.symbol,
      mode: 'strategy_only',
      statuses: [],
      outputs: [],
      finalDecision: 'NO_TRADE',
      finalReason: 'assistant_disabled_or_no_slots',
    };
    await deps.traceWriter.write(trace);
    return trace;
  }

  let plan: AssistantMainPlan;
  try {
    plan = await deps.planner.createPlan(input);
  } catch {
    const failed = assistantCircuitByBot.get(input.botId) ?? { failures: 0, openedAt: null };
    const nextFailures = failed.failures + 1;
    assistantCircuitByBot.set(input.botId, {
      failures: nextFailures,
      openedAt: nextFailures >= assistantCircuitFailureThreshold ? deps.nowMs() : null,
    });
    const trace: AssistantOrchestrationTrace = {
      requestId: input.requestId,
      botId: input.botId,
      botMarketGroupId: input.botMarketGroupId,
      symbol: input.symbol,
      mode: 'strategy_only',
      statuses: enabledSubagents.map((slot) => ({
        slotIndex: slot.slotIndex,
        role: slot.role,
        status: 'skipped',
        latencyMs: 0,
        message: 'main_planner_failed',
      })),
      outputs: [],
      finalDecision: 'NO_TRADE',
      finalReason: 'main_planner_failed_fail_closed',
    };
    await deps.traceWriter.write(trace);
    return trace;
  }

  const statuses: AssistantOrchestrationTrace['statuses'] = [];
  const outputs: AssistantSubagentOutput[] = [];

  await Promise.all(
    enabledSubagents.map(async (slot) => {
      const step = plan.steps.find((candidate) => candidate.slotIndex === slot.slotIndex);
      if (!step) {
        statuses.push({
          slotIndex: slot.slotIndex,
          role: slot.role,
          status: 'skipped',
          latencyMs: 0,
          message: 'no_planned_step',
        });
        return;
      }

      const startedAt = deps.nowMs();
      try {
        const output = await runWithTimeout(
          () => deps.subagentGateway.runStep(input, step),
          slot.timeoutMs
        );
        const latencyMs = Math.max(0, deps.nowMs() - startedAt);
        const normalizedOutput: AssistantSubagentOutput = {
          slotIndex: slot.slotIndex,
          role: slot.role,
          proposal: output.proposal,
          confidence: clampConfidence(output.confidence),
          rationale: sanitizeText(output.rationale),
          latencyMs,
        };
        statuses.push({
          slotIndex: slot.slotIndex,
          role: slot.role,
          status: 'ok',
          latencyMs,
        });
        outputs.push(normalizedOutput);
      } catch (error) {
        const latencyMs = Math.max(0, deps.nowMs() - startedAt);
        const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
        if (message === 'SUBAGENT_TIMEOUT') {
          metricsStore.recordAssistantSubagentTimeout();
        }
        statuses.push({
          slotIndex: slot.slotIndex,
          role: slot.role,
          status: message === 'SUBAGENT_TIMEOUT' ? 'timeout' : 'error',
          latencyMs,
          message: sanitizeText(message, 120),
        });
      }
    })
  );

  statuses.sort((left, right) => left.slotIndex - right.slotIndex);
  outputs.sort((left, right) => left.slotIndex - right.slotIndex);

  const merged = mergeAssistantOutputs(outputs);
  metricsStore.recordRuntimeMergeOutcome(merged.decision);
  const trace: AssistantOrchestrationTrace = {
    requestId: input.requestId,
    botId: input.botId,
    botMarketGroupId: input.botMarketGroupId,
    symbol: input.symbol,
    mode: 'assistant',
    statuses,
    outputs,
    finalDecision: merged.decision,
    finalReason: merged.reason,
  };

  assistantCircuitByBot.set(input.botId, { failures: 0, openedAt: null });
  await deps.traceWriter.write(trace);
  return trace;
};
