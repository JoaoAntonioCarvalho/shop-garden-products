-- CreateEnum
CREATE TYPE "CurationStatus" AS ENUM ('PENDING', 'KEPT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "curation" "CurationStatus",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "legacyImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statusBeforeDelete" "ProductStatus";

-- CreateIndex
CREATE INDEX "Product_curation_deletedAt_idx" ON "Product"("curation", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
