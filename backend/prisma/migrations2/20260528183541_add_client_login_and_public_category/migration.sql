/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "CategoryClient" ADD VALUE 'Publico';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENTE';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "category" SET DEFAULT 'Publico',
ALTER COLUMN "isAccountEnabled" SET DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_category_idx" ON "Client"("category");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
