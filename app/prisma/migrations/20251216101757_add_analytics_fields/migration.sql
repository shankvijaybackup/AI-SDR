-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "callQualityScore" DOUBLE PRECISION,
ADD COLUMN     "engagementScore" DOUBLE PRECISION,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "sentimentScore" DOUBLE PRECISION;
