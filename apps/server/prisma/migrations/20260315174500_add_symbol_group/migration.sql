-- CreateTable
CREATE TABLE "public"."SymbolGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketUniverseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbols" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymbolGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SymbolGroup_userId_idx" ON "public"."SymbolGroup"("userId");

-- CreateIndex
CREATE INDEX "SymbolGroup_marketUniverseId_idx" ON "public"."SymbolGroup"("marketUniverseId");

-- AddForeignKey
ALTER TABLE "public"."SymbolGroup" ADD CONSTRAINT "SymbolGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SymbolGroup" ADD CONSTRAINT "SymbolGroup_marketUniverseId_fkey" FOREIGN KEY ("marketUniverseId") REFERENCES "public"."MarketUniverse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
