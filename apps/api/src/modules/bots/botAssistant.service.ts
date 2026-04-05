import { prisma } from '../../prisma/client';
import { orchestrateAssistantDecision } from '../engine/assistantOrchestrator.service';
import { AssistantDryRunDto, UpsertBotAssistantConfigDto, UpsertBotSubagentConfigDto } from './bots.types';
import { getOwnedBot } from './botOwnership.service';

export const getBotAssistantConfig = async (userId: string, botId: string) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistant = await prisma.botAssistantConfig.findUnique({
    where: { botId },
  });
  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return { assistant, subagents };
};

export const upsertBotAssistantConfig = async (
  userId: string,
  botId: string,
  data: UpsertBotAssistantConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  return prisma.botAssistantConfig.upsert({
    where: { botId },
    update: {
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
    create: {
      userId,
      botId,
      mainAgentEnabled: data.mainAgentEnabled,
      mandate: data.mandate ?? null,
      modelProfile: data.modelProfile,
      safetyMode: data.safetyMode,
      maxDecisionLatencyMs: data.maxDecisionLatencyMs,
    },
  });
};

export const upsertBotSubagentConfig = async (
  userId: string,
  botId: string,
  slotIndex: number,
  data: UpsertBotSubagentConfigDto
) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  return prisma.botSubagentConfig.upsert({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
    update: {
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
    create: {
      userId,
      botId,
      slotIndex,
      role: data.role,
      enabled: data.enabled,
      modelProfile: data.modelProfile,
      timeoutMs: data.timeoutMs,
      safetyMode: data.safetyMode,
    },
  });
};

export const deleteBotSubagentConfig = async (userId: string, botId: string, slotIndex: number) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return false;
  if (slotIndex < 1 || slotIndex > 4) throw new Error('SUBAGENT_SLOT_OUT_OF_RANGE');

  const existing = await prisma.botSubagentConfig.findUnique({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  if (!existing || existing.userId !== userId) return false;

  await prisma.botSubagentConfig.delete({
    where: {
      botId_slotIndex: {
        botId,
        slotIndex,
      },
    },
  });

  return true;
};

export const runAssistantDryRun = async (userId: string, botId: string, input: AssistantDryRunDto) => {
  const bot = await getOwnedBot(userId, botId);
  if (!bot) return null;

  const assistantConfig = await prisma.botAssistantConfig.findUnique({
    where: { botId },
    select: {
      mandate: true,
      safetyMode: true,
    },
  });

  const subagents = await prisma.botSubagentConfig.findMany({
    where: { userId, botId },
    orderBy: { slotIndex: 'asc' },
  });

  return orchestrateAssistantDecision({
    requestId: `dryrun:${Date.now()}:${botId}`,
    userId,
    botId,
    botMarketGroupId: 'dry-run',
    symbol: input.symbol.toUpperCase(),
    intervalWindow: input.intervalWindow,
    mode: input.mode,
    mandate: assistantConfig?.mandate ?? null,
    forbiddenActions: assistantConfig?.safetyMode === 'STRICT' ? ['SHORT'] : undefined,
    subagents: subagents.map((slot) => ({
      slotIndex: slot.slotIndex,
      role: slot.role,
      enabled: slot.enabled,
      timeoutMs: slot.timeoutMs,
    })),
  });
};
