import type { DataTableColumn } from "../../../../ui/components/DataTable";
import type { ReactNode } from "react";
import type {
  Bot,
  BotRuntimeGraph,
  BotRuntimePositionItem,
  BotRuntimePositionsResponse,
  BotRuntimeSessionListItem,
  BotRuntimeSymbolStat,
  BotRuntimeSymbolStatsResponse,
  BotRuntimeTrade,
  BotRuntimeTradesResponse,
} from "../../../../features/bots/types/bot.type";

export type RuntimeSnapshot = {
  bot: Bot;
  session: BotRuntimeSessionListItem | null;
  symbolStats: BotRuntimeSymbolStatsResponse | null;
  positions: BotRuntimePositionsResponse | null;
  runtimeGraph: BotRuntimeGraph | null;
  loadError?: string;
};

export type OpenPositionWithLive = BotRuntimePositionItem & {
  liveMarkPrice: number | null;
  liveUnrealizedPnl: number;
  livePnlPct: number | null;
  marginNotional: number;
  fallbackTtpProtectedPercent?: number | null;
  runtimeBotId?: string;
  runtimeSessionId?: string | null;
};

export type SignalPillValue = "LONG" | "SHORT" | "EXIT" | "NEUTRAL";

export type RuntimeDataTab = "OPEN_POSITIONS" | "OPEN_ORDERS" | "TRADE_HISTORY";

export type TradeSortBy =
  | "executedAt"
  | "symbol"
  | "side"
  | "lifecycleAction"
  | "margin"
  | "fee"
  | "realizedPnl";

export type TradeSortDir = "asc" | "desc";
export type TradeSideFilter = "ALL" | "BUY" | "SELL";
export type TradeActionFilter = "ALL" | "OPEN" | "DCA" | "CLOSE";

export type TradeFiltersState = {
  symbol: string;
  side: TradeSideFilter;
  action: TradeActionFilter;
  from: string;
  to: string;
};

export type RuntimeSymbolWithLive = BotRuntimeSymbolStat & {
  liveLastPrice: number | null;
  liveOpenPositionQty: number;
  liveUnrealizedPnl: number;
};

export type RuntimeSelectedData = {
  session: BotRuntimeSessionListItem | null;
  symbols: RuntimeSymbolWithLive[];
  open: OpenPositionWithLive[];
  usedMargin: number;
  unrealized: number;
  realized: number;
  net: number;
  wins: number;
  losses: number;
  winRate: number | null;
  paperInit: number | null;
  equity: number | null;
  free: number | null;
  exposurePct: number | null;
  trades: BotRuntimeTrade[];
  drawdown: { abs: number; pct: number | null };
};

export type RuntimeSummary = {
  openPositions: number;
  usedMargin: number;
  realized: number;
  unrealized: number;
  totalSignals: number;
  dcaCount: number;
  paperStart: number;
  paperDelta: number;
  paperEquity: number;
};

export type RuntimeTradeMeta = BotRuntimeTradesResponse["meta"];

export type RuntimeTabItem = {
  key: RuntimeDataTab;
  hash: string;
  label: string;
  icon: ReactNode;
};

export type OpenPositionsTableColumn = DataTableColumn<OpenPositionWithLive>;
export type TradesTableColumn = DataTableColumn<BotRuntimeTrade>;
