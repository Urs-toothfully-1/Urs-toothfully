-- AlterTable
ALTER TABLE "EstimateItem" ADD COLUMN     "completedSittings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plannedSittings" INTEGER NOT NULL DEFAULT 1;
