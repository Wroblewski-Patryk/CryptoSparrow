import { Exchange } from '@prisma/client';
import { assertExchangeCapability } from '../exchange/exchangeCapabilities';

export const assertBotActivationExchangeCapability = (params: {
  exchange: Exchange;
  mode: 'PAPER' | 'LIVE';
}) => {
  if (params.mode === 'LIVE') {
    assertExchangeCapability(params.exchange, 'LIVE_EXECUTION');
    return;
  }
  assertExchangeCapability(params.exchange, 'PAPER_PRICING_FEED');
};
