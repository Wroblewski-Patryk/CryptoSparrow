import { Position, PositionSide } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { StreamTickerEvent } from '../market-stream/binanceStream.types';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';
import {
  evaluatePositionManagement,
} from './positionManagement.service';
import { PositionManagementInput, PositionManagementState } from './positionManagement.types';

type RuntimePositionAutomationDeps = {
  listOpenPositionsBySymbol: (symbol: string) => Promise<Array<Pick<Position, 'id' | 'userId' | 'botId' | 'symbol' | 'side' | 'entryPrice' | 'quantity' | 'stopLoss' | 'takeProfit'>>>;
  updatePositionAfterDca: (positionId: string, input: { quantity: number; entryPrice: number }) => Promise<void>;
  closeByExitSignal: (input: {
    userId: string;
    botId?: string;
    symbol: string;
    markPrice: number;
    mode: 'PAPER' | 'LIVE';
    quantity: number;
  }) => Promise<void>;
};

const envBoolean = (value: string | undefined, fallback: boolean) => {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const getRuntimeConfig = () => ({
  dcaEnabled: envBoolean(process.env.RUNTIME_DCA_ENABLED, false),
  dcaMaxAdds: Number.parseInt(process.env.RUNTIME_DCA_MAX_ADDS ?? '2', 10),
  dcaStepPercent: Number.parseFloat(process.env.RUNTIME_DCA_STEP_PERCENT ?? '0.01'),
  dcaAddSizeFraction: Number.parseFloat(process.env.RUNTIME_DCA_ADD_SIZE_FRACTION ?? '0.25'),
  trailingEnabled: envBoolean(process.env.RUNTIME_TRAILING_ENABLED, false),
  trailingType: (process.env.RUNTIME_TRAILING_TYPE ?? 'percent') as 'percent' | 'absolute',
  trailingValue: Number.parseFloat(process.env.RUNTIME_TRAILING_VALUE ?? '0.005'),
  automationMode: (process.env.RUNTIME_AUTOMATION_MODE ?? 'LIVE') as 'PAPER' | 'LIVE',
});

const defaultDeps: RuntimePositionAutomationDeps = {
  listOpenPositionsBySymbol: (symbol) =>
    prisma.position.findMany({
      where: {
        status: 'OPEN',
        symbol,
      },
      select: {
        id: true,
        userId: true,
        botId: true,
        symbol: true,
        side: true,
        entryPrice: true,
        quantity: true,
        stopLoss: true,
        takeProfit: true,
      },
    }),
  updatePositionAfterDca: async (positionId, input) => {
    await prisma.position.update({
      where: { id: positionId },
      data: {
        quantity: input.quantity,
        entryPrice: input.entryPrice,
      },
    });
  },
  closeByExitSignal: async (input) => {
    await orchestrateRuntimeSignal({
      userId: input.userId,
      botId: input.botId,
      symbol: input.symbol,
      direction: 'EXIT',
      quantity: input.quantity,
      markPrice: input.markPrice,
      mode: input.mode,
    });
  },
};

export class RuntimePositionAutomationService {
  private readonly positionStates = new Map<string, PositionManagementState>();

  constructor(private readonly deps: RuntimePositionAutomationDeps = defaultDeps) {}

  async handleTickerEvent(event: StreamTickerEvent) {
    const openPositions = await this.deps.listOpenPositionsBySymbol(event.symbol);
    await Promise.all(openPositions.map((position) => this.processPosition(event, position)));
  }

  private async processPosition(
    event: StreamTickerEvent,
    position: Pick<Position, 'id' | 'userId' | 'botId' | 'symbol' | 'side' | 'entryPrice' | 'quantity' | 'stopLoss' | 'takeProfit'>
  ) {
    const runtimeConfig = getRuntimeConfig();
    const input: PositionManagementInput = {
      side: position.side as PositionSide,
      currentPrice: event.lastPrice,
      stopLossPrice: position.stopLoss ?? undefined,
      takeProfitPrice: position.takeProfit ?? undefined,
      trailingStop: runtimeConfig.trailingEnabled
        ? {
            enabled: true,
            type: runtimeConfig.trailingType,
            value: runtimeConfig.trailingValue,
          }
        : undefined,
      dca: runtimeConfig.dcaEnabled
        ? {
            enabled: true,
            maxAdds: runtimeConfig.dcaMaxAdds,
            stepPercent: runtimeConfig.dcaStepPercent,
            addSizeFraction: runtimeConfig.dcaAddSizeFraction,
          }
        : undefined,
    };

    const previousState = this.positionStates.get(position.id) ?? {
      quantity: position.quantity,
      averageEntryPrice: position.entryPrice,
      currentAdds: 0,
      trailingAnchorPrice: position.entryPrice,
      lastDcaPrice: undefined,
    };

    const result = evaluatePositionManagement(input, previousState);
    this.positionStates.set(position.id, result.nextState);

    if (result.dcaExecuted) {
      await this.deps.updatePositionAfterDca(position.id, {
        quantity: result.nextState.quantity,
        entryPrice: result.nextState.averageEntryPrice,
      });
    }

    if (result.shouldClose) {
      await this.deps.closeByExitSignal({
        userId: position.userId,
        botId: position.botId ?? undefined,
        symbol: position.symbol,
        markPrice: event.lastPrice,
        mode: runtimeConfig.automationMode,
        quantity: result.nextState.quantity,
      });
      this.positionStates.delete(position.id);
    }
  }
}

export const runtimePositionAutomationService = new RuntimePositionAutomationService();
