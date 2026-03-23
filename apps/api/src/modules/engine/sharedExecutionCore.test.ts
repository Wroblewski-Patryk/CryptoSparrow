import { describe, expect, it } from 'vitest';
import {
  decideExecutionAction,
  directionToOrderSide,
  directionToPositionSide,
  orderSideToPositionSide,
  positionSideToCloseOrderSide,
} from './sharedExecutionCore';

describe('sharedExecutionCore', () => {
  it('maps direction and side helpers deterministically', () => {
    expect(directionToOrderSide('LONG')).toBe('BUY');
    expect(directionToOrderSide('SHORT')).toBe('SELL');
    expect(directionToPositionSide('LONG')).toBe('LONG');
    expect(directionToPositionSide('SHORT')).toBe('SHORT');
    expect(orderSideToPositionSide('BUY')).toBe('LONG');
    expect(orderSideToPositionSide('SELL')).toBe('SHORT');
    expect(positionSideToCloseOrderSide('LONG')).toBe('SELL');
    expect(positionSideToCloseOrderSide('SHORT')).toBe('BUY');
  });

  it('returns open decision when no position exists', () => {
    expect(decideExecutionAction('LONG', null)).toEqual({
      kind: 'open',
      orderSide: 'BUY',
      positionSide: 'LONG',
    });
  });

  it('blocks flips and manual-managed symbols', () => {
    expect(
      decideExecutionAction('SHORT', {
        side: 'LONG',
        quantity: 1,
        managementMode: 'BOT_MANAGED',
      })
    ).toEqual({ kind: 'ignore', reason: 'no_flip_with_open_position' });

    expect(
      decideExecutionAction('LONG', {
        side: 'LONG',
        quantity: 1,
        managementMode: 'MANUAL_MANAGED',
      })
    ).toEqual({ kind: 'ignore', reason: 'manual_managed_symbol' });
  });

  it('returns close decision for EXIT on bot-managed position', () => {
    expect(
      decideExecutionAction('EXIT', {
        side: 'SHORT',
        quantity: 1,
        managementMode: 'BOT_MANAGED',
      })
    ).toEqual({ kind: 'close', orderSide: 'BUY' });
  });
});
