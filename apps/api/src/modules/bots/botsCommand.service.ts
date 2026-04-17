import { Exchange } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { runtimeTelemetryService } from '../engine/runtimeTelemetry.service';
import { assertSubscriptionAllowsBotCreate } from '../subscriptions/subscriptionEntitlements.service';
import { getOwnedWalletForBotContext } from '../wallets/wallets.service';
import {
  CreateBotDto,
  ListBotsQueryDto,
  UpdateBotDto,
} from './bots.types';
import {
  assertNoDuplicateActiveBotByStrategyAndSymbolGroup,
  deriveMaxOpenPositionsFromStrategy,
  getOwnedStrategy,
  resolveCreateMarketGroupToSymbolGroup,
} from './botWriteValidation.service';
import {
  BotConsentState,
  normalizeConsentTextVersion,
  validateLiveConsentState,
  writeLiveConsentAudit,
} from './botLiveConsent.service';
import { upsertBotStrategy } from './botLegacyStrategyLink.service';
import { assertBotActivationExchangeCapability } from './botActivationPolicy.service';
import { mapBotResponse } from './botResponseMapper.service';
import {
  getBotWithStrategyProjectionById,
  getOwnedBotWithStrategyProjection,
  listOwnedBotsWithStrategyProjection,
} from './botReadProjection.service';
import { botErrors } from './bots.errors';

export {
  deleteBotSubagentConfig,
  getBotAssistantConfig,
  runAssistantDryRun,
  upsertBotAssistantConfig,
  upsertBotSubagentConfig,
} from './botAssistant.service';

export class BotModeSwitchBlockedError extends Error {
  constructor(public readonly openPaperPositions: number) {
    super('BOT_MODE_SWITCH_REQUIRES_CLOSED_PAPER_POSITIONS');
    this.name = 'BotModeSwitchBlockedError';
  }
}

const normalizeWalletContextValue = (value: string | null | undefined) =>
  (value ?? '').trim().toUpperCase();

const isWalletContextCompatibleWithMarketUniverse = (params: {
  wallet: {
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
  };
  marketUniverse: {
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
  };
}) =>
  params.wallet.exchange === params.marketUniverse.exchange &&
  params.wallet.marketType === params.marketUniverse.marketType &&
  normalizeWalletContextValue(params.wallet.baseCurrency) ===
    normalizeWalletContextValue(params.marketUniverse.baseCurrency);

const assertWalletContextMatchesExistingBotMarketGroups = async (params: {
  userId: string;
  botId: string;
  wallet: {
    id: string;
    exchange: Exchange;
    marketType: 'FUTURES' | 'SPOT';
    baseCurrency: string;
  };
}) => {
  const botGroups = await prisma.botMarketGroup.findMany({
    where: {
      userId: params.userId,
      botId: params.botId,
    },
    select: {
      id: true,
      symbolGroupId: true,
      symbolGroup: {
        select: {
          marketUniverse: {
            select: {
              id: true,
              exchange: true,
              marketType: true,
              baseCurrency: true,
            },
          },
        },
      },
    },
  });

  const mismatch = botGroups.find((group) => {
    const universe = group.symbolGroup.marketUniverse;
    return !isWalletContextCompatibleWithMarketUniverse({
      wallet: params.wallet,
      marketUniverse: {
        exchange: universe.exchange,
        marketType: universe.marketType,
        baseCurrency: universe.baseCurrency,
      },
    });
  });

  if (mismatch) {
    throw botErrors.walletMarketContextMismatch({
      walletId: params.wallet.id,
      walletExchange: params.wallet.exchange,
      walletMarketType: params.wallet.marketType,
      walletBaseCurrency: normalizeWalletContextValue(params.wallet.baseCurrency),
      symbolGroupId: mismatch.symbolGroupId,
      marketUniverseId: mismatch.symbolGroup.marketUniverse.id,
      marketUniverseExchange: mismatch.symbolGroup.marketUniverse.exchange,
      marketUniverseMarketType: mismatch.symbolGroup.marketUniverse.marketType,
      marketUniverseBaseCurrency: normalizeWalletContextValue(
        mismatch.symbolGroup.marketUniverse.baseCurrency
      ),
    });
  }
};

export const listBots = async (userId: string, query: ListBotsQueryDto = {}) => {
  const bots = await listOwnedBotsWithStrategyProjection({
    userId,
    marketType: query.marketType,
  });

  return bots.map((bot) => mapBotResponse(bot));
};

