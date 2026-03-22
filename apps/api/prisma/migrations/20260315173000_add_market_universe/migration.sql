-- CreateTable
CREATE TABLE "public"."MarketUniverse" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "filterRules" JSONB,
    "whitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blacklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoExcludeRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketUniverse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketUniverse_userId_idx" ON "public"."MarketUniverse"("userId");

-- AddForeignKey
ALTER TABLE "public"."MarketUniverse" ADD CONSTRAINT "MarketUniverse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
