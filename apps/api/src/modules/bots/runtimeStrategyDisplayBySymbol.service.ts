import { prisma } from '../../prisma/client';
import {
  hasAdvancedCloseMode,
  resolveDcaPlannedLevelsFromStrategyConfig,
  resolveTrailingStopLevelsFromStrategyConfig,
  resolveTrailingTakeProfitLevelsFromStrategyConfig,
} from './runtimeStrategyConfigParser.service';
import {
  TrailingStopDisplayLevel,
  TrailingTakeProfitDisplayLevel,
} from './runtimePositionSerialization.service';

const normalizeSymbols = (symbols: string[]) =>
  [...new Set(symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

const resolveUniverseSymbols = (whitelist: string[], blacklist: string[]) => {
  const normalizedWhitelist = normalizeSymbols(whitelist);
  const blacklistSet = new Set(normalizeSymbols(blacklist));
  return normalizedWhitelist.filter((symbol) => !blacklistSet.has(symbol));
};

const resolveEffectiveSymbolGroupSymbols = (params: {
  symbols?: string[] | null;
  marketUniverse?: { whitelist?: string[] | null; blacklist?: string[] | null } | null;
}) => {
  const whitelist = params.marketUniverse?.whitelist;
  const blacklist = params.marketUniverse?.blacklist;
  if (Array.isArray(whitelist) && Array.isArray(blacklist)) {
    const universeSymbols = resolveUniverseSymbols(whitelist, blacklist);
    if (universeSymbols.length > 0) {
      return universeSymbols;
    }
  }
  return normalizeSymbols(params.symbols ?? []);
};

export const resolveBotAdvancedCloseMode = async (userId: string, botId: string) => {
  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
        },
      },
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
      },
    }),
  ]);

  const configs = [
    ...groupLinks.map((item) => item.strategy.config),
    ...legacyLinks.map((item) => item.strategy.config),
  ];

  return configs.some((config) => hasAdvancedCloseMode(config));
};

export const resolveBotDcaPlanBySymbol = async (userId: string, botId: string, symbols: string[]) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const dcaPlanBySymbol = new Map<string, number[]>();
  if (normalizedSymbols.length === 0) return dcaPlanBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignPlanToSymbols = (targetSymbols: string[], config: unknown) => {
    const plannedLevels = resolveDcaPlannedLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      if (!dcaPlanBySymbol.has(symbol)) {
        dcaPlanBySymbol.set(symbol, plannedLevels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignPlanToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignPlanToSymbols(targetSymbols, link.strategy.config);
  }

  return dcaPlanBySymbol;
};

export const resolveBotTrailingStopLevelsBySymbol = async (
  userId: string,
  botId: string,
  symbols: string[]
) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const trailingLevelsBySymbol = new Map<string, TrailingStopDisplayLevel[]>();
  if (normalizedSymbols.length === 0) return trailingLevelsBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignLevelsToSymbols = (targetSymbols: string[], config: unknown) => {
    const levels = resolveTrailingStopLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      const existing = trailingLevelsBySymbol.get(symbol) ?? [];
      if (levels.length > 0 || existing.length === 0) {
        trailingLevelsBySymbol.set(symbol, levels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  return trailingLevelsBySymbol;
};

export const resolveBotTrailingTakeProfitLevelsBySymbol = async (
  userId: string,
  botId: string,
  symbols: string[]
) => {
  const normalizedSymbols = normalizeSymbols(symbols);
  const trailingLevelsBySymbol = new Map<string, TrailingTakeProfitDisplayLevel[]>();
  if (normalizedSymbols.length === 0) return trailingLevelsBySymbol;

  const [groupLinks, legacyLinks] = await Promise.all([
    prisma.marketGroupStrategyLink.findMany({
      where: {
        isEnabled: true,
        botMarketGroup: {
          botId,
          userId,
          isEnabled: true,
          lifecycleStatus: {
            in: ['ACTIVE', 'PAUSED'],
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        botMarketGroup: {
          select: {
            symbolGroup: {
              select: {
                symbols: true,
                marketUniverse: {
                  select: {
                    whitelist: true,
                    blacklist: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.botStrategy.findMany({
      where: {
        isEnabled: true,
        botId,
        bot: {
          userId,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        strategy: {
          select: {
            config: true,
          },
        },
        symbolGroup: {
          select: {
            symbols: true,
            marketUniverse: {
              select: {
                whitelist: true,
                blacklist: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const assignLevelsToSymbols = (targetSymbols: string[], config: unknown) => {
    const levels = resolveTrailingTakeProfitLevelsFromStrategyConfig(config);
    for (const symbol of targetSymbols) {
      if (!normalizedSymbols.includes(symbol)) continue;
      const existing = trailingLevelsBySymbol.get(symbol) ?? [];
      if (levels.length > 0 || existing.length === 0) {
        trailingLevelsBySymbol.set(symbol, levels);
      }
    }
  };

  for (const link of groupLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.botMarketGroup.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  for (const link of legacyLinks) {
    const assignedSymbols = resolveEffectiveSymbolGroupSymbols(link.symbolGroup);
    const targetSymbols = assignedSymbols.length > 0 ? assignedSymbols : normalizedSymbols;
    assignLevelsToSymbols(targetSymbols, link.strategy.config);
  }

  return trailingLevelsBySymbol;
};

