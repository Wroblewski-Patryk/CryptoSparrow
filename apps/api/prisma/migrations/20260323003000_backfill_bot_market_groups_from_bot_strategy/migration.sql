-- MBA-06 Backfill for additive runtime graph migration
-- Creates default BotMarketGroup records from existing BotStrategy bindings
-- and links strategies into MarketGroupStrategyLink.

INSERT INTO "BotMarketGroup" (
  "id",
  "userId",
  "botId",
  "symbolGroupId",
  "lifecycleStatus",
  "executionOrder",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  ('bmg_' || md5(bs."botId" || ':' || bs."symbolGroupId")),
  b."userId",
  bs."botId",
  bs."symbolGroupId",
  'ACTIVE'::"BotMarketGroupStatus",
  100,
  true,
  NOW(),
  NOW()
FROM "BotStrategy" bs
JOIN "Bot" b ON b."id" = bs."botId"
ON CONFLICT ("botId", "symbolGroupId") DO NOTHING;

INSERT INTO "MarketGroupStrategyLink" (
  "id",
  "userId",
  "botId",
  "botMarketGroupId",
  "strategyId",
  "priority",
  "weight",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  ('mgsl_' || md5(bs."botId" || ':' || bs."symbolGroupId" || ':' || bs."strategyId")),
  bmg."userId",
  bmg."botId",
  bmg."id",
  bs."strategyId",
  100,
  1,
  bs."isEnabled",
  NOW(),
  NOW()
FROM "BotStrategy" bs
JOIN "BotMarketGroup" bmg
  ON bmg."botId" = bs."botId"
 AND bmg."symbolGroupId" = bs."symbolGroupId"
ON CONFLICT ("botMarketGroupId", "strategyId") DO NOTHING;
