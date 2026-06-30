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

    CONSTRAINT "InvoiceAfip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CbteCounter_ptoVta_cbteTipo_key" ON "public"."CbteCounter"("ptoVta", "cbteTipo");

-- CreateIndex
CREATE INDEX "InvoiceAfip_cuit_puntoVenta_tipoComprobante_idx" ON "public"."InvoiceAfip"("cuit", "puntoVenta", "tipoComprobante");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_puntoVenta_tipoComprobante_numero_key" ON "public"."InvoiceAfip"("puntoVenta", "tipoComprobante", "numero");
