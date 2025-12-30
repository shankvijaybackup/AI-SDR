-- AlterTable
ALTER TABLE "RegionalPhoneNumber" ADD COLUMN     "capabilities" JSONB,
ADD COLUMN     "monthlyCost" DOUBLE PRECISION,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'twilio',
ADD COLUMN     "twilioSid" TEXT;

-- CreateIndex
CREATE INDEX "RegionalPhoneNumber_provider_idx" ON "RegionalPhoneNumber"("provider");
