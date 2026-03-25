#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    statusPath: path.join(operationsDir, 'v1-rc-external-gates-status.md'),
    signoffPath: path.join(operationsDir, 'v1-rc-signoff-record.md'),
    checklistPath: path.join(operationsDir, 'v1-release-candidate-checklist.md'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--status-path') options.statusPath = args[index + 1] ?? options.statusPath;
    if (arg === '--signoff-path') options.signoffPath = args[index + 1] ?? options.signoffPath;
    if (arg === '--checklist-path') options.checklistPath = args[index + 1] ?? options.checklistPath;
  }

  options.statusPath = path.resolve(process.cwd(), options.statusPath);
  options.signoffPath = path.resolve(process.cwd(), options.signoffPath);
  options.checklistPath = path.resolve(process.cwd(), options.checklistPath);
  return options;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getGateLabel = (rawStatus, gateNumber) => {
  const regex = new RegExp(`- Gate ${gateNumber} \\(.+?\\):\\s*([^\\r\\n]+)`, 'i');
  const match = rawStatus.match(regex);
  return match?.[1]?.trim().toUpperCase() ?? 'OPEN';
};

const extractValueAfterLabel = (raw, label) => {
  const regex = new RegExp(`^\\s*${escapeRegExp(label)}\\s*(.*)$`, 'im');
  const match = raw.match(regex);
  return match?.[1]?.trim() ?? '';
};

const parseSignoff = (rawSignoff) => {
  const engineeringBlockMatch = rawSignoff.match(/- Engineering sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im);
  const productBlockMatch = rawSignoff.match(/- Product sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im);
  const operationsBlockMatch = rawSignoff.match(/- Operations sign-off:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im);
  const ownerBlockMatch = rawSignoff.match(/- RC owner with rollback authority:[\s\S]*?^\s*- Name:[ \t]*(.*)$/im);

  return {
    engineeringSigned: (engineeringBlockMatch?.[1]?.trim() ?? '').length > 0,
    productSigned: (productBlockMatch?.[1]?.trim() ?? '').length > 0,
    operationsSigned: (operationsBlockMatch?.[1]?.trim() ?? '').length > 0,
    ownerAssigned: (ownerBlockMatch?.[1]?.trim() ?? '').length > 0,
  };
};

const setChecklistCheckbox = (rawChecklist, label, checked) => {
  const regex = new RegExp(`^- \\[[ x]\\] ${escapeRegExp(label)}$`, 'm');
  const replacement = `- [${checked ? 'x' : ' '}] ${label}`;
  return rawChecklist.replace(regex, replacement);
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/syncRcChecklistFromGateStatus.mjs [--status-path <file>] [--signoff-path <file>] [--checklist-path <file>]'
    );
    process.exit(0);
  }

  const [rawStatus, rawSignoff, rawChecklist] = await Promise.all([
    readFile(options.statusPath, 'utf8'),
    readFile(options.signoffPath, 'utf8'),
    readFile(options.checklistPath, 'utf8'),
  ]);

  const gate1 = getGateLabel(rawStatus, 1);
  const gate2 = getGateLabel(rawStatus, 2);
  const gate3 = getGateLabel(rawStatus, 3);
  const signoff = parseSignoff(rawSignoff);

  let nextChecklist = rawChecklist;
  nextChecklist = setChecklistCheckbox(nextChecklist, 'Queue lag metrics reviewed and within baseline.', gate2 === 'PASS');
  nextChecklist = setChecklistCheckbox(
    nextChecklist,
    'Incident contacts and escalation chain confirmed.',
    gate3 === 'PASS'
  );
  nextChecklist = setChecklistCheckbox(nextChecklist, 'Backup snapshot created and restore path validated.', gate1 === 'PASS');
  nextChecklist = setChecklistCheckbox(nextChecklist, 'Engineering sign-off.', signoff.engineeringSigned);
  nextChecklist = setChecklistCheckbox(nextChecklist, 'Product sign-off.', signoff.productSigned);
  nextChecklist = setChecklistCheckbox(nextChecklist, 'Operations sign-off.', signoff.operationsSigned);
  nextChecklist = setChecklistCheckbox(nextChecklist, 'RC owner assigned with rollback authority.', signoff.ownerAssigned);

  await writeFile(options.checklistPath, nextChecklist);
  console.log(`RC checklist synced from gate status: ${path.relative(process.cwd(), options.checklistPath)}`);
};

main().catch((error) => {
  console.error('[ops:rc:checklist:sync] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
