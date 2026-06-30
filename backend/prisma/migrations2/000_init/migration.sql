-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."CategoryFinance" AS ENUM ('AlquilerL1', 'AlquilerF1', 'Alarma', 'Sueldos', 'MateriaPrima', 'Impuestos', 'VEP', 'Contadora', 'Arca', 'Eenvios', 'Publicidad', 'Otro', 'VENTA');

-- CreateEnum
CREATE TYPE "public"."CategoryProduct" AS ENUM ('Bombones', 'Alfajores', 'Cajas');

-- CreateEnum
CREATE TYPE "public"."CategoryClient" AS ENUM ('Mayorista', 'Cliente');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('TRANSFER', 'INGRESS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."Location" AS ENUM ('LOCAL', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('SIMPLE', 'COMPUESTO');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR');

-- CreateEnum
CREATE TYPE "public"."ReceiptType" AS ENUM ('TICKET', 'FACTURA');

-- CreateEnum
CREATE TYPE "public"."FinanceType" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "public"."SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "gmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "public"."CategoryClient" NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ProductType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "minStock" INTEGER,
    "stockLocal" INTEGER NOT NULL DEFAULT 0,
    "stockDeposito" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "category" "public"."CategoryProduct" NOT NULL,
    "clientPrice" DOUBLE PRECISION NOT NULL,
    "wholesalePrice" DOUBLE PRECISION NOT NULL,
    "imageId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AfipToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfipToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CbteCounter" (
    "id" TEXT NOT NULL,
    "ptoVta" INTEGER NOT NULL,
    "cbteTipo" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbteCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceAfip" (
    "id" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "tipoComprobante" INTEGER NOT NULL,
    "tipoDoc" INTEGER NOT NULL,
    "nroDoc" BIGINT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "resultado" TEXT NOT NULL,
    "cae" TEXT,
    "caeVto" TIMESTAMP(3),
    "total" DOUBLE PRECISION NOT NULL,
    "neto" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "condicionIVAReceptor" INTEGER NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'PES',
    "urlQR" TEXT,
    "qrBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "saleId" TEXT,
    "relatedInvoiceId" TEXT,

    CONSTRAINT "InvoiceAfip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "receiptType" "public"."ReceiptType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."SaleStatus" NOT NULL DEFAULT 'PENDING',
    "clientId" TEXT,
    "discountType" TEXT,
    "discountValue" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gmailSend" TEXT,
    "isInvoiced" BOOLEAN NOT NULL DEFAULT false,
    "isNoteCredit" BOOLEAN NOT NULL DEFAULT false,
    "pdfUrl" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductStats" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BoxContent" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BoxContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Finance" (
    "id" TEXT NOT NULL,
    "type" "public"."FinanceType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "public"."CategoryFinance" NOT NULL,
    "paymentMethod" "public"."PaymentMethod",

    CONSTRAINT "Finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "type" "public"."MovementType" NOT NULL,
    "from" "public"."Location",
    "to" "public"."Location",

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_dni_key" ON "public"."Client"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Client_gmail_key" ON "public"."Client"("gmail");

-- CreateIndex
CREATE UNIQUE INDEX "CbteCounter_ptoVta_cbteTipo_key" ON "public"."CbteCounter"("ptoVta", "cbteTipo");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_saleId_key" ON "public"."InvoiceAfip"("saleId");

-- CreateIndex
CREATE INDEX "InvoiceAfip_cuit_puntoVenta_tipoComprobante_idx" ON "public"."InvoiceAfip"("cuit", "puntoVenta", "tipoComprobante");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_puntoVenta_tipoComprobante_numero_key" ON "public"."InvoiceAfip"("puntoVenta", "tipoComprobante", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "public"."Invoice"("saleId");

-- AddForeignKey
ALTER TABLE "public"."InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "public"."InvoiceAfip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductStats" ADD CONSTRAINT "ProductStats_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BoxContent" ADD CONSTRAINT "BoxContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BoxContent" ADD CONSTRAINT "BoxContent_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "public"."SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

