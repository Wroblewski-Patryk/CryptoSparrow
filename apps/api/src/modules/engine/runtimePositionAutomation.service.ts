import { Position, PositionSide, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { StreamTickerEvent } from '../market-stream/binanceStream.types';
import { orchestrateRuntimeSignal } from './executionOrchestrator.service';
import { evaluatePositionManagement } from './positionManagement.service';
import { PositionManagementInput, PositionManagementState } from './positionManagement.types';

type RuntimePositionAutomationDeps = {
  listOpenPositionsBySymbol: (
    symbol: string
  ) => Promise<
    Array<
      Pick<
        Position,
        | 'id'
        | 'userId'
        | 'botId'
        | 'strategyId'
        | 'symbol'
        | 'side'
        | 'entryPrice'
        | 'quantity'
        | 'leverage'
        | 'stopLoss'
        | 'takeProfit'
      >
    >
  >;
  getStrategyConfigById: (strategyId: string) => Promise<Record<string, unknown> | null>;
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

type RuntimeFallbackConfig = {
  dcaEnabled: boolean;
  dcaMaxAdds: number;
  dcaStepPercent: number;
  dcaAddSizeFraction: number;
  trailingEnabled: boolean;
  trailingType: 'percent' | 'absolute';
  trailingValue: number;
  automationMode: 'PAPER' | 'LIVE';
};

const envBoolean = (value: string | undefined, fallback: boolean) => {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const getRuntimeConfig = (): RuntimeFallbackConfig => ({
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
        strategyId: true,
        symbol: true,
        side: true,
        entryPrice: true,
        quantity: true,
        leverage: true,
        stopLoss: true,
        takeProfit: true,
      },
    }),
  getStrategyConfigById: async (strategyId) => {
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId },
      select: { config: true },
    });
    if (!strategy || typeof strategy.config !== 'object' || strategy.config == null) return null;
    return strategy.config as Record<string, unknown>;
  },
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

const toPercent = (value: unknown, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.abs(num) / 100;
};

const toSignedPercent = (value: unknown, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num / 100;
};

const toPositive = (value: unknown, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, num);
};

const computePriceFromPercent = (
  side: PositionSide,
  entryPrice: number,
  pct: number,
  kind: 'tp' | 'sl',
  leverage = 1
) => {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || pct <= 0) return undefined;
  const adjustedPct = pct / Math.max(1, leverage);
  if (kind === 'tp') {
    return side === 'LONG' ? entryPrice * (1 + adjustedPct) : entryPrice * (1 - adjustedPct);
  }
  return side === 'LONG' ? entryPrice * (1 - adjustedPct) : entryPrice * (1 + adjustedPct);
};

