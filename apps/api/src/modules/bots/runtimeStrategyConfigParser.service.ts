import {
  TrailingStopDisplayLevel,
  TrailingTakeProfitDisplayLevel,
} from './runtimePositionSerialization.service';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const toFiniteInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

export const hasAdvancedCloseMode = (config: unknown) => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  return mode === 'advanced';
};

export const resolveTrailingTakeProfitLevelsFromStrategyConfig = (
  config: unknown
): TrailingTakeProfitDisplayLevel[] => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  if (mode !== 'advanced') return [];

  const rawLevels = Array.isArray(close?.ttp) ? close.ttp : [];
  return rawLevels
    .map((item) => asRecord(item))
    .map((item) => ({
      armPercent: Math.abs(Number(item?.percent)) / 100,
      trailPercent: Math.abs(Number(item?.arm)) / 100,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.armPercent) &&
        Number.isFinite(item.trailPercent) &&
        item.armPercent > 0 &&
        item.trailPercent > 0
    )
    .sort((left, right) => left.armPercent - right.armPercent);
};

export const resolveTrailingStopLevelsFromStrategyConfig = (
  config: unknown
): TrailingStopDisplayLevel[] => {
  const root = asRecord(config);
  const close = asRecord(root?.close);
  const mode = typeof close?.mode === 'string' ? close.mode.trim().toLowerCase() : null;
  if (mode !== 'advanced') return [];

  const rawLevels = Array.isArray(close?.tsl) ? close.tsl : [];
  return rawLevels
    .map((item) => asRecord(item))
    .map((item) => ({
      armPercent: Math.abs(Number(item?.arm)) / 100,
      trailPercent: Math.abs(Number(item?.percent)) / 100,
    }))
    .filter(
      (item) =>
        Number.isFinite(item.armPercent) &&
        Number.isFinite(item.trailPercent) &&
        item.armPercent > 0 &&
        item.trailPercent > 0
    )
    .sort((left, right) => left.armPercent - right.armPercent);
};

export const resolveDcaPlannedLevelsFromStrategyConfig = (config: unknown): number[] => {
  const root = asRecord(config);
  const additional = asRecord(root?.additional);
  if (!additional) return [];

  const dcaEnabledRaw = additional.dcaEnabled;
  const dcaEnabled =
    typeof dcaEnabledRaw === 'boolean' ? dcaEnabledRaw : true;
  if (!dcaEnabled) return [];

  const dcaMode =
    typeof additional.dcaMode === 'string' && additional.dcaMode.trim().toLowerCase() === 'advanced'
      ? 'advanced'
      : 'basic';
  const dcaTimes = toFiniteInteger(additional.dcaTimes);
  const rawDcaLevels = Array.isArray(additional.dcaLevels) ? additional.dcaLevels : [];
  const parsedLevelPercents = rawDcaLevels
    .map((level) => asRecord(level))
    .map((level) => Number(level?.percent))
    .filter((level): level is number => Number.isFinite(level) && level !== 0);
  const primaryLevel = parsedLevelPercents[0] ?? null;

  if (dcaMode === 'advanced') {
    if (parsedLevelPercents.length > 0) {
      return dcaTimes > 0 ? parsedLevelPercents.slice(0, dcaTimes) : parsedLevelPercents;
    }
    if (dcaTimes > 0 && primaryLevel != null) {
      return Array.from({ length: dcaTimes }, () => primaryLevel);
    }
    return [];
  }

  const basicCount = dcaTimes > 0 ? dcaTimes : parsedLevelPercents.length > 0 ? 1 : 0;
  if (basicCount <= 0 || primaryLevel == null) return [];
  return Array.from({ length: basicCount }, () => primaryLevel);
};
