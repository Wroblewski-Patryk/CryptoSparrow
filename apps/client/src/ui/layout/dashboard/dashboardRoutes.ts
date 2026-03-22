export const dashboardRoutes = {
  home: "/dashboard",
  exchanges: {
    root: "/dashboard/exchanges",
    orders: "/dashboard/orders",
    positions: "/dashboard/positions",
  },
  markets: {
    root: "/dashboard/markets",
    list: "/dashboard/markets/list",
    create: "/dashboard/markets/create",
  },
  strategies: {
    root: "/dashboard/strategies",
    list: "/dashboard/strategies/list",
    create: "/dashboard/strategies/create",
  },
  backtests: {
    root: "/dashboard/backtests",
    list: "/dashboard/backtests/list",
    create: "/dashboard/backtests/create",
  },
  bots: {
    root: "/dashboard/bots",
  },
  analytics: {
    reports: "/dashboard/reports",
    logs: "/dashboard/logs",
  },
} as const;

export const dashboardLegacyAliases = {
  backtests: ["/dashboard/backtest", "/dashboard/backtest/add"],
  strategies: ["/dashboard/strategies/add", "/dashboard/builder"],
} as const;

export const pathStartsWithAny = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

