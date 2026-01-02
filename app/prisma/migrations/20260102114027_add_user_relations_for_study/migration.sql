-- DropIndex
DROP INDEX "MindMap_sourceId_key";

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "sourceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MindMap" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "sourceId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Flashcard_userId_idx" ON "Flashcard"("userId");

-- CreateIndex
CREATE INDEX "MindMap_sourceId_idx" ON "MindMap"("sourceId");

-- CreateIndex
CREATE INDEX "MindMap_userId_idx" ON "MindMap"("userId");

-- AddForeignKey
ALTER TABLE "MindMap" ADD CONSTRAINT "MindMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
