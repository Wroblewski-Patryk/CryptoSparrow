import { DomainError } from '../../lib/errors';

export const WALLET_ERROR_CODES = {
  liveApiKeyRequired: 'WALLET_LIVE_API_KEY_REQUIRED',
  liveApiKeyExchangeMismatch: 'WALLET_LIVE_API_KEY_EXCHANGE_MISMATCH',
  inUseCannotDelete: 'WALLET_IN_USE_CANNOT_DELETE',
  previewApiKeyNotFound: 'WALLET_PREVIEW_API_KEY_NOT_FOUND',
  previewFetchFailed: 'WALLET_PREVIEW_FETCH_FAILED',
} as const;

type WalletErrorCode = (typeof WALLET_ERROR_CODES)[keyof typeof WALLET_ERROR_CODES];

export class WalletDomainError extends DomainError {
  constructor(code: WalletErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'WalletDomainError',
    });
  }
}

export const walletErrors = {
  liveApiKeyRequired: () =>
    new WalletDomainError(WALLET_ERROR_CODES.liveApiKeyRequired, 400),
  liveApiKeyExchangeMismatch: () =>
    new WalletDomainError(WALLET_ERROR_CODES.liveApiKeyExchangeMismatch, 400),
  inUseCannotDelete: () =>
    new WalletDomainError(WALLET_ERROR_CODES.inUseCannotDelete, 409),
  previewApiKeyNotFound: () =>
    new WalletDomainError(WALLET_ERROR_CODES.previewApiKeyNotFound, 404),
  previewFetchFailed: () =>
    new WalletDomainError(WALLET_ERROR_CODES.previewFetchFailed, 502),
};
