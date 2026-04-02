CREATE TYPE "TradeLifecycleAction" AS ENUM ('OPEN', 'DCA', 'CLOSE', 'UNKNOWN');

ALTER TABLE "Trade"
ADD COLUMN "lifecycleAction" "TradeLifecycleAction" NOT NULL DEFAULT 'UNKNOWN';

