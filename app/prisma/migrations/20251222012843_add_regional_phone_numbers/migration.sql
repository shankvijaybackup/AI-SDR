-- CreateTable
CREATE TABLE "RegionalPhoneNumber" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionalPhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegionalPhoneNumber_userId_idx" ON "RegionalPhoneNumber"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RegionalPhoneNumber_userId_region_key" ON "RegionalPhoneNumber"("userId", "region");

-- AddForeignKey
ALTER TABLE "RegionalPhoneNumber" ADD CONSTRAINT "RegionalPhoneNumber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
