#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    statusPath: path.join(operationsDir, 'v1-rc-external-gates-status.md'),
    evidencePath: path.join(operationsDir, '_artifacts-rc-evidence-check-latest.json'),
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--status-path') options.statusPath = args[index + 1] ?? options.statusPath;
    if (arg === '--evidence-path') options.evidencePath = args[index + 1] ?? options.evidencePath;
    if (arg === '--json') options.json = true;
  }

  options.statusPath = path.resolve(process.cwd(), options.statusPath);
  options.evidencePath = path.resolve(process.cwd(), options.evidencePath);
  return options;
};

const parseGateLabel = (rawStatus, gateNumber) => {
  const regex = new RegExp(`- Gate ${gateNumber} \\(.+?\\):\\s*([^\\r\\n]+)`, 'i');
  return rawStatus.match(regex)?.[1]?.trim() ?? 'UNKNOWN';
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/summarizeRcGates.mjs [--status-path <file>] [--evidence-path <file>] [--json]'
    );
    process.exit(0);
  }

  const rawStatus = await readFile(options.statusPath, 'utf8');
  let evidence = null;
  try {
    const rawEvidence = await readFile(options.evidencePath, 'utf8');
    evidence = JSON.parse(rawEvidence);
  } catch {
    evidence = null;
  }

  const gates = {
    gate1: parseGateLabel(rawStatus, 1),
    gate2: parseGateLabel(rawStatus, 2),
    gate3: parseGateLabel(rawStatus, 3),
    gate4: parseGateLabel(rawStatus, 4),
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    gates,
    missingEvidenceCount: Number.isFinite(evidence?.counts?.missing) ? evidence.counts.missing : null,
    strictPassed: Boolean(evidence?.strictPassed),
    evidenceGeneratedAt: evidence?.generatedAt ?? null,
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('# RC Gates Summary');
  console.log(`- Gate 1: ${summary.gates.gate1}`);
  console.log(`- Gate 2: ${summary.gates.gate2}`);
  console.log(`- Gate 3: ${summary.gates.gate3}`);
  console.log(`- Gate 4: ${summary.gates.gate4}`);
  console.log(`- Missing evidence: ${summary.missingEvidenceCount ?? 'n/a'}`);
  console.log(`- Strict passed: ${summary.strictPassed ? 'yes' : 'no'}`);
  console.log(`- Evidence generated at: ${summary.evidenceGeneratedAt ?? 'n/a'}`);
};

main().catch((error) => {
  console.error('[ops:rc:gates:summary] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
