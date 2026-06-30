-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EMPLEADO', 'CLIENTE', 'CONTADOR');

-- CreateEnum
CREATE TYPE "BusinessPlan" AS ENUM ('BASICO', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ArcaEnvironment" AS ENUM ('HOMOLOGACION', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "ArcaConfigStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'INCOMPLETE', 'CERT_EXPIRED');

-- CreateEnum
CREATE TYPE "CategoryClient" AS ENUM ('Price', 'Mayorista');

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
CREATE TYPE "PurchaseStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'CANCELADA');

-- CreateEnum
CREATE TYPE "SupplierAccountMovementType" AS ENUM ('DEBT', 'PAYMENT', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountMovementType" AS ENUM ('DEBT', 'PAYMENT', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "CategoryFinance" AS ENUM ('VENTA', 'COBRANZA', 'CompraMercaderia', 'AlquilerL1', 'AlquilerF1', 'Alarma', 'Sueldos', 'MateriaPrima', 'Impuestos', 'VEP', 'Contadora', 'Arca', 'Eenvios', 'Publicidad', 'Otro');

-- CreateEnum
CREATE TYPE "RemitoMode" AS ENUM ('DIGITAL_FULL', 'PREPRINTED_FORM');

-- CreateEnum
CREATE TYPE "RemitoStatus" AS ENUM ('DRAFT', 'ISSUED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ArcaAuditAction" AS ENUM ('CREATE_CONFIG', 'UPDATE_CONFIG', 'UPLOAD_CERTIFICATE', 'DELETE_CERTIFICATE', 'TEST_WSAA', 'TEST_WSFE_DUMMY', 'UPSERT_POINT_OF_SALE', 'DELETE_POINT_OF_SALE', 'UPSERT_REMITO_CAI', 'DELETE_REMITO_CAI');

-- CreateEnum
CREATE TYPE "BusinessLocationType" AS ENUM ('BRANCH', 'WAREHOUSE', 'STORE');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NONE', 'PENDING', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleItemPriceType" AS ENUM ('PRICE', 'WHOLESALE_PRICE', 'MANUAL');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "cuit" TEXT,
    "rubro" TEXT,
    "plan" "BusinessPlan" NOT NULL DEFAULT 'BASICO',
    "status" "BusinessStatus" NOT NULL DEFAULT 'TRIAL',
    "modulosActivos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fechaAlta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximoVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordResetExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "defaultStockLocation" "Location",
    "defaultPriceCategory" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "addressApartment" TEXT,
    "addressCity" TEXT,
    "addressFloor" TEXT,
    "addressNotes" TEXT,
    "addressNumber" TEXT,
    "addressPostalCode" TEXT,
    "addressProvince" TEXT,
    "addressStreet" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessLocationType" NOT NULL DEFAULT 'BRANCH',
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressCity" TEXT,
    "addressProvince" TEXT,
    "addressPostalCode" TEXT,
    "addressNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
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
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "minStockDeposito" INTEGER,
    "minStockDepositoKg" DOUBLE PRECISION,
    "ivaPorcentaje" DOUBLE PRECISION NOT NULL DEFAULT 21,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "ivaCondition" TEXT,
    "environment" "ArcaEnvironment" NOT NULL DEFAULT 'HOMOLOGACION',
    "status" "ArcaConfigStatus" NOT NULL DEFAULT 'INACTIVE',
    "certEncrypted" TEXT,
    "keyEncrypted" TEXT,
    "certExpiresAt" TIMESTAMP(3),
    "lastTokenAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activityStart" TIMESTAMP(3),
    "certAlias" TEXT,
    "defaultConcept" INTEGER NOT NULL DEFAULT 1,
    "defaultCurrencyId" TEXT NOT NULL DEFAULT 'PES',
    "defaultPointOfSale" INTEGER,
    "fiscalAddress" TEXT,
    "iibb" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "csrEncrypted" TEXT,
    "csrGeneratedAt" TIMESTAMP(3),

    CONSTRAINT "ArcaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfipToken" (
    "id" TEXT NOT NULL,
    "arcaConfigId" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'wsfe',
    "signEncrypted" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,

    CONSTRAINT "AfipToken_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "Remito" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "CbteCounter" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
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
    "isWebSale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "stockLocation" "Location" NOT NULL DEFAULT 'LOCAL',
    "quotationExpiredAt" TIMESTAMP(3),
    "quotationExpiresAt" TIMESTAMP(3),
    "quotationPdfUrl" TEXT,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "businessLocationId" TEXT,
    "declaredValue" DOUBLE PRECISION,
    "deliveryAddressSnapshot" TEXT,
    "deliveryCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryDistanceKm" DOUBLE PRECISION,
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NONE',
    "packagesCount" INTEGER,
    "transportCuit" TEXT,
    "transportName" TEXT,
    "deliveryPricePerKm" DOUBLE PRECISION,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityKg" DOUBLE PRECISION,
    "price" DOUBLE PRECISION NOT NULL,
    "priceType" "SaleItemPriceType" NOT NULL DEFAULT 'PRICE',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productNameSnapshot" TEXT,
    "productSkuSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasePriceSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ivaPorcentajeSnapshot" DOUBLE PRECISION NOT NULL DEFAULT 21,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxContent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,

    CONSTRAINT "BoxContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStats" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
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
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "purchaseId" TEXT,
    "type" "MovementType" NOT NULL,
    "from" "Location",
    "to" "Location",
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "reason" TEXT,
    "reference" TEXT,
    "isClientMovement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuit" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "condicionPago" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDIENTE',
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierAccountMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "userId" TEXT,
    "type" "SupplierAccountMovementType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "previousBalance" DOUBLE PRECISION NOT NULL,
    "newBalance" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod",
    "reference" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessLocationId" TEXT,
    "userId" TEXT NOT NULL,
    "montoApertura" DOUBLE PRECISION NOT NULL,
    "montoCierre" DOUBLE PRECISION,
    "diferencia" DOUBLE PRECISION,
    "observaciones" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseOrderId" TEXT,
    "invoiceNumber" TEXT,
    "description" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "to" "Location" NOT NULL DEFAULT 'DEPOSITO',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'COMPLETED',
    "userId" TEXT,
    "financeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER,
    "quantityKg" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "productNameSnapshot" TEXT,
    "productSkuSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Business_subdomain_key" ON "Business"("subdomain");

-- CreateIndex
CREATE INDEX "Business_subdomain_idx" ON "Business"("subdomain");

-- CreateIndex
CREATE INDEX "Business_slug_idx" ON "Business"("slug");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_passwordResetToken_idx" ON "User"("passwordResetToken");

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

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
CREATE INDEX "Client_businessId_idx" ON "Client"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_businessId_dni_key" ON "Client"("businessId", "dni");

-- CreateIndex
CREATE UNIQUE INDEX "Client_businessId_gmail_key" ON "Client"("businessId", "gmail");

-- CreateIndex
CREATE INDEX "BusinessLocation_type_idx" ON "BusinessLocation"("type");

-- CreateIndex
CREATE INDEX "BusinessLocation_isDefault_idx" ON "BusinessLocation"("isDefault");

-- CreateIndex
CREATE INDEX "BusinessLocation_isActive_idx" ON "BusinessLocation"("isActive");

-- CreateIndex
CREATE INDEX "BusinessLocation_businessId_idx" ON "BusinessLocation"("businessId");

-- CreateIndex
CREATE INDEX "ProductCategory_slug_idx" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");

-- CreateIndex
CREATE INDEX "ProductCategory_businessId_idx" ON "ProductCategory"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_businessId_slug_key" ON "ProductCategory"("businessId", "slug");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_type_idx" ON "Product"("type");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_sku_key" ON "Product"("businessId", "sku");

-- CreateIndex
CREATE INDEX "ProductComponent_componentId_idx" ON "ProductComponent"("componentId");

-- CreateIndex
CREATE INDEX "ProductComponent_businessId_idx" ON "ProductComponent"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponent_compositeId_componentId_key" ON "ProductComponent"("compositeId", "componentId");

-- CreateIndex
CREATE UNIQUE INDEX "ArcaConfig_businessId_key" ON "ArcaConfig"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "ArcaConfig_scope_key" ON "ArcaConfig"("scope");

-- CreateIndex
CREATE INDEX "ArcaConfig_cuit_idx" ON "ArcaConfig"("cuit");

-- CreateIndex
CREATE INDEX "ArcaConfig_isActive_idx" ON "ArcaConfig"("isActive");

-- CreateIndex
CREATE INDEX "ArcaConfig_environment_idx" ON "ArcaConfig"("environment");

-- CreateIndex
CREATE INDEX "ArcaConfig_status_idx" ON "ArcaConfig"("status");

-- CreateIndex
CREATE INDEX "ArcaConfig_businessId_idx" ON "ArcaConfig"("businessId");

-- CreateIndex
CREATE INDEX "AfipToken_expiration_idx" ON "AfipToken"("expiration");

-- CreateIndex
CREATE UNIQUE INDEX "AfipToken_arcaConfigId_service_key" ON "AfipToken"("arcaConfigId", "service");

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
CREATE INDEX "Remito_businessId_idx" ON "Remito"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Remito_businessId_pointOfSale_number_key" ON "Remito"("businessId", "pointOfSale", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Remito_businessId_fullNumber_key" ON "Remito"("businessId", "fullNumber");

-- CreateIndex
CREATE INDEX "RemitoItem_remitoId_idx" ON "RemitoItem"("remitoId");

-- CreateIndex
CREATE INDEX "RemitoItem_productId_idx" ON "RemitoItem"("productId");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_arcaConfigId_idx" ON "ArcaAuditLog"("arcaConfigId");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_userId_idx" ON "ArcaAuditLog"("userId");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_action_idx" ON "ArcaAuditLog"("action");

-- CreateIndex
CREATE INDEX "ArcaAuditLog_createdAt_idx" ON "ArcaAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CbteCounter_businessId_idx" ON "CbteCounter"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CbteCounter_businessId_ptoVta_cbteTipo_key" ON "CbteCounter"("businessId", "ptoVta", "cbteTipo");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_saleId_key" ON "InvoiceAfip"("saleId");

-- CreateIndex
CREATE INDEX "InvoiceAfip_cuit_puntoVenta_tipoComprobante_idx" ON "InvoiceAfip"("cuit", "puntoVenta", "tipoComprobante");

-- CreateIndex
CREATE INDEX "InvoiceAfip_businessId_idx" ON "InvoiceAfip"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_businessId_puntoVenta_tipoComprobante_numero_key" ON "InvoiceAfip"("businessId", "puntoVenta", "tipoComprobante", "numero");

-- CreateIndex
CREATE INDEX "Sale_quotationExpiresAt_idx" ON "Sale"("quotationExpiresAt");

-- CreateIndex
CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");

-- CreateIndex
CREATE INDEX "Sale_userId_idx" ON "Sale"("userId");

-- CreateIndex
CREATE INDEX "Sale_businessLocationId_idx" ON "Sale"("businessLocationId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_priceType_idx" ON "SaleItem"("priceType");

-- CreateIndex
CREATE INDEX "SaleItem_businessId_idx" ON "SaleItem"("businessId");

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
CREATE INDEX "AccountMovement_businessId_idx" ON "AccountMovement"("businessId");

-- CreateIndex
CREATE INDEX "Alert_productId_idx" ON "Alert"("productId");

-- CreateIndex
CREATE INDEX "Alert_resolved_idx" ON "Alert"("resolved");

-- CreateIndex
CREATE INDEX "Alert_businessId_idx" ON "Alert"("businessId");

-- CreateIndex
CREATE INDEX "ProductStats_productId_idx" ON "ProductStats"("productId");

-- CreateIndex
CREATE INDEX "ProductStats_date_idx" ON "ProductStats"("date");

-- CreateIndex
CREATE INDEX "ProductStats_businessId_idx" ON "ProductStats"("businessId");

-- CreateIndex
CREATE INDEX "Finance_type_idx" ON "Finance"("type");

-- CreateIndex
CREATE INDEX "Finance_category_idx" ON "Finance"("category");

-- CreateIndex
CREATE INDEX "Finance_date_idx" ON "Finance"("date");

-- CreateIndex
CREATE INDEX "Finance_businessId_idx" ON "Finance"("businessId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_userId_idx" ON "StockMovement"("userId");

-- CreateIndex
CREATE INDEX "StockMovement_purchaseId_idx" ON "StockMovement"("purchaseId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_idx" ON "StockMovement"("businessId");

-- CreateIndex
CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");

-- CreateIndex
CREATE INDEX "Supplier_isActive_idx" ON "Supplier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_businessId_cuit_key" ON "Supplier"("businessId", "cuit");

-- CreateIndex
CREATE INDEX "PurchaseOrder_businessId_idx" ON "PurchaseOrder"("businessId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_supplierId_idx" ON "SupplierAccountMovement"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_purchaseId_idx" ON "SupplierAccountMovement"("purchaseId");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_type_idx" ON "SupplierAccountMovement"("type");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_date_idx" ON "SupplierAccountMovement"("date");

-- CreateIndex
CREATE INDEX "SupplierAccountMovement_businessId_idx" ON "SupplierAccountMovement"("businessId");

-- CreateIndex
CREATE INDEX "CashSession_businessId_idx" ON "CashSession"("businessId");

-- CreateIndex
CREATE INDEX "CashSession_businessLocationId_idx" ON "CashSession"("businessLocationId");

-- CreateIndex
CREATE INDEX "CashSession_userId_idx" ON "CashSession"("userId");

-- CreateIndex
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_financeId_key" ON "Purchase"("financeId");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_financeId_idx" ON "Purchase"("financeId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");

-- CreateIndex
CREATE INDEX "Purchase_businessId_idx" ON "Purchase"("businessId");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "Purchase_purchaseOrderId_idx" ON "Purchase"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseItem_businessId_idx" ON "PurchaseItem"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");

-- CreateIndex
CREATE INDEX "Invoice_businessId_idx" ON "Invoice"("businessId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLocation" ADD CONSTRAINT "BusinessLocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponent" ADD CONSTRAINT "ProductComponent_compositeId_fkey" FOREIGN KEY ("compositeId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcaConfig" ADD CONSTRAINT "ArcaConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfipToken" ADD CONSTRAINT "AfipToken_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcaPointOfSale" ADD CONSTRAINT "ArcaPointOfSale_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoCaiConfig" ADD CONSTRAINT "RemitoCaiConfig_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_remitoCaiConfigId_fkey" FOREIGN KEY ("remitoCaiConfigId") REFERENCES "RemitoCaiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoItem" ADD CONSTRAINT "RemitoItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoItem" ADD CONSTRAINT "RemitoItem_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcaAuditLog" ADD CONSTRAINT "ArcaAuditLog_arcaConfigId_fkey" FOREIGN KEY ("arcaConfigId") REFERENCES "ArcaConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CbteCounter" ADD CONSTRAINT "CbteCounter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "InvoiceAfip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxContent" ADD CONSTRAINT "BoxContent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxContent" ADD CONSTRAINT "BoxContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxContent" ADD CONSTRAINT "BoxContent_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMovement" ADD CONSTRAINT "AccountMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStats" ADD CONSTRAINT "ProductStats_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStats" ADD CONSTRAINT "ProductStats_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAccountMovement" ADD CONSTRAINT "SupplierAccountMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_financeId_fkey" FOREIGN KEY ("financeId") REFERENCES "Finance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

