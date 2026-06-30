-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLEADO', 'CLIENTE');

-- CreateEnum
CREATE TYPE "ArcaEnvironment" AS ENUM ('HOMOLOGACION', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "ArcaConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "CategoryClient" AS ENUM ('Price', 'Cliente', 'Mayorista');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'COMPUESTO');

-- CreateEnum
CREATE TYPE "SaleUnit" AS ENUM ('UNIT', 'KG');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('TRANSFER', 'INGRESS', 'ADJUSTMENT', 'SALE', 'SALE_CANCEL');

-- CreateEnum
CREATE TYPE "Location" AS ENUM ('LOCAL', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NONE', 'PENDING_AFIP', 'INVOICED', 'ERROR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR', 'DEBITO', 'CREDITO', 'QR_NACION', 'QR_MERCADOPAGO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('TICKET', 'FACTURA');

-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountMovementType" AS ENUM ('DEBT', 'PAYMENT', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "CategoryFinance" AS ENUM ('VENTA', 'COBRANZA', 'AlquilerL1', 'AlquilerF1', 'Alarma', 'Sueldos', 'MateriaPrima', 'Impuestos', 'VEP', 'Contadora', 'Arca', 'Eenvios', 'Publicidad', 'Otro');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "gmail" TEXT,
    "category" "CategoryClient" NOT NULL DEFAULT 'Price',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditLimit" DOUBLE PRECISION,
    "isAccountEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'SIMPLE',
    "price" DOUBLE PRECISION NOT NULL,
    "wholesalePrice" DOUBLE PRECISION NOT NULL,
    "clientPrice" DOUBLE PRECISION NOT NULL,
    "minStock" INTEGER,
    "stockLocal" INTEGER NOT NULL DEFAULT 0,
    "stockDeposito" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "imageUrl" TEXT,
    "imageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "saleUnit" "SaleUnit" NOT NULL DEFAULT 'UNIT',
    "pricePerKg" DOUBLE PRECISION,
    "wholesalePricePerKg" DOUBLE PRECISION,
    "clientPricePerKg" DOUBLE PRECISION,
    "stockLocalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockDepositoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockKg" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "compositeId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcaConfig" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "ivaCondition" TEXT,
    "environment" "ArcaEnvironment" NOT NULL DEFAULT 'PRODUCCION',
    "status" "ArcaConfigStatus" NOT NULL DEFAULT 'INACTIVE',
    "pointOfSale" INTEGER NOT NULL,
    "certEncrypted" TEXT NOT NULL,
    "keyEncrypted" TEXT NOT NULL,
    "certExpiresAt" TIMESTAMP(3),
    "lastTokenAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfipToken" (
    "id" TEXT NOT NULL,
    "arcaConfigId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfipToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbteCounter" (
    "id" TEXT NOT NULL,
    "ptoVta" INTEGER NOT NULL,
    "cbteTipo" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbteCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAfip" (
    "id" TEXT NOT NULL,
    "saleId" TEXT,
    "relatedInvoiceId" TEXT,
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

    CONSTRAINT "InvoiceAfip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "gmailSend" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" DOUBLE PRECISION,
    "isInvoiced" BOOLEAN NOT NULL DEFAULT false,
    "isNoteCredit" BOOLEAN NOT NULL DEFAULT false,
    "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NONE',
    "afipLastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "afipPayloadJson" JSONB,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "receiptType" "ReceiptType" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "isAccountSale" BOOLEAN NOT NULL DEFAULT false,
    "accountDebtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityKg" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productNameSnapshot" TEXT,
    "productSkuSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxContent" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,

    CONSTRAINT "BoxContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMovement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "saleId" TEXT,
    "userId" TEXT,
    "type" "AccountMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod",
    "reference" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStats" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finance" (
    "id" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "CategoryFinance" NOT NULL,
    "paymentMethod" "PaymentMethod",
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "MovementType" NOT NULL,
    "from" "Location",
    "to" "Location",
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "reason" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Client_dni_key" ON "Client"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Client_gmail_key" ON "Client"("gmail");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Client_dni_idx" ON "Client"("dni");

-- CreateIndex
CREATE INDEX "Client_gmail_idx" ON "Client"("gmail");

-- CreateIndex
CREATE INDEX "Client_category_idx" ON "Client"("category");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_slug_idx" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "ProductComponent_componentId_idx" ON "ProductComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_compositeId_componentId_key" ON "ProductComponent"("compositeId", "componentId");

-- CreateIndex
CREATE INDEX "ArcaConfig_cuit_idx" ON "ArcaConfig"("cuit");

-- CreateIndex
CREATE INDEX "ArcaConfig_isActive_idx" ON "ArcaConfig"("isActive");

-- CreateIndex
CREATE INDEX "ArcaConfig_environment_idx" ON "ArcaConfig"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "AfipToken_arcaConfigId_key" ON "AfipToken"("arcaConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "CbteCounter_ptoVta_cbteTipo_key" ON "CbteCounter"("ptoVta", "cbteTipo");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_saleId_key" ON "InvoiceAfip"("saleId");

-- CreateIndex
CREATE INDEX "InvoiceAfip_cuit_puntoVenta_tipoComprobante_idx" ON "InvoiceAfip"("cuit", "puntoVenta", "tipoComprobante");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_puntoVenta_tipoComprobante_numero_key" ON "InvoiceAfip"("puntoVenta", "tipoComprobante", "numero");

-- CreateIndex
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "BoxContent_saleItemId_idx" ON "BoxContent"("saleItemId");

-- CreateIndex
CREATE INDEX "BoxContent_productId_idx" ON "BoxContent"("productId");

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "SalePayment"("saleId");

-- CreateIndex
CREATE INDEX "SalePayment_method_idx" ON "SalePayment"("method");

-- CreateIndex
CREATE INDEX "AccountMovement_clientId_idx" ON "AccountMovement"("clientId");

-- CreateIndex
CREATE INDEX "AccountMovement_saleId_idx" ON "AccountMovement"("saleId");

-- CreateIndex
CREATE INDEX "AccountMovement_type_idx" ON "AccountMovement"("type");

-- CreateIndex
CREATE INDEX "AccountMovement_date_idx" ON "AccountMovement"("date");

-- CreateIndex
CREATE INDEX "Alert_productId_idx" ON "Alert"("productId");

-- CreateIndex
CREATE INDEX "Alert_resolved_idx" ON "Alert"("resolved");

-- CreateIndex
CREATE INDEX "ProductStats_productId_idx" ON "ProductStats"("productId");

-- CreateIndex
CREATE INDEX "ProductStats_date_idx" ON "ProductStats"("date");

-- CreateIndex
CREATE INDEX "Finance_type_idx" ON "Finance"("type");

-- CreateIndex
CREATE INDEX "Finance_category_idx" ON "Finance"("category");

-- CreateIndex
CREATE INDEX "Finance_date_idx" ON "Finance"("date");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_compositeId_fkey" FOREIGN KEY ("compositeId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfipToken" ADD CONSTRAINT "AfipToken_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "InvoiceAfip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxContent" ADD CONSTRAINT "BoxContent_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxContent" ADD CONSTRAINT "BoxContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStats" ADD CONSTRAINT "ProductStats_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
