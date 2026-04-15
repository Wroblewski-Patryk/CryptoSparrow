import { DomainError } from '../../lib/errors';

export const ORDER_ERROR_CODES = {
  liveRiskAckRequired: 'LIVE_RISK_ACK_REQUIRED',
  liveBotRequired: 'LIVE_BOT_REQUIRED',
  liveBotNotFound: 'LIVE_BOT_NOT_FOUND',
  liveBotModeRequired: 'LIVE_BOT_MODE_REQUIRED',
  liveBotOptInRequired: 'LIVE_BOT_OPT_IN_REQUIRED',
  liveBotActiveRequired: 'LIVE_BOT_ACTIVE_REQUIRED',
  liveApiKeyRequired: 'LIVE_API_KEY_REQUIRED',
  liveOrderTypeUnsupported: 'LIVE_ORDER_TYPE_UNSUPPORTED',
  liveExecutionFailed: 'LIVE_EXECUTION_FAILED',
  livePretradeMarginLeverageConvergenceFailed: 'LIVE_PRETRADE_MARGIN_LEVERAGE_CONVERGENCE_FAILED',
  livePretradeInvalidQuantity: 'LIVE_PRETRADE_INVALID_QUANTITY',
  livePretradeExternalPositionOpen: 'LIVE_PRETRADE_EXTERNAL_POSITION_OPEN',
  livePretradeAmountBelowMin: 'LIVE_PRETRADE_AMOUNT_BELOW_MIN',
  livePretradeAmountPrecision: 'LIVE_PRETRADE_AMOUNT_PRECISION',
  livePretradeNotionalBelowMin: 'LIVE_PRETRADE_NOTIONAL_BELOW_MIN',
  orderNotCancelable: 'ORDER_NOT_CANCELABLE',
  orderCancelRiskAckRequired: 'ORDER_CANCEL_RISK_ACK_REQUIRED',
  orderCloseRiskAckRequired: 'ORDER_CLOSE_RISK_ACK_REQUIRED',
  orderNotClosable: 'ORDER_NOT_CLOSABLE',
} as const;

type OrderErrorCode = (typeof ORDER_ERROR_CODES)[keyof typeof ORDER_ERROR_CODES];

export class OrderDomainError extends DomainError {
  constructor(code: OrderErrorCode, status: number, details?: Record<string, unknown>) {
    super(code, code, {
      status,
      details,
      name: 'OrderDomainError',
    });
  }
}

export const orderErrors = {
  liveRiskAckRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveRiskAckRequired, 400),
  liveBotRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveBotRequired, 400),
  liveBotNotFound: () => new OrderDomainError(ORDER_ERROR_CODES.liveBotNotFound, 404),
  liveBotModeRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveBotModeRequired, 400),
  liveBotOptInRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveBotOptInRequired, 400),
  liveBotActiveRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveBotActiveRequired, 400),
  liveApiKeyRequired: () => new OrderDomainError(ORDER_ERROR_CODES.liveApiKeyRequired, 400),
  liveOrderTypeUnsupported: () => new OrderDomainError(ORDER_ERROR_CODES.liveOrderTypeUnsupported, 400),
  liveExecutionFailed: () => new OrderDomainError(ORDER_ERROR_CODES.liveExecutionFailed, 502),
  livePretradeMarginLeverageConvergenceFailed: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeMarginLeverageConvergenceFailed, 400),
  livePretradeInvalidQuantity: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeInvalidQuantity, 400),
  livePretradeExternalPositionOpen: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeExternalPositionOpen, 400),
  livePretradeAmountBelowMin: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeAmountBelowMin, 400),
  livePretradeAmountPrecision: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeAmountPrecision, 400),
  livePretradeNotionalBelowMin: () =>
    new OrderDomainError(ORDER_ERROR_CODES.livePretradeNotionalBelowMin, 400),
  orderNotCancelable: () => new OrderDomainError(ORDER_ERROR_CODES.orderNotCancelable, 400),
  orderCancelRiskAckRequired: () =>
    new OrderDomainError(ORDER_ERROR_CODES.orderCancelRiskAckRequired, 400),
  orderCloseRiskAckRequired: () =>
    new OrderDomainError(ORDER_ERROR_CODES.orderCloseRiskAckRequired, 400),
  orderNotClosable: () => new OrderDomainError(ORDER_ERROR_CODES.orderNotClosable, 400),
};
