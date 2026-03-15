export type PositionStatus = "OPEN" | "CLOSED" | "LIQUIDATED";
export type PositionSide = "LONG" | "SHORT";

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

