import { DomainError } from '../../lib/errors';

export const STRATEGY_ERROR_CODES = {
  usedByActiveBot: 'STRATEGY_USED_BY_ACTIVE_BOT',
  linkedRecords: 'STRATEGY_LINKED_RECORDS',
  invalidImportPayload: 'INVALID_STRATEGY_IMPORT_PAYLOAD',
} as const;

type StrategyErrorCode = (typeof STRATEGY_ERROR_CODES)[keyof typeof STRATEGY_ERROR_CODES];

export class StrategyDomainError extends DomainError {
  constructor(code: StrategyErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'StrategyDomainError',
    });
  }
}

export const strategyErrors = {
  usedByActiveBot: () =>
    new StrategyDomainError(STRATEGY_ERROR_CODES.usedByActiveBot, 409),
  linkedRecords: () =>
    new StrategyDomainError(STRATEGY_ERROR_CODES.linkedRecords, 409),
  invalidImportPayload: () =>
    new StrategyDomainError(STRATEGY_ERROR_CODES.invalidImportPayload, 400),
};
