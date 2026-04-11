import { normalizeSymbolsUnique } from "./symbols";

const normalizeBaseUrl = (value?: string) => {
  if (!value) return undefined;
  return value.replace(/\/+$/, "");
};

export const buildMarketStreamEventsUrl = (params: {
  symbols: string[];
  interval: string;
}) => {
  const symbols = normalizeSymbolsUnique(params.symbols);
  const query = new URLSearchParams({
    symbols: symbols.join(","),
    interval: params.interval,
  });
  const path = `/dashboard/market-stream/events?${query.toString()}`;
  const base = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  return base ? `${base}${path}` : path;
};

export const createMarketStreamEventSource = (params: {
  symbols: string[];
  interval: string;
}) => {
  const url = buildMarketStreamEventsUrl(params);
  const hasApiBase = Boolean(normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL));
  return hasApiBase ? new EventSource(url, { withCredentials: true }) : new EventSource(url);
};