const buildPositionManagementInput = (
  position: Pick<
    Position,
    'side' | 'entryPrice' | 'leverage' | 'stopLoss' | 'takeProfit'
  >,
  markPrice: number,
  strategyConfig: Record<string, unknown> | null,
  fallback: RuntimeFallbackConfig
): PositionManagementInput => {
  const closeConfig =
    strategyConfig && typeof strategyConfig === 'object'
      ? ((strategyConfig.close as Record<string, unknown> | undefined) ?? undefined)
      : undefined;
  const closeMode = closeConfig?.mode === 'advanced' ? 'advanced' : 'basic';
  const additionalConfig =
    strategyConfig && typeof strategyConfig === 'object'
      ? ((strategyConfig.additional as Record<string, unknown> | undefined) ?? undefined)
      : undefined;

  const tpPercent = toPercent(closeConfig?.tp);
  const slPercent = toPercent(closeConfig?.sl);
  const ttpConfig = Array.isArray(closeConfig?.ttp) ? (closeConfig?.ttp as Array<Record<string, unknown>>) : [];
  const tslConfig = Array.isArray(closeConfig?.tsl) ? (closeConfig?.tsl as Array<Record<string, unknown>>) : [];
  const dcaLevels = Array.isArray(additionalConfig?.dcaLevels)
    ? (additionalConfig?.dcaLevels as Array<Record<string, unknown>>)
    : [];
  const dcaMode = additionalConfig?.dcaMode === 'advanced' ? 'advanced' : 'basic';
  const configuredDcaLevelPercents = dcaLevels
    .map((level) => Number(level.percent))
    .filter((value) => Number.isFinite(value))
    .map((value) => value / 100);
  const configuredDcaLevelFractions = dcaLevels
    .map((level) => Number(level.multiplier))
    .filter((value) => Number.isFinite(value) && value > 0);

  const trailingTakeProfitPercent = closeMode === 'advanced' ? toPercent(ttpConfig[0]?.percent) : 0;
  const trailingTakeProfitArmPercent = closeMode === 'advanced' ? toPercent(ttpConfig[0]?.arm) : 0;
  const trailingStopPercent = closeMode === 'advanced' ? toPercent(tslConfig[0]?.percent) : 0;
  const trailingLossStartPercent = closeMode === 'advanced' ? toSignedPercent(tslConfig[0]?.percent, Number.NaN) : Number.NaN;
  const trailingLossStepPercent = closeMode === 'advanced' ? toPercent(tslConfig[0]?.arm) : 0;
  const trailingTakeProfitLevels = (closeMode === 'advanced' ? ttpConfig : [])
    .map((level) => ({
      armPercent: toPercent(level.arm),
      trailPercent: toPercent(level.percent),
    }))
    .filter((level) => level.armPercent > 0 && level.trailPercent > 0)
    .sort((left, right) => left.armPercent - right.armPercent);
  const trailingStopLevels = (closeMode === 'advanced' ? tslConfig : [])
    .map((level) => ({
      armPercent: toPercent(level.arm),
      type: 'percent' as const,
      value: toPercent(level.percent),
    }))
    .filter((level) => level.value > 0)
    .sort((left, right) => left.armPercent - right.armPercent);
  const dcaEnabled = Boolean(additionalConfig?.dcaEnabled ?? fallback.dcaEnabled);
  const configuredMaxAdds = Math.floor(toPositive(additionalConfig?.dcaTimes, fallback.dcaMaxAdds));
  const dcaMaxAdds =
    dcaMode === 'advanced'
      ? (configuredDcaLevelPercents.length > 0 ? configuredDcaLevelPercents.length : configuredMaxAdds)
      : configuredMaxAdds;
  const dcaStepPercent = Math.abs(toSignedPercent(dcaLevels[0]?.percent, -(fallback.dcaStepPercent)));
  const dcaMultiplier = toPositive(dcaLevels[0]?.multiplier ?? additionalConfig?.dcaMultiplier, 1 + fallback.dcaAddSizeFraction);
  const dcaAddSizeFraction = Math.max(0.01, Math.min(10, dcaMultiplier));
  const dcaLevelPercents =
    dcaMode === 'advanced'
      ? configuredDcaLevelPercents
      : dcaMaxAdds > 0
        ? Array.from(
            { length: dcaMaxAdds },
            () => configuredDcaLevelPercents[0] ?? -dcaStepPercent,
          )
        : [];
  const dcaLevelFractions =
    dcaMode === 'advanced'
      ? configuredDcaLevelFractions
      : dcaMaxAdds > 0
        ? Array.from(
            { length: dcaMaxAdds },
            () => configuredDcaLevelFractions[0] ?? dcaAddSizeFraction,
          )
        : [];

  const takeProfitPrice =
    closeMode === 'basic'
      ? (position.takeProfit ??
        computePriceFromPercent(position.side, position.entryPrice, tpPercent, 'tp', position.leverage || 1))
      : undefined;
  const stopLossPrice =
    closeMode === 'basic'
      ? (position.stopLoss ??
        computePriceFromPercent(position.side, position.entryPrice, slPercent, 'sl', position.leverage || 1))
      : undefined;

  return {
    side: position.side,
    currentPrice: markPrice,
    leverage: Math.max(1, position.leverage || 1),
    stopLossPrice,
    takeProfitPrice,
    trailingTakeProfit:
      trailingTakeProfitPercent > 0 && trailingTakeProfitArmPercent > 0
        ? {
            enabled: true,
            trailPercent: trailingTakeProfitPercent,
            armPercent: trailingTakeProfitArmPercent,
          }
        : undefined,
    trailingTakeProfitLevels:
      trailingTakeProfitLevels.length > 0 ? trailingTakeProfitLevels : undefined,
    trailingStop:
      trailingStopPercent > 0
        ? {
            enabled: true,
            type: 'percent',
            value: trailingStopPercent,
            armPercent: toPercent(tslConfig[0]?.arm),
          }
        : closeMode === 'advanced' && fallback.trailingEnabled
          ? {
              enabled: true,
              type: fallback.trailingType,
              value: fallback.trailingValue,
            }
          : undefined,
    trailingStopLevels:
      trailingStopLevels.length > 0 ? trailingStopLevels : undefined,
    trailingLoss:
      Number.isFinite(trailingLossStartPercent) &&
      trailingLossStartPercent < 0 &&
      trailingLossStepPercent > 0
        ? {
            enabled: true,
            startPercent: trailingLossStartPercent,
            stepPercent: trailingLossStepPercent,
          }
        : undefined,
    dca:
      dcaEnabled && dcaMaxAdds > 0
        ? {
            enabled: true,
            maxAdds: dcaMaxAdds,
            stepPercent: Math.max(0.0001, dcaStepPercent),
            addSizeFraction: dcaAddSizeFraction,
            levelPercents: dcaLevelPercents.length > 0 ? dcaLevelPercents : undefined,
            addSizeFractions: dcaLevelFractions.length > 0 ? dcaLevelFractions : undefined,
          }
        : undefined,
  };
};

export class RuntimePositionAutomationService {
  private readonly positionStates = new Map<string, PositionManagementState>();
  private readonly strategyConfigCache = new Map<string, Record<string, unknown> | null>();

  constructor(private readonly deps: RuntimePositionAutomationDeps = defaultDeps) {}

  async handleTickerEvent(event: StreamTickerEvent) {
    const openPositions = await this.deps.listOpenPositionsBySymbol(event.symbol);
    await Promise.all(openPositions.map((position) => this.processPosition(event, position)));
  }

  private async getStrategyConfig(strategyId: string | null) {
    if (!strategyId) return null;
    if (this.strategyConfigCache.has(strategyId)) {
      return this.strategyConfigCache.get(strategyId) ?? null;
    }
    const config = await this.deps.getStrategyConfigById(strategyId);
    this.strategyConfigCache.set(strategyId, config);
    return config;
  }

  private async processPosition(
    event: StreamTickerEvent,
    position: Pick<
      Position,
      | 'id'
      | 'userId'
      | 'botId'
      | 'strategyId'
      | 'symbol'
      | 'side'
      | 'entryPrice'
      | 'quantity'
      | 'leverage'
      | 'stopLoss'
      | 'takeProfit'
    >
  ) {
    const runtimeConfig = getRuntimeConfig();
    const strategyConfig = await this.getStrategyConfig(position.strategyId ?? null);
    const input = buildPositionManagementInput(position, event.lastPrice, strategyConfig, runtimeConfig);

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
