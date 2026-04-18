import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { closeBotRuntimeSessionPosition } from '@/features/bots/services/bots.service';
import type { OpenPositionWithLive } from '../components/home-live-widgets/types';

type UseCloseRuntimePositionActionParams = {
  closePositionErrorLabel: string;
  closePositionIgnoredLabel: string;
  closePositionNoSessionLabel: string;
  closePositionSuccessLabel: string;
  onClosed: () => Promise<void>;
  selectedBotId?: string | null;
  selectedSessionId?: string | null;
};

export const useCloseRuntimePositionAction = ({
  closePositionErrorLabel,
  closePositionIgnoredLabel,
  closePositionNoSessionLabel,
  closePositionSuccessLabel,
  onClosed,
  selectedBotId,
  selectedSessionId,
}: UseCloseRuntimePositionActionParams) => {
  const [closingPositionById, setClosingPositionById] = useState<Record<string, true>>({});
  const closingPositionIds = useMemo(() => Object.keys(closingPositionById), [closingPositionById]);
  const isClosingPosition = useCallback(
    (positionId: string) => Boolean(closingPositionById[positionId]),
    [closingPositionById]
  );

  const handleCloseRuntimePosition = useCallback(
    async (position: OpenPositionWithLive) => {
      const botId = position.runtimeBotId ?? selectedBotId;
      const sessionId = position.runtimeSessionId ?? selectedSessionId;
      if (!botId || !sessionId) {
        toast.error(closePositionNoSessionLabel);
        return;
      }

      setClosingPositionById((current) => ({ ...current, [position.id]: true }));
      try {
        const result = await closeBotRuntimeSessionPosition(botId, sessionId, position.id, {
          riskAck: true,
        });
        if (result.status === 'closed') {
          toast.success(closePositionSuccessLabel);
        } else {
          toast.error(closePositionIgnoredLabel);
        }
        await onClosed();
      } catch {
        toast.error(closePositionErrorLabel);
      } finally {
        setClosingPositionById((current) => {
          if (!current[position.id]) return current;
          const next = { ...current };
          delete next[position.id];
          return next;
        });
      }
    },
    [
      closePositionErrorLabel,
      closePositionIgnoredLabel,
      closePositionNoSessionLabel,
      closePositionSuccessLabel,
      onClosed,
      selectedBotId,
      selectedSessionId,
    ]
  );

  return {
    closingPositionIds,
    isClosingPosition,
    handleCloseRuntimePosition,
  };
};
