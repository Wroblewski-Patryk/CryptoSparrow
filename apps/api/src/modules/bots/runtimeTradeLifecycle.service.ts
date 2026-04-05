export type RuntimeTradeLifecycleAction = 'OPEN' | 'DCA' | 'CLOSE' | 'UNKNOWN';

type PositionMetaRow = {
  id: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
};

type PositionTradeRow = {
  id: string;
  positionId: string | null;
  side: 'BUY' | 'SELL';
};

export const toPositionMetaById = (rows: PositionMetaRow[]) => {
  const positionMetaById = new Map<string, { side: 'LONG' | 'SHORT'; leverage: number; entryPrice: number }>();
  for (const row of rows) {
    positionMetaById.set(row.id, {
      side: row.side,
      leverage: row.leverage,
      entryPrice: row.entryPrice,
    });
  }
  return positionMetaById;
};

export const buildLifecycleActionByTradeId = (params: {
  positionMetaById: Map<string, { side: 'LONG' | 'SHORT'; leverage: number; entryPrice: number }>;
  positionTrades: PositionTradeRow[];
}) => {
  const lifecycleActionByTradeId = new Map<string, RuntimeTradeLifecycleAction>();
  const tradesByPosition = new Map<string, Array<{ id: string; side: 'BUY' | 'SELL' }>>();

  for (const trade of params.positionTrades) {
    if (!trade.positionId) continue;
    const bucket = tradesByPosition.get(trade.positionId) ?? [];
    bucket.push({
      id: trade.id,
      side: trade.side,
    });
    tradesByPosition.set(trade.positionId, bucket);
  }

  for (const [positionId, trades] of tradesByPosition.entries()) {
    const positionMeta = params.positionMetaById.get(positionId);
    if (!positionMeta) continue;
    const entrySide: 'BUY' | 'SELL' = positionMeta.side === 'LONG' ? 'BUY' : 'SELL';
    let entryLegs = 0;
    for (const trade of trades) {
      if (trade.side === entrySide) {
        lifecycleActionByTradeId.set(trade.id, entryLegs === 0 ? 'OPEN' : 'DCA');
        entryLegs += 1;
        continue;
      }
      lifecycleActionByTradeId.set(trade.id, 'CLOSE');
    }
  }

  return lifecycleActionByTradeId;
};