export const getBot = async (userId: string, id: string) => {
  const bot = await getOwnedBotWithStrategyProjection({
    userId,
    botId: id,
  });

  return bot ? mapBotResponse(bot) : null;
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  const { strategyId, marketGroupId, walletId, ...botData } = data;
  const strategy = await getOwnedStrategy(userId, strategyId);
  if (!strategy) throw botErrors.botStrategyNotFound();

  const symbolGroup = await resolveCreateMarketGroupToSymbolGroup(userId, marketGroupId);
  if (!symbolGroup) throw botErrors.symbolGroupNotFound();
  const wallet = await getOwnedWalletForBotContext({ userId, walletId });
  if (!wallet) throw botErrors.walletNotFound();
  if (
    !isWalletContextCompatibleWithMarketUniverse({
      wallet: {
        exchange: wallet.exchange,
        marketType: wallet.marketType,
        baseCurrency: wallet.baseCurrency,
      },
      marketUniverse: {
        exchange: symbolGroup.marketUniverse.exchange,
        marketType: symbolGroup.marketUniverse.marketType,
        baseCurrency: symbolGroup.marketUniverse.baseCurrency,
      },
    })
  ) {
    throw botErrors.walletMarketContextMismatch();
  }

  const derivedMode = wallet.mode;
  const derivedPaperStartBalance = Math.max(0, wallet.paperInitialBalance);
  const derivedMarketType = wallet.marketType;
  const derivedExchange = wallet.exchange;
  const derivedApiKeyId = wallet.mode === 'LIVE' ? wallet.apiKeyId : null;
  if (wallet.mode === 'LIVE' && !derivedApiKeyId) {
    throw botErrors.walletLiveApiKeyRequired();
  }

  const nextState: BotConsentState = {
    mode: derivedMode,
    liveOptIn: derivedMode === 'LIVE' ? botData.liveOptIn : false,
    consentTextVersion: botData.consentTextVersion,
  };
  validateLiveConsentState(nextState);

  const derivedMaxOpenPositions = deriveMaxOpenPositionsFromStrategy(strategy.config);
  if (botData.isActive) {
    assertBotActivationExchangeCapability({
      exchange: derivedExchange,
      mode: derivedMode,
    });
  }

  if (botData.isActive) {
    await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
      userId,
      strategyId,
      symbolGroupId: symbolGroup.id,
      walletId: wallet.id,
    });
  }

  const createdBotId = await prisma.$transaction(async (tx) => {
    await assertSubscriptionAllowsBotCreate(userId, derivedMode, tx);

    const createdBot = await tx.bot.create({
      data: {
        userId,
        name: botData.name,
        mode: derivedMode,
        walletId: wallet.id,
        paperStartBalance: derivedPaperStartBalance,
        apiKeyId: derivedApiKeyId,
        exchange: derivedExchange,
        marketType: derivedMarketType,
        positionMode: 'ONE_WAY',
        isActive: botData.isActive,
        liveOptIn: derivedMode === 'LIVE' ? botData.liveOptIn : false,
        maxOpenPositions: derivedMaxOpenPositions,
        consentTextVersion: derivedMode === 'LIVE' && botData.liveOptIn
          ? normalizeConsentTextVersion(botData.consentTextVersion)
          : null,
      },
      select: {
        id: true,
      },
    });

    const createdBotMarketGroup = await tx.botMarketGroup.create({
      data: {
        userId,
        botId: createdBot.id,
        symbolGroupId: symbolGroup.id,
        lifecycleStatus: 'ACTIVE',
        executionOrder: 100,
        maxOpenPositions: derivedMaxOpenPositions,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    await tx.marketGroupStrategyLink.create({
      data: {
        userId,
        botId: createdBot.id,
        botMarketGroupId: createdBotMarketGroup.id,
        strategyId,
        priority: 100,
        weight: 1,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    });

    return createdBot.id;
  });

  if (derivedMode === 'LIVE' && botData.liveOptIn && botData.consentTextVersion) {
    await writeLiveConsentAudit({
      userId,
      botId: createdBotId,
      mode: derivedMode,
      liveOptIn: botData.liveOptIn,
      consentTextVersion: normalizeConsentTextVersion(botData.consentTextVersion)!,
      action: 'bot.live_consent.accepted',
    });
  }

  const withStrategy = await getBotWithStrategyProjectionById(createdBotId);

  if (!withStrategy) throw botErrors.botNotFound();
  return mapBotResponse(withStrategy);
};

export const updateBot = async (userId: string, id: string, data: UpdateBotDto) => {
  const existing = await getBot(userId, id);
  if (!existing) return null;

  const strategyIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'strategyId');
  const requestedStrategyId = strategyIdUpdateRequested ? (data.strategyId ?? null) : undefined;
  const marketGroupIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'marketGroupId');
  const requestedMarketGroupId = marketGroupIdUpdateRequested ? (data.marketGroupId ?? null) : undefined;
  const walletIdUpdateRequested = Object.prototype.hasOwnProperty.call(data, 'walletId');
  const requestedWalletId = walletIdUpdateRequested ? (data.walletId ?? null) : undefined;

  let targetWallet = existing.walletId
    ? await getOwnedWalletForBotContext({ userId, walletId: existing.walletId })
    : null;
  if (walletIdUpdateRequested) {
    if (!requestedWalletId) {
      throw botErrors.walletNotFound();
    }
    targetWallet = await getOwnedWalletForBotContext({ userId, walletId: requestedWalletId });
    if (!targetWallet) {
      throw botErrors.walletNotFound();
    }
  }

  const nextMode = targetWallet?.mode ?? existing.mode;
  const nextLiveOptIn = nextMode === 'LIVE' ? (data.liveOptIn ?? existing.liveOptIn) : false;
  const nextState: BotConsentState = {
    mode: nextMode,
    liveOptIn: nextLiveOptIn,
    consentTextVersion:
      data.consentTextVersion !== undefined
        ? data.consentTextVersion
        : existing.consentTextVersion,
  };
  validateLiveConsentState(nextState);
  const nextConsentTextVersion = nextState.liveOptIn
    ? normalizeConsentTextVersion(nextState.consentTextVersion)
    : null;

  const nextIsActive = data.isActive ?? existing.isActive;
  const targetExchange = (targetWallet?.exchange ?? existing.exchange) as Exchange;
  const targetMarketType = (targetWallet?.marketType ?? existing.marketType) as 'FUTURES' | 'SPOT';
  const targetBaseCurrency = targetWallet?.baseCurrency?.toUpperCase() ?? 'USDT';
  const targetPaperStartBalance = targetWallet
    ? Math.max(0, targetWallet.paperInitialBalance)
    : existing.paperStartBalance;
  const resolvedApiKeyId =
    nextMode === 'LIVE' ? (targetWallet?.apiKeyId ?? existing.apiKeyId ?? null) : null;

  if (nextMode === 'LIVE' && !resolvedApiKeyId) {
    throw botErrors.walletLiveApiKeyRequired();
  }

  if (walletIdUpdateRequested && targetWallet) {
    await assertWalletContextMatchesExistingBotMarketGroups({
      userId,
      botId: existing.id,
      wallet: {
        id: targetWallet.id,
        exchange: targetWallet.exchange as Exchange,
        marketType: targetWallet.marketType as 'FUTURES' | 'SPOT',
        baseCurrency: targetWallet.baseCurrency,
      },
    });
  }

  const switchingPaperToLive = existing.mode === 'PAPER' && nextMode === 'LIVE';
  if (switchingPaperToLive) {
    const openPaperPositions = await prisma.position.count({
      where: {
        userId,
        botId: existing.id,
        status: 'OPEN',
        managementMode: 'BOT_MANAGED',
      },
    });
    if (openPaperPositions > 0) {
      throw new BotModeSwitchBlockedError(openPaperPositions);
    }
  }

  if (requestedMarketGroupId) {
    const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
    if (!resolvedGroup) throw botErrors.symbolGroupNotFound();
    if (
      !isWalletContextCompatibleWithMarketUniverse({
        wallet: {
          exchange: targetExchange,
          marketType: targetMarketType,
          baseCurrency: targetBaseCurrency,
        },
        marketUniverse: {
          exchange: resolvedGroup.marketUniverse.exchange,
          marketType: resolvedGroup.marketUniverse.marketType,
          baseCurrency: resolvedGroup.marketUniverse.baseCurrency,
        },
      })
    ) {
      throw botErrors.walletMarketContextMismatch();
    }
  }

  if (nextIsActive) {
    assertBotActivationExchangeCapability({
      exchange: targetExchange,
      mode: nextMode,
    });
  }

  if (nextIsActive) {
    const targetStrategyId = requestedStrategyId !== undefined ? requestedStrategyId : (existing.strategyId ?? null);
    if (targetStrategyId) {
      let targetSymbolGroupId: string | null = null;

      if (requestedMarketGroupId) {
        const resolvedGroup = await resolveCreateMarketGroupToSymbolGroup(userId, requestedMarketGroupId);
        if (!resolvedGroup) throw botErrors.symbolGroupNotFound();
        targetSymbolGroupId = resolvedGroup.id;
      } else {
        const primaryGroup = await prisma.botMarketGroup.findFirst({
          where: {
            userId,
            botId: existing.id,
            isEnabled: true,
          },
          orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            symbolGroupId: true,
          },
        });
        targetSymbolGroupId = primaryGroup?.symbolGroupId ?? null;
      }

      if (targetSymbolGroupId) {
        const targetWalletId = targetWallet?.id ?? existing.walletId ?? null;
        if (!targetWalletId) {
          throw botErrors.walletNotFound();
        }
        await assertNoDuplicateActiveBotByStrategyAndSymbolGroup({
          userId,
          strategyId: targetStrategyId,
          symbolGroupId: targetSymbolGroupId,
          walletId: targetWalletId,
          excludeBotId: existing.id,
        });
      }
    }
  }

  const {
    strategyId: _ignoredStrategyId,
    marketGroupId: _ignoredMarketGroupId,
    walletId: _ignoredWalletId,
    ...botData
  } = data;
  const updated = await prisma.bot.update({
    where: { id: existing.id },
    data: {
      ...botData,
      mode: nextMode,
      walletId: targetWallet?.id ?? existing.walletId ?? null,
      paperStartBalance: targetPaperStartBalance,
      exchange: targetExchange,
      marketType: targetMarketType,
      apiKeyId: resolvedApiKeyId,
      liveOptIn: nextLiveOptIn,
      consentTextVersion: nextConsentTextVersion,
    },
    include: {
      botStrategies: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
      marketGroupStrategyLinks: {
        select: {
          strategyId: true,
          isEnabled: true,
        },
      },
    },
  });

  if (strategyIdUpdateRequested) {
    await upsertBotStrategy({
      userId,
      botId: updated.id,
      strategyId: requestedStrategyId ?? null,
      marketType: updated.marketType,
    });
  }

  if (updated.liveOptIn && updated.consentTextVersion) {
    const consentChanged = updated.consentTextVersion !== existing.consentTextVersion;
    const optInChanged = updated.liveOptIn !== existing.liveOptIn;
    if (consentChanged || optInChanged) {
      await writeLiveConsentAudit({
        userId,
        botId: updated.id,
        mode: updated.mode,
        liveOptIn: updated.liveOptIn,
        consentTextVersion: updated.consentTextVersion,
        action: optInChanged ? 'bot.live_consent.accepted' : 'bot.live_consent.updated',
      });
    }
  }

  if (existing.isActive && !updated.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: updated.id,
      status: 'CANCELED',
      stopReason: 'bot_deactivated',
    });
  }

  const withStrategy = await getBotWithStrategyProjectionById(updated.id);

  return withStrategy ? mapBotResponse(withStrategy) : mapBotResponse(updated);
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  if (existing.isActive) {
    await runtimeTelemetryService.closeRuntimeSession({
      botId: existing.id,
      status: 'CANCELED',
      stopReason: 'bot_deleted',
    });
  }

  await prisma.$transaction([
    prisma.position.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.order.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.trade.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.signal.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.log.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.orderFill.updateMany({
      where: { botId: existing.id },
      data: { botId: null },
    }),
    prisma.botRuntimeEvent.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSymbolStat.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botRuntimeSession.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.marketGroupStrategyLink.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botMarketGroup.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botStrategy.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botSubagentConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.botAssistantConfig.deleteMany({
      where: { botId: existing.id },
    }),
    prisma.bot.delete({
      where: { id: existing.id },
    }),
  ]);

  return true;
};

