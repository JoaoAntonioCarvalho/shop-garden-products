-- CreateEnum
CREATE TYPE "CarrierRestriction" AS ENUM ('ANY', 'JADLOG_ONLY');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "carrierRestriction" "CarrierRestriction" NOT NULL DEFAULT 'ANY';
