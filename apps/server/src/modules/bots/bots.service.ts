import { prisma } from '../../prisma/client';
import { CreateBotDto, ListBotsQueryDto, UpdateBotDto } from './bots.types';

type BotConsentState = {
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
  liveOptIn: boolean;
  consentTextVersion?: string | null;
};

const normalizeConsentTextVersion = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const validateLiveConsentState = (state: BotConsentState) => {
  if (state.liveOptIn && !normalizeConsentTextVersion(state.consentTextVersion)) {
    throw new Error('LIVE_CONSENT_VERSION_REQUIRED');
  }
};

const writeLiveConsentAudit = async (params: {
  userId: string;
  botId: string;
  mode: 'PAPER' | 'LIVE' | 'LOCAL';
  liveOptIn: boolean;
  consentTextVersion: string;
  action: 'bot.live_consent.accepted' | 'bot.live_consent.updated';
}) => {
  try {
    await prisma.log.create({
      data: {
        userId: params.userId,
        botId: params.botId,
        action: params.action,
        level: 'INFO',
        source: 'bots.service',
        message: `LIVE consent recorded (${params.consentTextVersion})`,
        category: 'RISK_CONSENT',
        entityType: 'BOT',
        entityId: params.botId,
        metadata: {
          mode: params.mode,
          liveOptIn: params.liveOptIn,
          consentTextVersion: params.consentTextVersion,
        },
      },
    });
  } catch {
    // Audit failures should not block core bot updates.
  }
};

export const listBots = async (userId: string, query: ListBotsQueryDto = {}) => {
  return prisma.bot.findMany({
    where: {
      userId,
      ...(query.marketType ? { marketType: query.marketType } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getBot = async (userId: string, id: string) => {
  return prisma.bot.findFirst({
    where: { id, userId },
  });
};

export const createBot = async (userId: string, data: CreateBotDto) => {
  validateLiveConsentState(data);

  const created = await prisma.bot.create({
    data: {
      userId,
      ...data,
      consentTextVersion: data.liveOptIn
        ? normalizeConsentTextVersion(data.consentTextVersion)
        : null,
    },
  });

  if (created.liveOptIn && created.consentTextVersion) {
    await writeLiveConsentAudit({
      userId,
      botId: created.id,
      mode: created.mode,
      liveOptIn: created.liveOptIn,
      consentTextVersion: created.consentTextVersion,
      action: 'bot.live_consent.accepted',
    });
  }

  return created;
};

export const updateBot = async (userId: string, id: string, data: UpdateBotDto) => {
  const existing = await getBot(userId, id);
  if (!existing) return null;

  const nextState: BotConsentState = {
    mode: data.mode ?? existing.mode,
    liveOptIn: data.liveOptIn ?? existing.liveOptIn,
    consentTextVersion:
      data.consentTextVersion !== undefined
        ? data.consentTextVersion
        : existing.consentTextVersion,
  };
  validateLiveConsentState(nextState);

  const nextConsentTextVersion = nextState.liveOptIn
    ? normalizeConsentTextVersion(nextState.consentTextVersion)
    : null;

  const updated = await prisma.bot.update({
    where: { id: existing.id },
    data: {
      ...data,
      consentTextVersion: nextConsentTextVersion,
    },
  });

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

  return updated;
};

export const deleteBot = async (userId: string, id: string) => {
  const existing = await getBot(userId, id);
  if (!existing) return false;

  await prisma.bot.delete({
    where: { id: existing.id },
  });

  return true;
};
