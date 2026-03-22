import type { Prisma } from '@prisma/client';

export interface CreateStrategyDto {
  name: string;
  description?: string;
  interval: string;
  leverage: number;
  walletRisk: number;
  config: Prisma.JsonValue;
}

export const STRATEGY_EXPORT_FORMAT_VERSION = 'strategy.v1' as const;

export type StrategyExportPackage = {
  formatVersion: typeof STRATEGY_EXPORT_FORMAT_VERSION;
  exportedAt: string;
  strategy: CreateStrategyDto;
};
