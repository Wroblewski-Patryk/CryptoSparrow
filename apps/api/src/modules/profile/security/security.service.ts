import { prisma } from '../../../prisma/client';
import { comparePassword, hashPassword } from '../../../utils/hash';

const getUserWithPassword = async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

export const changePassword = async (userId: string, input: { currentPassword: string; newPassword: string }) => {
  const user = await getUserWithPassword(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const isValid = await comparePassword(input.currentPassword, user.password);
  if (!isValid) throw new Error('INVALID_PASSWORD');

  const nextHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: nextHash,
    },
  });
};

export const deleteAccount = async (userId: string, input: { password: string }) => {
  const user = await getUserWithPassword(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) throw new Error('INVALID_PASSWORD');

  await prisma.$transaction([
    prisma.orderFill.deleteMany({ where: { userId } }),
    prisma.trade.deleteMany({ where: { userId } }),
    prisma.order.deleteMany({ where: { userId } }),
    prisma.position.deleteMany({ where: { userId } }),
    prisma.signal.deleteMany({ where: { userId } }),
    prisma.backtestReport.deleteMany({ where: { userId } }),
    prisma.backtestTrade.deleteMany({ where: { userId } }),
    prisma.backtestRun.deleteMany({ where: { userId } }),
    prisma.log.deleteMany({ where: { userId } }),
    prisma.botRuntimeEvent.deleteMany({ where: { userId } }),
    prisma.botRuntimeSymbolStat.deleteMany({ where: { userId } }),
    prisma.botRuntimeSession.deleteMany({ where: { userId } }),
    prisma.marketGroupStrategyLink.deleteMany({ where: { userId } }),
    prisma.botMarketGroup.deleteMany({ where: { userId } }),
    prisma.botStrategy.deleteMany({ where: { bot: { userId } } }),
    prisma.botSubagentConfig.deleteMany({ where: { userId } }),
    prisma.botAssistantConfig.deleteMany({ where: { userId } }),
    prisma.bot.deleteMany({ where: { userId } }),
    prisma.symbolGroup.deleteMany({ where: { userId } }),
    prisma.marketUniverse.deleteMany({ where: { userId } }),
    prisma.strategy.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
};

