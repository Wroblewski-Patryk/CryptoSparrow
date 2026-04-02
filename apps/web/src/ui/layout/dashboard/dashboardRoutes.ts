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
    list: "/dashboard/bots",
    create: "/dashboard/bots/create",
  },
  analytics: {
    reports: "/dashboard/reports",
    logs: "/dashboard/logs",
  },
} as const;

export const pathStartsWithAny = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
