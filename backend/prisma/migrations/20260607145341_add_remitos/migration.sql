-- CreateEnum
CREATE TYPE "RemitoStatus" AS ENUM ('DRAFT', 'ISSUED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Remito" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "clientId" TEXT,
    "userId" TEXT,
    "businessLocationId" TEXT,
    "arcaConfigId" TEXT,
    "remitoCaiConfigId" TEXT,
    "status" "RemitoStatus" NOT NULL DEFAULT 'ISSUED',
    "mode" "RemitoMode" NOT NULL DEFAULT 'DIGITAL_FULL',
    "pointOfSale" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "fullNumber" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '91',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placeOfIssue" TEXT,
    "cai" TEXT,
    "caiExpiresAt" TIMESTAMP(3),
    "caiRangeFrom" INTEGER,
    "caiRangeTo" INTEGER,
    "businessName" TEXT,
    "businessCuit" TEXT,
    "businessIvaCondition" TEXT,
    "businessIibb" TEXT,
    "businessActivityStart" TIMESTAMP(3),
    "businessFiscalAddress" TEXT,
    "businessAddress" TEXT,
    "businessEmail" TEXT,
    "businessPhone" TEXT,
    "clientName" TEXT,
    "clientDni" TEXT,
    "clientCuit" TEXT,
    "clientIvaCondition" TEXT,
    "clientAddress" TEXT,
    "clientLocality" TEXT,
    "sellerName" TEXT,
    "saleCondition" TEXT,
    "transportName" TEXT,
    "transportCuit" TEXT,
    "packagesCount" INTEGER,
    "declaredValue" DOUBLE PRECISION,
    "observations" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemitoItem" (
    "id" TEXT NOT NULL,
    "remitoId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "saleUnit" "SaleUnit" NOT NULL DEFAULT 'UNIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemitoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Remito_fullNumber_key" ON "Remito"("fullNumber");

-- CreateIndex
CREATE INDEX "Remito_saleId_idx" ON "Remito"("saleId");

-- CreateIndex
CREATE INDEX "Remito_clientId_idx" ON "Remito"("clientId");

-- CreateIndex
CREATE INDEX "Remito_userId_idx" ON "Remito"("userId");

-- CreateIndex
CREATE INDEX "Remito_businessLocationId_idx" ON "Remito"("businessLocationId");

-- CreateIndex
CREATE INDEX "Remito_arcaConfigId_idx" ON "Remito"("arcaConfigId");

-- CreateIndex
CREATE INDEX "Remito_remitoCaiConfigId_idx" ON "Remito"("remitoCaiConfigId");

-- CreateIndex
CREATE INDEX "Remito_status_idx" ON "Remito"("status");

-- CreateIndex
CREATE INDEX "Remito_issueDate_idx" ON "Remito"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Remito_pointOfSale_number_key" ON "Remito"("pointOfSale", "number");

-- CreateIndex
CREATE INDEX "RemitoItem_remitoId_idx" ON "RemitoItem"("remitoId");

-- CreateIndex
CREATE INDEX "RemitoItem_productId_idx" ON "RemitoItem"("productId");

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_remitoCaiConfigId_fkey" FOREIGN KEY ("remitoCaiConfigId") REFERENCES "RemitoCaiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoItem" ADD CONSTRAINT "RemitoItem_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoItem" ADD CONSTRAINT "RemitoItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
