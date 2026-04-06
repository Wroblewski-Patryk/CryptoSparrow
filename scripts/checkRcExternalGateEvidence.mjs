#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    statusPath: path.join(operationsDir, 'v1-rc-external-gates-status.md'),
    runbookPath: path.join(operationsDir, 'v1-rc-external-gates-runbook.md'),
    signoffPath: path.join(operationsDir, 'v1-rc-signoff-record.md'),
    strict: false,
    requireProductionGate2: false,
    json: false,
    output: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--status-path') options.statusPath = args[index + 1] ?? options.statusPath;
    if (arg === '--runbook-path') options.runbookPath = args[index + 1] ?? options.runbookPath;
    if (arg === '--signoff-path') options.signoffPath = args[index + 1] ?? options.signoffPath;
    if (arg === '--strict') options.strict = true;
    if (arg === '--require-production-gate2') options.requireProductionGate2 = true;
    if (arg === '--json') options.json = true;
    if (arg === '--output') options.output = args[index + 1] ?? options.output;
  }

  options.statusPath = path.resolve(process.cwd(), options.statusPath);
  options.runbookPath = path.resolve(process.cwd(), options.runbookPath);
  options.signoffPath = path.resolve(process.cwd(), options.signoffPath);
  if (options.output) {
    options.output = path.resolve(process.cwd(), options.output);
  }
  return options;
};

const extractEvidenceValues = (raw, heading) => {
  const lines = raw.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === heading);
  if (sectionStart === -1) return [];
  const evidenceStart = lines.findIndex((line, index) => index > sectionStart && line.trim() === 'Evidence to record:');
  if (evidenceStart === -1) return [];

  const entries = [];
  for (let index = evidenceStart + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('## ')) break;
    if (!line.startsWith('- ')) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const label = line.slice(2, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.push({ label, value, filled: value.length > 0 });
  }
  return entries;
};

const parseGateLabel = (rawStatus, gateNumber) => {
  const regex = new RegExp(`- Gate ${gateNumber} \\(.+?\\):\\s*([^\\r\\n]+)`, 'i');
  return rawStatus.match(regex)?.[1]?.trim() ?? 'OPEN';
};

const parseSignoffFields = (rawSignoff) => {
  const capture = (regex) => rawSignoff.match(regex)?.[1]?.trim() ?? '';
  return {
    engineering: capture(/- Engineering sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im),
    product: capture(/- Product sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im),
    operations: capture(/- Operations sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im),
    owner: capture(/- RC owner with rollback authority:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im),
    rcStatus: capture(/- RC status:\s*`([^`]+)`/i),
  };
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/checkRcExternalGateEvidence.mjs [--status-path <file>] [--runbook-path <file>] [--signoff-path <file>] [--json] [--output <file>] [--strict] [--require-production-gate2]'
    );
    process.exit(0);
  }

  const [rawStatus, rawRunbook, rawSignoff] = await Promise.all([
    readFile(options.statusPath, 'utf8'),
    readFile(options.runbookPath, 'utf8'),
    readFile(options.signoffPath, 'utf8'),
  ]);

  const gateLabels = {
    gate1: parseGateLabel(rawStatus, 1),
    gate2: parseGateLabel(rawStatus, 2),
    gate3: parseGateLabel(rawStatus, 3),
    gate4: parseGateLabel(rawStatus, 4),
  };

  const gate1Evidence = extractEvidenceValues(rawRunbook, '## Gate 1: Backup Snapshot and Restore Validation');
  const gate3Evidence = extractEvidenceValues(rawRunbook, '## Gate 3: Incident Contacts and Escalation Confirmation');
  const signoff = parseSignoffFields(rawSignoff);

  const missing = [];
  const gate2LabelNormalized = gateLabels.gate2.toUpperCase();
  const gate2AcceptedLabels = options.requireProductionGate2
    ? ['PASS']
    : ['PASS', 'LOCAL_PASS'];
  const gate2Matched = gate2AcceptedLabels.some((label) => gate2LabelNormalized.startsWith(label));
  if (!gate2Matched) {
    missing.push(
      options.requireProductionGate2
        ? `Gate2 status is not PASS (current: ${gateLabels.gate2})`
        : `Gate2 status is not PASS/LOCAL_PASS (current: ${gateLabels.gate2})`
    );
  }
  for (const item of gate1Evidence) if (!item.filled) missing.push(`Gate1 evidence missing: ${item.label}`);
  for (const item of gate3Evidence) if (!item.filled) missing.push(`Gate3 evidence missing: ${item.label}`);
  if (!signoff.engineering) missing.push('Gate4 sign-off missing: Engineering name');
  if (!signoff.product) missing.push('Gate4 sign-off missing: Product name');
  if (!signoff.operations) missing.push('Gate4 sign-off missing: Operations name');
  if (!signoff.owner) missing.push('Gate4 sign-off missing: RC owner name');
  if (signoff.rcStatus.toUpperCase() !== 'APPROVED') missing.push(`Gate4 final status is not APPROVED (current: ${signoff.rcStatus || 'n/a'})`);

  const result = {
    generatedAt: new Date().toISOString(),
    gateLabels,
    counts: {
      gate1EvidenceFields: gate1Evidence.length,
      gate3EvidenceFields: gate3Evidence.length,
      missing: missing.length,
    },
    missing,
    strictPassed: missing.length === 0,
    gate2Policy: options.requireProductionGate2 ? 'PASS_ONLY' : 'PASS_OR_LOCAL_PASS',
  };

  if (options.output) {
    await writeFile(options.output, JSON.stringify(result, null, 2));
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('# RC External Gates Evidence Check');
    console.log(`- Gate labels: G1=${gateLabels.gate1} | G2=${gateLabels.gate2} | G3=${gateLabels.gate3} | G4=${gateLabels.gate4}`);
    console.log(`- Gate1 evidence fields: ${gate1Evidence.length}`);
    console.log(`- Gate3 evidence fields: ${gate3Evidence.length}`);
    if (missing.length === 0) {
      console.log('- Missing evidence: none');
    } else {
      console.log(`- Missing evidence count: ${missing.length}`);
      for (const item of missing) console.log(`  - ${item}`);
    }
    if (options.output) {
      console.log(`- JSON output: ${path.relative(process.cwd(), options.output)}`);
    }
  }

  if (options.strict && missing.length > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('[ops:rc:gates:evidence:check] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
