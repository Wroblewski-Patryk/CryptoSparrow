import process from 'node:process';

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  process.stdout.write(
    [
      'Usage: node scripts/deploySmokeCheck.mjs [--no-workers]',
      '',
      'Env:',
      '  SMOKE_API_BASE_URL       (default: http://localhost:3001)',
      '  SMOKE_WEB_BASE_URL       (default: http://localhost:3002)',
      '  SMOKE_TIMEOUT_MS         (default: 8000)',
      '  SMOKE_REQUIRE_WORKERS    (default: true)',
    ].join('\n') + '\n',
  );
  process.exit(0);
}

const apiBase = (process.env.SMOKE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
const webBase = (process.env.SMOKE_WEB_BASE_URL || 'http://localhost:3002').replace(/\/+$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const requireWorkers =
  !args.has('--no-workers') && String(process.env.SMOKE_REQUIRE_WORKERS || 'true').toLowerCase() !== 'false';

const checks = [
  { name: 'API /health', url: `${apiBase}/health`, method: 'GET' },
  { name: 'API /ready', url: `${apiBase}/ready`, method: 'GET' },
  { name: 'WEB /', url: `${webBase}/`, method: 'GET' },
];

if (requireWorkers) {
  checks.push({ name: 'API /workers/health', url: `${apiBase}/workers/health`, method: 'GET' });
}

const runCheck = async (check) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(check.url, {
      method: check.method,
      signal: controller.signal,
    });
    if (response.status >= 200 && response.status < 400) {
      return { ok: true, detail: `${response.status}` };
    }
    return { ok: false, detail: `status ${response.status}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
};

const results = [];
for (const check of checks) {
  // eslint-disable-next-line no-await-in-loop
  const result = await runCheck(check);
  results.push({ ...check, ...result });
}

process.stdout.write('[deploy-smoke] summary\n');
for (const row of results) {
  const icon = row.ok ? 'PASS' : 'FAIL';
  process.stdout.write(`- ${icon} ${row.name} -> ${row.detail}\n`);
}

const failed = results.filter((x) => !x.ok);
if (failed.length > 0) {
  process.stderr.write(`[deploy-smoke] failed checks: ${failed.length}\n`);
  process.exit(1);
}

process.stdout.write('[deploy-smoke] all checks passed\n');
