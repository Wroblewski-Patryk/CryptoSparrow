import { prisma } from '../../prisma/client';
import {
  AttachMarketGroupStrategyDto,
  CreateBotMarketGroupDto,
  ReorderMarketGroupStrategiesDto,
  UpdateBotMarketGroupDto,
  UpdateMarketGroupStrategyDto,
} from './bots.types';
import { getOwnedStrategy } from './botWriteValidation.service';
import { getOwnedBot, validateSymbolGroupForBot } from './botOwnership.service';
import { botErrors } from './bots.errors';

export const listBotMarketGroups = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botMarketGroup.findMany({
    where: {
      userId,
      botId,
    },
    orderBy: [{ executionOrder: 'asc' }, { createdAt: 'asc' }],
  });
};

export const getBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  return prisma.botMarketGroup.findFirst({
    where: {
      id: marketGroupId,
      userId,
      botId,
    },
  });
};

export const createBotMarketGroup = async (
  userId: string,
  botId: string,
  data: CreateBotMarketGroupDto
) => {
  await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });

  return prisma.botMarketGroup.create({
    data: {
      userId,
      botId,
      symbolGroupId: data.symbolGroupId,
      lifecycleStatus: data.lifecycleStatus,
      executionOrder: data.executionOrder,
      maxOpenPositions: data.maxOpenPositions,
      isEnabled: data.isEnabled,
    },
  });
};

export const updateBotMarketGroup = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: UpdateBotMarketGroupDto
) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return null;

  if (data.symbolGroupId) {
    await validateSymbolGroupForBot({ userId, botId, symbolGroupId: data.symbolGroupId });
  }

  return prisma.botMarketGroup.update({
    where: { id: existing.id },
    data: {
      ...(data.symbolGroupId ? { symbolGroupId: data.symbolGroupId } : {}),
      ...(data.lifecycleStatus ? { lifecycleStatus: data.lifecycleStatus } : {}),
      ...(data.executionOrder !== undefined ? { executionOrder: data.executionOrder } : {}),
      ...(data.maxOpenPositions !== undefined ? { maxOpenPositions: data.maxOpenPositions } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const deleteBotMarketGroup = async (userId: string, botId: string, marketGroupId: string) => {
  const existing = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!existing) return false;

  await prisma.botMarketGroup.delete({
    where: { id: existing.id },
  });

  return true;
};

export const listMarketGroupStrategyLinks = async (userId: string, botId: string, marketGroupId: string) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};

export const attachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: AttachMarketGroupStrategyDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) throw botErrors.botMarketGroupNotFound();

  const strategy = await getOwnedStrategy(userId, data.strategyId);
  if (!strategy) throw botErrors.botStrategyNotFound();

  try {
    return prisma.marketGroupStrategyLink.create({
      data: {
        userId,
        botId,
        botMarketGroupId: marketGroupId,
        strategyId: data.strategyId,
        priority: data.priority,
        weight: data.weight,
        isEnabled: data.isEnabled,
      },
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      throw botErrors.marketGroupStrategyAlreadyAttached();
    }
    throw error;
  }
};

export const updateMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string,
  data: UpdateMarketGroupStrategyDto
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.marketGroupStrategyLink.update({
    where: { id: existing.id },
    data: {
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
    },
  });
};

export const detachMarketGroupStrategy = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  linkId: string
) => {
  const existing = await prisma.marketGroupStrategyLink.findFirst({
    where: {
      id: linkId,
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (!existing) return false;

  await prisma.marketGroupStrategyLink.delete({
    where: { id: existing.id },
  });

  return true;
};

export const reorderMarketGroupStrategies = async (
  userId: string,
  botId: string,
  marketGroupId: string,
  data: ReorderMarketGroupStrategiesDto
) => {
  const group = await getBotMarketGroup(userId, botId, marketGroupId);
  if (!group) return null;

  const ids = data.items.map((item) => item.id);
  const existing = await prisma.marketGroupStrategyLink.findMany({
    where: {
      id: { in: ids },
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    select: { id: true },
  });

  if (existing.length !== ids.length) {
    throw botErrors.marketGroupStrategyLinkNotFound();
  }

  await prisma.$transaction(
    data.items.map((item) =>
      prisma.marketGroupStrategyLink.update({
        where: { id: item.id },
        data: { priority: item.priority },
      })
    )
  );

  return prisma.marketGroupStrategyLink.findMany({
    where: {
      userId,
      botId,
      botMarketGroupId: marketGroupId,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
};
