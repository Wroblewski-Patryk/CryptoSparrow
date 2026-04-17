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

  it('tracks pending state per row for concurrent close actions', async () => {
    let resolveFirst: ((value: { status: 'closed' }) => void) | null = null;
    let resolveSecond: ((value: { status: 'closed' }) => void) | null = null;
    closeBotRuntimeSessionPositionMock.mockImplementation(async (_botId: string, _sessionId: string, positionId: string) => {
      return await new Promise<{ status: 'closed' }>((resolve) => {
        if (positionId === 'position-1') {
          resolveFirst = resolve;
        } else {
          resolveSecond = resolve;
        }
      });
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

    let firstPromise: Promise<void> | undefined;
    let secondPromise: Promise<void> | undefined;
    await act(async () => {
      firstPromise = result.current.handleCloseRuntimePosition({
        id: 'position-1',
        runtimeBotId: 'bot-1',
        runtimeSessionId: 'session-1',
      } as never);
      secondPromise = result.current.handleCloseRuntimePosition({
        id: 'position-2',
        runtimeBotId: 'bot-1',
        runtimeSessionId: 'session-1',
      } as never);
      await Promise.resolve();
    });

    expect(result.current.isClosingPosition('position-1')).toBe(true);
    expect(result.current.isClosingPosition('position-2')).toBe(true);
    expect(result.current.closingPositionIds).toEqual(expect.arrayContaining(['position-1', 'position-2']));

    expect(resolveFirst).toBeTruthy();
    await act(async () => {
      resolveFirst?.({ status: 'closed' });
      await firstPromise;
    });

    expect(result.current.isClosingPosition('position-1')).toBe(false);
    expect(result.current.isClosingPosition('position-2')).toBe(true);

    expect(resolveSecond).toBeTruthy();
    await act(async () => {
      resolveSecond?.({ status: 'closed' });
      await secondPromise;
    });

    expect(result.current.isClosingPosition('position-1')).toBe(false);
    expect(result.current.isClosingPosition('position-2')).toBe(false);
    expect(result.current.closingPositionIds).toHaveLength(0);
    expect(onClosed).toHaveBeenCalledTimes(2);
  });
});
