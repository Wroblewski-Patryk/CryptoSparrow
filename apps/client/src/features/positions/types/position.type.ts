export type PositionStatus = "OPEN" | "CLOSED" | "LIQUIDATED";
export type PositionSide = "LONG" | "SHORT" | string;

export type Position = {
  id: string;
  symbol: string;
  side: PositionSide;
  status: PositionStatus;
  entryPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  openedAt?: string;
};

export type ListPositionsQuery = {
  status?: PositionStatus;
  symbol?: string;
  limit?: number;
};

export type ExchangeSnapshotPosition = {
  symbol: string;
  side: string | null;
  contracts: number;
  entryPrice: number | null;
  markPrice: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginMode: string | null;
  liquidationPrice: number | null;
  timestamp: string | null;
};

export type ExchangePositionsSnapshot = {
  source: "BINANCE";
  syncedAt: string;
  positions: ExchangeSnapshotPosition[];
};
