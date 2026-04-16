import { DomainError } from '../../lib/errors';

export const BOT_ERROR_CODES = {
  liveConsentVersionRequired: 'LIVE_CONSENT_VERSION_REQUIRED',
  botStrategyNotFound: 'BOT_STRATEGY_NOT_FOUND',
  symbolGroupNotFound: 'SYMBOL_GROUP_NOT_FOUND',
  walletNotFound: 'WALLET_NOT_FOUND',
  walletMarketContextMismatch: 'WALLET_MARKET_CONTEXT_MISMATCH',
  walletLiveApiKeyRequired: 'WALLET_LIVE_API_KEY_REQUIRED',
  activeBotStrategyMarketGroupDuplicate: 'ACTIVE_BOT_STRATEGY_MARKET_GROUP_DUPLICATE',
  botNotFound: 'BOT_NOT_FOUND',
  botMarketGroupMarketTypeMismatch: 'BOT_MARKET_GROUP_MARKET_TYPE_MISMATCH',
  botMarketGroupExchangeMismatch: 'BOT_MARKET_GROUP_EXCHANGE_MISMATCH',
  botMarketGroupNotFound: 'BOT_MARKET_GROUP_NOT_FOUND',
  marketGroupStrategyAlreadyAttached: 'MARKET_GROUP_STRATEGY_ALREADY_ATTACHED',
  marketGroupStrategyLinkNotFound: 'MARKET_GROUP_STRATEGY_LINK_NOT_FOUND',
  subagentSlotOutOfRange: 'SUBAGENT_SLOT_OUT_OF_RANGE',
  positionCloseRiskAckRequired: 'POSITION_CLOSE_RISK_ACK_REQUIRED',
  botLiveApiKeyNotFound: 'BOT_LIVE_API_KEY_NOT_FOUND',
  botLiveApiKeyExchangeMismatch: 'BOT_LIVE_API_KEY_EXCHANGE_MISMATCH',
} as const;

type BotErrorCode = (typeof BOT_ERROR_CODES)[keyof typeof BOT_ERROR_CODES];

export class BotDomainError extends DomainError {
  constructor(code: BotErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'BotDomainError',
    });
  }
}

export const botErrors = {
  liveConsentVersionRequired: () =>
    new BotDomainError(BOT_ERROR_CODES.liveConsentVersionRequired, 400),
  botStrategyNotFound: () => new BotDomainError(BOT_ERROR_CODES.botStrategyNotFound, 400),
  symbolGroupNotFound: () => new BotDomainError(BOT_ERROR_CODES.symbolGroupNotFound, 400),
  walletNotFound: () => new BotDomainError(BOT_ERROR_CODES.walletNotFound, 400),
  walletMarketContextMismatch: (details?: Record<string, unknown>) =>
    new BotDomainError(BOT_ERROR_CODES.walletMarketContextMismatch, 400, details),
  walletLiveApiKeyRequired: () =>
    new BotDomainError(BOT_ERROR_CODES.walletLiveApiKeyRequired, 400),
  activeBotStrategyMarketGroupDuplicate: () =>
    new BotDomainError(BOT_ERROR_CODES.activeBotStrategyMarketGroupDuplicate, 409),
  botNotFound: () => new BotDomainError(BOT_ERROR_CODES.botNotFound, 404),
  botMarketGroupMarketTypeMismatch: () =>
    new BotDomainError(BOT_ERROR_CODES.botMarketGroupMarketTypeMismatch, 400),
  botMarketGroupExchangeMismatch: () =>
    new BotDomainError(BOT_ERROR_CODES.botMarketGroupExchangeMismatch, 400),
  botMarketGroupNotFound: () => new BotDomainError(BOT_ERROR_CODES.botMarketGroupNotFound, 404),
  marketGroupStrategyAlreadyAttached: () =>
    new BotDomainError(BOT_ERROR_CODES.marketGroupStrategyAlreadyAttached, 409),
  marketGroupStrategyLinkNotFound: () =>
    new BotDomainError(BOT_ERROR_CODES.marketGroupStrategyLinkNotFound, 400),
  subagentSlotOutOfRange: () => new BotDomainError(BOT_ERROR_CODES.subagentSlotOutOfRange, 400),
  positionCloseRiskAckRequired: () =>
    new BotDomainError(BOT_ERROR_CODES.positionCloseRiskAckRequired, 400),
  botLiveApiKeyNotFound: () => new BotDomainError(BOT_ERROR_CODES.botLiveApiKeyNotFound, 404),
  botLiveApiKeyExchangeMismatch: () =>
    new BotDomainError(BOT_ERROR_CODES.botLiveApiKeyExchangeMismatch, 400),
};
