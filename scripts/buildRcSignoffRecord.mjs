#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const operationsDir = path.resolve(process.cwd(), 'docs', 'operations');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    releaseTarget: 'v1.0.0',
    statusPath: path.join(operationsDir, 'v1-rc-external-gates-status.md'),
    output: path.join(operationsDir, 'v1-rc-signoff-record.md'),
    engineeringName: '',
    productName: '',
    operationsName: '',
    ownerName: '',
    ownerContact: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--release-target') options.releaseTarget = args[index + 1] ?? options.releaseTarget;
    if (arg === '--status-path') options.statusPath = args[index + 1] ?? options.statusPath;
    if (arg === '--output') options.output = args[index + 1] ?? options.output;
    if (arg === '--engineering-name') options.engineeringName = args[index + 1] ?? options.engineeringName;
    if (arg === '--product-name') options.productName = args[index + 1] ?? options.productName;
    if (arg === '--operations-name') options.operationsName = args[index + 1] ?? options.operationsName;
    if (arg === '--owner-name') options.ownerName = args[index + 1] ?? options.ownerName;
    if (arg === '--owner-contact') options.ownerContact = args[index + 1] ?? options.ownerContact;
  }

  options.statusPath = path.resolve(process.cwd(), options.statusPath);
  options.output = path.resolve(process.cwd(), options.output);
  return options;
};

const parseGateLine = (line) => {
  const match = line.match(/-\s+Gate\s+\d+\s+\(.+?\):\s+([A-Z_]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
};

const loadGateStatuses = async (statusPath) => {
  const raw = await readFile(statusPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const statuses = lines.map(parseGateLine).filter(Boolean);
  return {
    statuses,
    allPass: statuses.length === 4 && statuses.every((status) => status === 'PASS'),
  };
};

const approvalLine = (role, name) => {
  const now = new Date().toISOString();
  if (!name) {
    return `- ${role} sign-off:\n  - Name:\n  - UTC timestamp:\n  - Notes:`;
  }
  return `- ${role} sign-off:\n  - Name: ${name}\n  - UTC timestamp: ${now}\n  - Notes: approved via scripted record build`;
};

const ownerBlock = (name, contact) => {
  const now = new Date().toISOString();
  if (!name) {
    return `- RC owner with rollback authority:\n  - Name:\n  - Contact:\n  - UTC assignment timestamp:`;
  }
  return `- RC owner with rollback authority:\n  - Name: ${name}\n  - Contact: ${contact || 'TBD'}\n  - UTC assignment timestamp: ${now}`;
};

const render = (options, gates) => {
  const hasAllApprovers = Boolean(
    options.engineeringName && options.productName && options.operationsName && options.ownerName
  );
  const rcStatus = gates.allPass && hasAllApprovers ? 'APPROVED' : 'BLOCKED';

  return `# V1 RC Sign-Off Record

Release target: \`${options.releaseTarget}\`  
Date (UTC): \`${new Date().toISOString()}\`

## Gate Evidence References
- RC checklist: \`docs/operations/v1-release-candidate-checklist.md\`
- External gates runbook: \`docs/operations/v1-rc-external-gates-runbook.md\`
- External gates status source: \`${path.relative(process.cwd(), options.statusPath)}\`

## Sign-Offs
${approvalLine('Engineering', options.engineeringName)}
${approvalLine('Product', options.productName)}
${approvalLine('Operations', options.operationsName)}

## RC Ownership
${ownerBlock(options.ownerName, options.ownerContact)}

## Gate Snapshot at Sign-Off Build
- Gate statuses found: ${gates.statuses.length}
- Gate values: ${gates.statuses.length > 0 ? gates.statuses.join(', ') : 'n/a'}
- All gates pass: ${gates.allPass ? 'yes' : 'no'}

## Final Decision
- RC status: \`${rcStatus}\`
- Blocking reasons (if any): ${rcStatus === 'BLOCKED' ? 'missing gate pass and/or required approvers' : 'none'}
- Follow-up actions:
  - If BLOCKED: complete open gates and rerun \`pnpm run ops:rc:signoff:build\`.
  - If APPROVED: copy this record into release notes and finalize launch trigger.
`;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(
      'Usage: node scripts/buildRcSignoffRecord.mjs [--release-target <v>] [--status-path <file>] [--output <file>] [--engineering-name <name>] [--product-name <name>] [--operations-name <name>] [--owner-name <name>] [--owner-contact <contact>]'
    );
    process.exit(0);
  }

  const gates = await loadGateStatuses(options.statusPath);
  const content = render(options, gates);
  await writeFile(options.output, content);
  console.log(`RC sign-off record written to: ${path.relative(process.cwd(), options.output)}`);
};

main().catch((error) => {
  console.error('[ops:rc:signoff:build] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
