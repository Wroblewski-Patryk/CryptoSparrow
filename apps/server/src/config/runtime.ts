const defaultServerPort = 3001;
const defaultClientPort = 3002;

const parsePort = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBaseUrl = (value: string | undefined, fallbackOrigin: string) => {
  const candidate = value?.trim();
  if (!candidate) {
    return new URL(fallbackOrigin);
  }

  try {
    return new URL(candidate);
  } catch {
    return new URL(`http://${candidate}`);
  }
};

const withPort = (url: URL, port: number) => {
  if (!url.port) {
    url.port = String(port);
  }
  return url;
};

const toOrigin = (url: URL) => `${url.protocol}//${url.host}`;

export const serverPort = parsePort(process.env.SERVER_PORT, defaultServerPort);
export const clientPort = parsePort(process.env.CLIENT_PORT, defaultClientPort);

export const serverUrl = toOrigin(
  withPort(parseBaseUrl(process.env.SERVER_URL, 'http://localhost'), serverPort)
);
export const clientUrl = toOrigin(
  withPort(parseBaseUrl(process.env.CLIENT_URL, 'http://localhost'), clientPort)
);

const corsOriginsFromEnv = process.env.CORS_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOrigins = corsOriginsFromEnv?.length ? corsOriginsFromEnv : [clientUrl];
