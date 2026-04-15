import { DomainError } from '../../lib/errors';

export const MARKET_ERROR_CODES = {
  universeUsedByActiveBot: 'MARKET_UNIVERSE_USED_BY_ACTIVE_BOT',
  universeLinkedRecords: 'MARKET_UNIVERSE_LINKED_RECORDS',
} as const;

type MarketErrorCode = (typeof MARKET_ERROR_CODES)[keyof typeof MARKET_ERROR_CODES];

export class MarketDomainError extends DomainError {
  constructor(code: MarketErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'MarketDomainError',
    });
  }
}

export const marketErrors = {
  universeUsedByActiveBot: () =>
    new MarketDomainError(MARKET_ERROR_CODES.universeUsedByActiveBot, 409),
  universeLinkedRecords: () =>
    new MarketDomainError(MARKET_ERROR_CODES.universeLinkedRecords, 409),
};
