import { loadEnv } from "./loadEnv";

loadEnv();

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

const parseOrigin = (value: string | undefined, fallbackOrigin: string) => {
  const candidate = value?.trim();
  if (!candidate) {
    return fallbackOrigin;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return new URL(`http://${candidate}`).origin;
  }
};

export const serverPort = parsePort(process.env.SERVER_PORT, defaultServerPort);
export const clientPort = parsePort(process.env.CLIENT_PORT, defaultClientPort);

export const serverUrl = toOrigin(
  withPort(parseBaseUrl(process.env.SERVER_URL, 'http://localhost'), serverPort)
);
export const clientUrl = toOrigin(
  withPort(parseBaseUrl(process.env.CLIENT_URL, 'http://localhost'), clientPort)
);
export const appUrl = parseOrigin(process.env.APP_URL, clientUrl);
export const uploadPublicOrigin = parseOrigin(
  process.env.UPLOAD_PUBLIC_ORIGIN,
  parseOrigin(process.env.APP_URL, serverUrl)
);

const corsOriginsFromEnv = process.env.CORS_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOrigins = corsOriginsFromEnv?.length ? corsOriginsFromEnv : [clientUrl];
