/*
  Warnings:

  - A unique constraint covering the columns `[emailVerificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[magicLinkToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "KnowledgeSource" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "magicLinkExpiry" TIMESTAMP(3),
ADD COLUMN     "magicLinkToken" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeSource_isShared_idx" ON "KnowledgeSource"("isShared");

-- CreateIndex
CREATE INDEX "Script_isShared_idx" ON "Script"("isShared");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_magicLinkToken_key" ON "User"("magicLinkToken");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_isEmailVerified_idx" ON "User"("isEmailVerified");
