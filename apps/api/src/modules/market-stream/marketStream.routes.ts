import { Response, Router } from 'express';
import { MarketStreamEvent } from './binanceStream.types';
import { subscribeMarketStreamEvents } from './marketStreamFanout';
import { sendError } from '../../utils/apiError';
import { normalizeSymbols } from '../../lib/symbols';

const marketStreamRouter = Router();
export const MARKET_STREAM_MAX_SYMBOLS = 20;
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEALTH_INTERVAL_MS = 15_000;

export const parseSymbols = (raw: unknown) => {
  if (typeof raw !== 'string') return new Set<string>();
  return new Set(normalizeSymbols(raw.split(',')));
};

export const formatSseEvent = (id: number, type: string, payload: unknown) => {
  return `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
};

export const formatSseComment = (comment: string) => {
  return `: ${comment}\n\n`;
};

const sendEvent = (res: Response, id: number, type: string, payload: unknown) => {
  res.write(formatSseEvent(id, type, payload));
};

const sendComment = (res: Response, comment: string) => {
  res.write(formatSseComment(comment));
};

marketStreamRouter.get('/events', async (req, res) => {
  const symbols = parseSymbols(req.query.symbols);
  if (symbols.size > MARKET_STREAM_MAX_SYMBOLS) {
    return sendError(res, 400, 'Validation failed', [
      {
        field: 'symbols',
        message: `Maximum ${MARKET_STREAM_MAX_SYMBOLS} symbols allowed`,
      },
    ]);
  }

  const interval = typeof req.query.interval === 'string' ? req.query.interval.trim() : '1m';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastEventAt: number | null = null;
  let connected = true;
  let eventId = 0;

  const nextEventId = () => {
    eventId += 1;
    return eventId;
  };

  const sendHealth = () => {
    sendEvent(res, nextEventId(), 'health', {
      type: 'health',
      connected,
      lastEventAt,
      lagMs: lastEventAt ? Math.max(0, Date.now() - lastEventAt) : null,
      worker: 'market-stream',
    });
  };

  const forwardEvent = (event: MarketStreamEvent) => {
    if (symbols.size > 0 && !symbols.has(event.symbol)) return;
    if (event.type === 'candle' && event.interval !== interval) return;

    lastEventAt = Date.now();
    sendEvent(res, nextEventId(), event.type, event);
  };

  let unsubscribe: () => Promise<void> = async () => {};
  try {
    unsubscribe = await subscribeMarketStreamEvents(forwardEvent);
  } catch {
    connected = false;
  }

  sendHealth();

  const pingHeartbeat = setInterval(() => {
    sendComment(res, 'ping');
  }, HEARTBEAT_INTERVAL_MS);

  const healthHeartbeat = setInterval(() => {
    sendHealth();
  }, HEALTH_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(pingHeartbeat);
    clearInterval(healthHeartbeat);
    void unsubscribe();
    res.end();
  });
});

export default marketStreamRouter;
