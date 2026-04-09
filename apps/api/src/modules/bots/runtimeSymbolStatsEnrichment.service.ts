export const buildLatestTradeAtBySymbol = (
  rows: Array<{ symbol: string; _max: { executedAt: Date | null } }>
) => new Map(rows.map((row) => [row.symbol, row._max.executedAt ?? null]));

type StrategySymbolsAssignment = {
  strategyId: string;
  symbols: string[];
};

export const buildConfiguredStrategyBySymbol = (params: {
  configuredBotStrategies: StrategySymbolsAssignment[];
  configuredMarketGroupStrategyLinks: StrategySymbolsAssignment[];
  symbols: string[];
  strategiesById: Map<string, unknown>;
}) => {
  const configuredStrategyBySymbol = new Map<string, string>();

  const assignStrategy = (assignment: StrategySymbolsAssignment) => {
    const strategyId = assignment.strategyId?.trim();
    if (!strategyId) return;
    const assignedSymbols = assignment.symbols;
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : params.symbols;
    for (const symbol of targetSymbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, strategyId);
      }
    }
  };

  for (const configuredBotStrategy of params.configuredBotStrategies) {
    assignStrategy(configuredBotStrategy);
  }
  for (const configuredLink of params.configuredMarketGroupStrategyLinks) {
    assignStrategy(configuredLink);
  }

  if (configuredStrategyBySymbol.size === 0 && params.strategiesById.size > 0) {
    const [fallbackStrategyId] = [...params.strategiesById.keys()];
    for (const symbol of params.symbols) {
      if (!configuredStrategyBySymbol.has(symbol)) {
        configuredStrategyBySymbol.set(symbol, fallbackStrategyId);
      }
    }
  }

  return configuredStrategyBySymbol;
};

type RuntimeOpenPosition = {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
};

export const buildOpenPositionSymbolMetrics = (params: {
  openPositions: RuntimeOpenPosition[];
  lastPriceBySymbol: Map<string, number | null>;
}) => {
  const openPositionCountBySymbol = new Map<string, number>();
  const openPositionQtyBySymbol = new Map<string, number>();
  const unrealizedPnlBySymbol = new Map<string, number>();

  for (const position of params.openPositions) {
    const lastPrice = params.lastPriceBySymbol.get(position.symbol);
    if (typeof lastPrice === 'number' && Number.isFinite(lastPrice)) {
      const sideMultiplier = position.side === 'LONG' ? 1 : -1;
      const pnl = (lastPrice - position.entryPrice) * position.quantity * sideMultiplier;
      unrealizedPnlBySymbol.set(
        position.symbol,
        (unrealizedPnlBySymbol.get(position.symbol) ?? 0) + pnl
      );
    }
    openPositionCountBySymbol.set(
      position.symbol,
      (openPositionCountBySymbol.get(position.symbol) ?? 0) + 1
    );
    openPositionQtyBySymbol.set(
      position.symbol,
      (openPositionQtyBySymbol.get(position.symbol) ?? 0) + position.quantity
    );
  }

  return {
    openPositionCountBySymbol,
    openPositionQtyBySymbol,
    unrealizedPnlBySymbol,
  };
};
