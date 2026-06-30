/*
  Warnings:

  - You are about to drop the column `sign` on the `AfipToken` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `AfipToken` table. All the data in the column will be lost.
  - You are about to drop the column `pointOfSale` on the `ArcaConfig` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[arcaConfigId,service]` on the table `AfipToken` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scope]` on the table `ArcaConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `signEncrypted` to the `AfipToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenEncrypted` to the `AfipToken` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RemitoMode" AS ENUM ('DIGITAL_FULL', 'PREPRINTED_FORM');

-- CreateEnum
CREATE TYPE "ArcaAuditAction" AS ENUM ('CREATE_CONFIG', 'UPDATE_CONFIG', 'UPLOAD_CERTIFICATE', 'DELETE_CERTIFICATE', 'TEST_WSAA', 'TEST_WSFE_DUMMY', 'UPSERT_POINT_OF_SALE', 'DELETE_POINT_OF_SALE', 'UPSERT_REMITO_CAI', 'DELETE_REMITO_CAI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArcaConfigStatus" ADD VALUE 'INCOMPLETE';
ALTER TYPE "ArcaConfigStatus" ADD VALUE 'CERT_EXPIRED';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CONTADOR';

-- DropIndex
DROP INDEX "AfipToken_arcaConfigId_key";

-- AlterTable
ALTER TABLE "AfipToken" DROP COLUMN "sign",
DROP COLUMN "token",
ADD COLUMN     "service" TEXT NOT NULL DEFAULT 'wsfe',
ADD COLUMN     "signEncrypted" TEXT NOT NULL,
ADD COLUMN     "tokenEncrypted" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ArcaConfig" DROP COLUMN "pointOfSale",
ADD COLUMN     "activityStart" TIMESTAMP(3),
ADD COLUMN     "certAlias" TEXT,
ADD COLUMN     "defaultConcept" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "defaultCurrencyId" TEXT NOT NULL DEFAULT 'PES',
ADD COLUMN     "defaultPointOfSale" INTEGER,
ADD COLUMN     "fiscalAddress" TEXT,
ADD COLUMN     "iibb" TEXT,
ADD COLUMN     "lastSuccessAt" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'GRUPO_VJ',
ALTER COLUMN "environment" SET DEFAULT 'HOMOLOGACION',
ALTER COLUMN "certEncrypted" DROP NOT NULL,
ALTER COLUMN "keyEncrypted" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ArcaPointOfSale" (
    "id" TEXT NOT NULL,
    "arcaConfigId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabledCbteTypes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcaPointOfSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemitoCaiConfig" (
    "id" TEXT NOT NULL,
    "arcaConfigId" TEXT NOT NULL,
    "mode" "RemitoMode" NOT NULL DEFAULT 'PREPRINTED_FORM',
    "pointOfSale" INTEGER NOT NULL,
    "cai" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rangeFrom" INTEGER,
    "rangeTo" INTEGER,
    "nextNumber" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemitoCaiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcaAuditLog" (
    "id" TEXT NOT NULL,
    "arcaConfigId" TEXT,
    "userId" TEXT,
    "action" "ArcaAuditAction" NOT NULL,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcaAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArcaPointOfSale_number_idx" ON "ArcaPointOfSale"("number");

-- CreateIndex
CREATE INDEX "ArcaPointOfSale_enabled_idx" ON "ArcaPointOfSale"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ArcaPointOfSale_arcaConfigId_number_key" ON "ArcaPointOfSale"("arcaConfigId", "number");

-- CreateIndex
CREATE INDEX "RemitoCaiConfig_pointOfSale_idx" ON "RemitoCaiConfig"("pointOfSale");

-- CreateIndex
CREATE INDEX "RemitoCaiConfig_enabled_idx" ON "RemitoCaiConfig"("enabled");

-- CreateIndex
CREATE INDEX "RemitoCaiConfig_expiresAt_idx" ON "RemitoCaiConfig"("expiresAt");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_arcaConfigId_idx" ON "ArcaAuditLog"("arcaConfigId");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_userId_idx" ON "ArcaAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_action_idx" ON "ArcaAuditLog"("action");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_createdAt_idx" ON "ArcaAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AfipToken_expiration_idx" ON "AfipToken"("expiration");

-- CreateIndex
CREATE UNIQUE INDEX "AfipToken_arcaConfigId_service_key" ON "AfipToken"("arcaConfigId", "service");

-- CreateIndex
CREATE UNIQUE INDEX "ArcaConfig_scope_key" ON "ArcaConfig"("scope");

-- CreateIndex
CREATE INDEX "ArcaConfig_status_idx" ON "ArcaConfig"("status");

-- AddForeignKey
ALTER TABLE "ArcaPointOfSale" ADD CONSTRAINT "ArcaPointOfSale_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoCaiConfig" ADD CONSTRAINT "RemitoCaiConfig_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcaAuditLog" ADD CONSTRAINT "ArcaAuditLog_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
