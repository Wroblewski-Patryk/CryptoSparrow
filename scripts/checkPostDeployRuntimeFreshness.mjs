#!/usr/bin/env node

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.DEPLOY_FRESHNESS_API_BASE_URL ?? 'http://localhost:3001',
    authToken: process.env.DEPLOY_FRESHNESS_AUTH_TOKEN ?? '',
    timeoutMs: Number.parseInt(process.env.DEPLOY_FRESHNESS_TIMEOUT_MS ?? '10000', 10),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return options;
    }
    if (arg === '--base-url') options.baseUrl = args[index + 1] ?? options.baseUrl;
    if (arg === '--auth-token') options.authToken = args[index + 1] ?? options.authToken;
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number.parseInt(args[index + 1] ?? String(options.timeoutMs), 10);
    }
  }

  return options;
};

const printUsage = () => {
  console.log(
    'Usage: node scripts/checkPostDeployRuntimeFreshness.mjs [--base-url <url>] [--auth-token <token>] [--timeout-ms <ms>]'
  );
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const target = `${baseUrl}/workers/runtime-freshness`;
  const headers = options.authToken
    ? {
        Authorization: `Bearer ${options.authToken}`,
      }
    : {};

  const response = await fetchWithTimeout(
    target,
    {
      method: 'GET',
      headers,
    },
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 10000
  );

  if (!response.ok) {
    throw new Error(`runtime freshness request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const status = String(payload?.status ?? 'UNKNOWN').toUpperCase();
  if (status !== 'PASS') {
    console.log('[ops:deploy:runtime-freshness] status:', status);
    console.log(
      '[ops:deploy:runtime-freshness] checks:',
      JSON.stringify(payload?.checks ?? {}, null, 2)
    );
    throw new Error('runtime freshness gate failed');
  }

  console.log('[ops:deploy:runtime-freshness] PASS');
  console.log(
    '[ops:deploy:runtime-freshness] checks:',
    JSON.stringify(payload?.checks ?? {}, null, 2)
  );
};

main().catch((error) => {
  console.error(
    '[ops:deploy:runtime-freshness] failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
