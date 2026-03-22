ALTER TABLE "ApiKey"
ADD COLUMN "syncExternalPositions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "manageExternalPositions" BOOLEAN NOT NULL DEFAULT false;
