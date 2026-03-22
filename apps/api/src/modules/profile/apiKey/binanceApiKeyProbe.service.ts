type BinanceMarketType = "spot" | "future";

export type BinanceApiKeyProbeInput = {
  apiKey: string;
  apiSecret: string;
};

export type BinanceApiKeyTestCode =
  | "OK"
  | "INVALID_KEY"
  | "INVALID_SECRET"
  | "IP_RESTRICTED"
  | "MISSING_SPOT_SCOPE"
  | "MISSING_FUTURES_SCOPE"
  | "NETWORK_TIMEOUT"
  | "UNKNOWN";

export type BinanceApiKeyProbeResult = {
  ok: boolean;
  code: BinanceApiKeyTestCode;
  message: string;
  permissions: {
    spot: boolean;
    futures: boolean;
  };
};

export interface BinanceClientLike {
  fetchBalance: (params?: Record<string, unknown>) => Promise<unknown>;
  close?: () => Promise<void>;
}

type BinanceClientFactory = (
  marketType: BinanceMarketType,
  input: BinanceApiKeyProbeInput
) => Promise<BinanceClientLike>;

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
};

const mapBinanceError = (error: unknown, scope: BinanceMarketType): BinanceApiKeyTestCode => {
  const message = toErrorMessage(error);

  if (
    message.includes("invalid api-key") ||
    message.includes("api-key format invalid") ||
    message.includes("api key format invalid")
  ) {
    return "INVALID_KEY";
  }

  if (
    message.includes("signature for this request is not valid") ||
    message.includes("invalid signature")
  ) {
    return "INVALID_SECRET";
  }

  if (
    message.includes("unauthorized ip") ||
    message.includes("ip not in whitelist") ||
    message.includes("invalid ip")
  ) {
    return "IP_RESTRICTED";
  }

  if (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("network error")
  ) {
    return "NETWORK_TIMEOUT";
  }

  if (
    message.includes("permission") ||
    message.includes("not authorized") ||
    message.includes("insufficient")
  ) {
    return scope === "future" ? "MISSING_FUTURES_SCOPE" : "MISSING_SPOT_SCOPE";
  }

  return "UNKNOWN";
};

const formatProbeMessage = (code: BinanceApiKeyTestCode) => {
  switch (code) {
    case "OK":
      return "Binance API key permissions validated.";
    case "INVALID_KEY":
      return "Binance rejected API key format or value.";
    case "INVALID_SECRET":
      return "Binance rejected API secret/signature.";
    case "IP_RESTRICTED":
      return "Binance rejected request due to IP restriction.";
    case "MISSING_SPOT_SCOPE":
      return "Binance key has no Spot permission.";
    case "MISSING_FUTURES_SCOPE":
      return "Binance key has no Futures permission.";
    case "NETWORK_TIMEOUT":
      return "Binance connection timed out.";
    default:
      return "Binance validation failed.";
  }
};

const defaultClientFactory: BinanceClientFactory = async (marketType, input) => {
  const ccxtModule = (await import("ccxt")) as unknown as {
    binance: new (config: Record<string, unknown>) => BinanceClientLike;
  };
  const client = new ccxtModule.binance({
    apiKey: input.apiKey,
    secret: input.apiSecret,
    enableRateLimit: true,
    options: {
      defaultType: marketType,
    },
  });
  return client;
};

const probeScope = async (
  marketType: BinanceMarketType,
  input: BinanceApiKeyProbeInput,
  clientFactory: BinanceClientFactory
) => {
  const client = await clientFactory(marketType, input);
  try {
    await client.fetchBalance();
  } finally {
    if (typeof client.close === "function") {
      await client.close();
    }
  }
};

export const probeBinanceApiKeyPermissions = async (
  input: BinanceApiKeyProbeInput,
  clientFactory: BinanceClientFactory = defaultClientFactory
): Promise<BinanceApiKeyProbeResult> => {
  const permissions = {
    spot: false,
    futures: false,
  };

  try {
    await probeScope("spot", input, clientFactory);
    permissions.spot = true;
  } catch (error) {
    const code = mapBinanceError(error, "spot");
    return {
      ok: false,
      code,
      message: formatProbeMessage(code),
      permissions,
    };
  }

  try {
    await probeScope("future", input, clientFactory);
    permissions.futures = true;
  } catch (error) {
    const code = mapBinanceError(error, "future");
    return {
      ok: false,
      code,
      message: formatProbeMessage(code),
      permissions,
    };
  }

  return {
    ok: true,
    code: "OK",
    message: formatProbeMessage("OK"),
    permissions,
  };
};
