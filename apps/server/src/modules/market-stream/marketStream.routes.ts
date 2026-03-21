import { Response, Router } from 'express';
import { MarketStreamEvent } from './binanceStream.types';
import { subscribeMarketStreamEvents } from './marketStreamFanout';

const marketStreamRouter = Router();

const parseSymbols = (raw: unknown) => {
  if (typeof raw !== 'string') return new Set<string>();
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0)
  );
};

const sendEvent = (res: Response, type: string, payload: unknown) => {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

marketStreamRouter.get('/events', async (req, res) => {
  const symbols = parseSymbols(req.query.symbols);
  const interval = typeof req.query.interval === 'string' ? req.query.interval.trim() : '1m';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let lastEventAt: number | null = null;
  let connected = true;

  const forwardEvent = (event: MarketStreamEvent) => {
    if (symbols.size > 0 && !symbols.has(event.symbol)) return;
    if (event.type === 'candle' && event.interval !== interval) return;

    lastEventAt = Date.now();
    sendEvent(res, event.type, event);
  };

  let unsubscribe: () => Promise<void> = async () => {};
  try {
    unsubscribe = await subscribeMarketStreamEvents(forwardEvent);
  } catch {
    connected = false;
  }

  sendEvent(res, 'health', {
    connected,
    lastEventAt,
    lagMs: null,
  });

  const heartbeat = setInterval(() => {
    sendEvent(res, 'health', {
      connected,
      lastEventAt,
      lagMs: lastEventAt ? Math.max(0, Date.now() - lastEventAt) : null,
    });
  }, 10_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    void unsubscribe();
    res.end();
  });
});

export default marketStreamRouter;
