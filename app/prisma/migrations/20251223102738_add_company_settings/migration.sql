/*
  Warnings:

  - You are about to drop the column `company` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[companyId,region]` on the table `RegionalPhoneNumber` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RegionalPhoneNumber_userId_region_key";

-- AlterTable
ALTER TABLE "BulkCallCampaign" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "disconnectReason" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeSource" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "RegionalPhoneNumber" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "company",
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "companyName" TEXT,
ALTER COLUMN "role" SET DEFAULT 'member';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "twilioSubAccountSid" TEXT,
    "billingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "twilioAccountSid" TEXT,
    "twilioAuthToken" TEXT,
    "openaiApiKey" TEXT,
    "googleAiApiKey" TEXT,
    "elevenLabsApiKey" TEXT,
    "deepgramApiKey" TEXT,
    "aiCallingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "knowledgeBaseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "subscriptionStatus" TEXT DEFAULT 'trialing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE INDEX "CompanySettings_companyId_idx" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvite_token_key" ON "CompanyInvite"("token");

-- CreateIndex
CREATE INDEX "CompanyInvite_token_idx" ON "CompanyInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvite_companyId_email_key" ON "CompanyInvite"("companyId", "email");

-- CreateIndex
CREATE INDEX "BulkCallCampaign_companyId_status_idx" ON "BulkCallCampaign"("companyId", "status");

-- CreateIndex
CREATE INDEX "Call_companyId_idx" ON "Call"("companyId");

-- CreateIndex
CREATE INDEX "KnowledgeSource_companyId_isActive_idx" ON "KnowledgeSource"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");

-- CreateIndex
CREATE INDEX "Lead_companyId_interestLevel_idx" ON "Lead"("companyId", "interestLevel");

-- CreateIndex
CREATE INDEX "RegionalPhoneNumber_companyId_idx" ON "RegionalPhoneNumber"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "RegionalPhoneNumber_companyId_region_key" ON "RegionalPhoneNumber"("companyId", "region");

-- CreateIndex
CREATE INDEX "Script_companyId_idx" ON "Script"("companyId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionalPhoneNumber" ADD CONSTRAINT "RegionalPhoneNumber_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkCallCampaign" ADD CONSTRAINT "BulkCallCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
