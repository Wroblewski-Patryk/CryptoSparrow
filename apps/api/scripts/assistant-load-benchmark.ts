#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { orchestrateAssistantDecision } from '../src/modules/engine/assistantOrchestrator.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const profile = {
  bots: 3,
  marketGroupsPerBot: 4,
  strategiesPerGroup: 4,
  agentsPerDecision: 5,
};

const cycles = Number.parseInt(process.env.ASSISTANT_LOAD_CYCLES ?? '25', 10);
const concurrency = Number.parseInt(process.env.ASSISTANT_LOAD_CONCURRENCY ?? '8', 10);
const p95LimitMs = Number.parseFloat(process.env.ASSISTANT_LOAD_P95_MAX_MS ?? '120');
const p99LimitMs = Number.parseFloat(process.env.ASSISTANT_LOAD_P99_MAX_MS ?? '220');
const timeoutRateLimit = Number.parseFloat(process.env.ASSISTANT_LOAD_TIMEOUT_RATE_MAX ?? '0.01');

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const buildRunInputs = () => {
  const modes = ['BACKTEST', 'PAPER', 'LIVE'];
  const inputs = [];
  let modeIndex = 0;
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    for (let bot = 1; bot <= profile.bots; bot += 1) {
      for (let group = 1; group <= profile.marketGroupsPerBot; group += 1) {
        for (let strategy = 1; strategy <= profile.strategiesPerGroup; strategy += 1) {
          const mode = modes[modeIndex % modes.length];
          modeIndex += 1;
          inputs.push({
            requestId: `bench-${cycle}-b${bot}-g${group}-s${strategy}`,
            userId: 'load-user-1',
            botId: `load-bot-${bot}`,
            botMarketGroupId: `group-${bot}-${group}`,
            symbol: `SYM${group}${strategy}USDT`,
            intervalWindow: '5m',
            mode,
            subagents: [
              { slotIndex: 1, role: 'TREND', enabled: true, timeoutMs: 1500 },
              { slotIndex: 2, role: 'RISK', enabled: true, timeoutMs: 1500 },
              { slotIndex: 3, role: 'VOL', enabled: true, timeoutMs: 1500 },
              { slotIndex: 4, role: 'NEWS', enabled: true, timeoutMs: 1500 },
            ],
          });
        }
      }
    }
  }
  return inputs;
};

const planner = {
  async createPlan(input) {
    return {
      planId: `plan-${input.requestId}`,
      steps: input.subagents
        .filter((slot) => slot.enabled)
        .map((slot) => ({
          slotIndex: slot.slotIndex,
          role: slot.role,
          task: `${slot.role} analysis for ${input.symbol}`,
        })),
    };
  },
};

const subagentGateway = {
  async runStep(_input, step) {
    if (step.slotIndex === 1 || step.slotIndex === 2) {
      return { proposal: 'LONG', confidence: 0.72, rationale: 'aligned_long_bias' };
    }
    if (step.slotIndex === 3) {
      return { proposal: 'NO_TRADE', confidence: 0.25, rationale: 'neutral_volume' };
    }
    return { proposal: 'LONG', confidence: 0.61, rationale: 'sentiment_supportive' };
  },
};

const traceWriter = { async write() {} };

const run = async () => {
  const inputs = buildRunInputs();
  const durations = [];
  let timeoutStatuses = 0;
  let totalStatuses = 0;
  let failures = 0;

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < inputs.length) {
      const currentIndex = cursor;
      cursor += 1;
      const input = inputs[currentIndex];
      const started = performance.now();
      try {
        const result = await orchestrateAssistantDecision(input, {
          planner,
          subagentGateway,
          traceWriter,
          nowMs: () => Date.now(),
        });
        durations.push(performance.now() - started);
        timeoutStatuses += result.statuses.filter((status) => status.status === 'timeout').length;
        totalStatuses += result.statuses.length;
      } catch {
        failures += 1;
      }
    }
  });

  const startedAt = new Date().toISOString();
  const wallStarted = performance.now();
  await Promise.all(workers);
  const runtimeMs = performance.now() - wallStarted;
  const finishedAt = new Date().toISOString();

  const totalDecisions = inputs.length;
  const timeoutRate = totalStatuses > 0 ? timeoutStatuses / totalStatuses : 0;
  const p95Ms = percentile(durations, 95);
  const p99Ms = percentile(durations, 99);
  const throughputDps = totalDecisions / Math.max(runtimeMs / 1000, 1);

  const summary = {
    startedAt,
    finishedAt,
    runtimeMs: Number(runtimeMs.toFixed(2)),
    profile,
    runConfig: { cycles, concurrency },
    totals: {
      decisions: totalDecisions,
      statuses: totalStatuses,
      failures,
      timeoutStatuses,
    },
    throughputDecisionsPerSecond: Number(throughputDps.toFixed(2)),
    latencyMs: {
      min: Number(Math.min(...durations).toFixed(3)),
      p50: Number(percentile(durations, 50).toFixed(3)),
      p95: Number(p95Ms.toFixed(3)),
      p99: Number(p99Ms.toFixed(3)),
      max: Number(Math.max(...durations).toFixed(3)),
    },
    timeoutRate: Number(timeoutRate.toFixed(5)),
    thresholds: {
      p95MaxMs: p95LimitMs,
      p99MaxMs: p99LimitMs,
      timeoutRateMax: timeoutRateLimit,
      failuresMax: 0,
    },
  };

  const gates = {
    p95: summary.latencyMs.p95 <= p95LimitMs,
    p99: summary.latencyMs.p99 <= p99LimitMs,
    timeoutRate: summary.timeoutRate <= timeoutRateLimit,
    failures: failures === 0,
  };

  const artifactPath = path.resolve(
    repoRoot,
    'docs/operations/_artifacts-assistant-load-2026-03-23.json'
  );
  await fs.writeFile(
    artifactPath,
    `${JSON.stringify({ summary, gates }, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify({ summary, gates, artifactPath }, null, 2));

  if (!gates.p95 || !gates.p99 || !gates.timeoutRate || !gates.failures) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
