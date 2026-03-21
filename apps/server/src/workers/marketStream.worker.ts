import { BinanceMarketStreamWorker } from '../modules/market-stream/binanceStream.service';
import { publishMarketStreamEvent } from '../modules/market-stream/marketStreamFanout';
import { bootstrapWorker } from './workerBootstrap';

const parseCsv = (value: string | undefined, fallback: string[]) => {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items && items.length > 0 ? items : fallback;
};

bootstrapWorker({
  workerName: 'market-stream',
});

const worker = new BinanceMarketStreamWorker({
  streamUrl: process.env.BINANCE_STREAM_URL,
  symbols: parseCsv(process.env.MARKET_STREAM_SYMBOLS, ['BTCUSDT', 'ETHUSDT']),
  candleIntervals: parseCsv(process.env.MARKET_STREAM_INTERVALS, ['1m']),
  onEvent: publishMarketStreamEvent,
});

worker.start();
