-- Ensure no legacy LOCAL values remain before enum narrowing.
UPDATE "Bot" SET "mode" = 'PAPER' WHERE "mode"::text = 'LOCAL';
UPDATE "BotRuntimeSession" SET "mode" = 'PAPER' WHERE "mode"::text = 'LOCAL';

-- Rebuild enum without LOCAL.
ALTER TYPE "BotMode" RENAME TO "BotMode_old";
CREATE TYPE "BotMode" AS ENUM ('PAPER', 'LIVE');

ALTER TABLE "Bot"
  ALTER COLUMN "mode" DROP DEFAULT,
  ALTER COLUMN "mode" TYPE "BotMode" USING ("mode"::text::"BotMode"),
  ALTER COLUMN "mode" SET DEFAULT 'PAPER';

ALTER TABLE "BotRuntimeSession"
  ALTER COLUMN "mode" TYPE "BotMode" USING ("mode"::text::"BotMode");

DROP TYPE "BotMode_old";
