/*
  Warnings:

  - A unique constraint covering the columns `[hubspotId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[amplemarketId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "amplemarketApiKey" TEXT,
ADD COLUMN     "hubspotAccessToken" TEXT,
ADD COLUMN     "hubspotConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hubspotExpiresAt" TIMESTAMP(3),
ADD COLUMN     "hubspotPortalId" TEXT,
ADD COLUMN     "hubspotRefreshToken" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "amplemarketId" TEXT,
ADD COLUMN     "hubspotId" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "annualRevenue" TEXT,
    "location" TEXT,
    "linkedinUrl" TEXT,
    "hubspotId" TEXT,
    "amplemarketId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "enriched" BOOLEAN NOT NULL DEFAULT false,
    "enrichmentData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MindMap" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MindMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_hubspotId_key" ON "Account"("hubspotId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_amplemarketId_key" ON "Account"("amplemarketId");

-- CreateIndex
CREATE INDEX "Account_companyId_idx" ON "Account"("companyId");

-- CreateIndex
CREATE INDEX "Account_domain_idx" ON "Account"("domain");

-- CreateIndex
CREATE INDEX "Account_hubspotId_idx" ON "Account"("hubspotId");

-- CreateIndex
CREATE INDEX "Account_amplemarketId_idx" ON "Account"("amplemarketId");

-- CreateIndex
CREATE INDEX "ResearchNote_accountId_idx" ON "ResearchNote"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MindMap_sourceId_key" ON "MindMap"("sourceId");

-- CreateIndex
CREATE INDEX "Flashcard_sourceId_idx" ON "Flashcard"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_hubspotId_key" ON "Lead"("hubspotId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_amplemarketId_key" ON "Lead"("amplemarketId");

-- CreateIndex
CREATE INDEX "Lead_accountId_idx" ON "Lead"("accountId");

-- CreateIndex
CREATE INDEX "Lead_hubspotId_idx" ON "Lead"("hubspotId");

-- CreateIndex
CREATE INDEX "Lead_amplemarketId_idx" ON "Lead"("amplemarketId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MindMap" ADD CONSTRAINT "MindMap_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