export {
  attachMarketGroupStrategy,
  createBotMarketGroup,
  deleteBotMarketGroup,
  detachMarketGroupStrategy,
  getBotMarketGroup,
  listBotMarketGroups,
  listMarketGroupStrategyLinks,
  reorderMarketGroupStrategies,
  updateBotMarketGroup,
  updateMarketGroupStrategy,
} from './botMarketGroups.service';

export const getBotRuntimeGraph = async (userId: string, botId: string) => {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId },
    select: {
      id: true,
      userId: true,
      name: true,
      mode: true,
      marketType: true,
      positionMode: true,
      isActive: true,
      liveOptIn: true,
      maxOpenPositions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!bot) return null;

  const marketGroups = await prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategyLinks: {
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              interval: true,
            },
          },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const legacyBotStrategies = await prisma.botStrategy.findMany({
    where: { botId, bot: { userId } },
    include: {
      symbolGroup: {
        select: {
          id: true,
          name: true,
          symbols: true,
          marketUniverseId: true,
        },
      },
      strategy: {
        select: {
          id: true,
          name: true,
          interval: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  return {
    bot,
    marketGroups: marketGroups.map((group) => ({
      id: group.id,
      botId: group.botId,
      symbolGroupId: group.symbolGroupId,
      lifecycleStatus: group.lifecycleStatus,
      executionOrder: group.executionOrder,
      isEnabled: group.isEnabled,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      symbolGroup: group.symbolGroup,
      strategies: group.strategyLinks.map((link) => ({
        id: link.id,
        strategyId: link.strategyId,
        priority: link.priority,
        weight: link.weight,
        isEnabled: link.isEnabled,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
        strategy: link.strategy,
      })),
    })),
    legacyBotStrategies: legacyBotStrategies.map((item) => ({
      id: item.id,
      strategyId: item.strategyId,
      symbolGroupId: item.symbolGroupId,
      isEnabled: item.isEnabled,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      strategy: item.strategy,
      symbolGroup: item.symbolGroup,
    })),
  };
};

