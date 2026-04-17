import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCloseRuntimePositionAction } from './useCloseRuntimePositionAction';

const closeBotRuntimeSessionPositionMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/bots/services/bots.service', () => ({
  closeBotRuntimeSessionPosition: closeBotRuntimeSessionPositionMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

describe('useCloseRuntimePositionAction', () => {
  beforeEach(() => {
    closeBotRuntimeSessionPositionMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it('handles ignored close response with dedicated ignored message and refresh', async () => {
    closeBotRuntimeSessionPositionMock.mockResolvedValue({
      status: 'ignored',
      reason: 'no_open_position',
    });
    const onClosed = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useCloseRuntimePositionAction({
        closePositionErrorLabel: 'error',
        closePositionIgnoredLabel: 'ignored',
        closePositionNoSessionLabel: 'no-session',
        closePositionSuccessLabel: 'success',
        onClosed,
        selectedBotId: 'bot-default',
        selectedSessionId: 'session-default',
      })
    );

    await act(async () => {
      await result.current.handleCloseRuntimePosition({
        id: 'position-1',
        runtimeBotId: 'bot-1',
        runtimeSessionId: 'session-1',
      } as never);
    });

    expect(closeBotRuntimeSessionPositionMock).toHaveBeenCalledWith(
      'bot-1',
      'session-1',
      'position-1',
      { riskAck: true }
    );
    expect(toastErrorMock).toHaveBeenCalledWith('ignored');
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
