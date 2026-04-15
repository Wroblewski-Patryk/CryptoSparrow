import { useCallback, useState } from 'react';
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
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);

  const handleCloseRuntimePosition = useCallback(
    async (position: OpenPositionWithLive) => {
      const botId = position.runtimeBotId ?? selectedBotId;
      const sessionId = position.runtimeSessionId ?? selectedSessionId;
      if (!botId || !sessionId) {
        toast.error(closePositionNoSessionLabel);
        return;
      }

      setClosingPositionId(position.id);
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
        setClosingPositionId((current) => (current === position.id ? null : current));
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
    closingPositionId,
    handleCloseRuntimePosition,
  };
};
