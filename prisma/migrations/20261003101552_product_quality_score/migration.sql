-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "qualityScore" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_qualityScore_idx" ON "Product"("qualityScore");
