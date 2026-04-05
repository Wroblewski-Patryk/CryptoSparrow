export const mapBotResponse = <
  T extends {
    botStrategies: Array<{ strategyId: string; isEnabled: boolean }>;
    marketGroupStrategyLinks?: Array<{ strategyId: string; isEnabled: boolean }>;
  },
>(
  bot: T
) => {
  const { botStrategies, marketGroupStrategyLinks = [], ...rest } = bot;
  const activeStrategy =
    botStrategies.find((item) => item.isEnabled) ??
    botStrategies[0] ??
    marketGroupStrategyLinks.find((item) => item.isEnabled) ??
    marketGroupStrategyLinks[0] ??
    null;
  return {
    ...rest,
    strategyId: activeStrategy?.strategyId ?? null,
  };
};
