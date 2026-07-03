-- ComarPOS "printbox" migration ("add_printbox")
--
-- IMPORTANT — NOT applied automatically. Hand-written (no DB was reachable
-- from the environment that authored this change) following the same
-- convention as `20260629173445_init_multitenant`. Purely additive: two
-- new tables + two new enums, no changes to existing columns. Safe to run
-- with `npx prisma migrate deploy` (or `migrate dev` in a dev DB) whenever
-- convenient — nothing here depends on existing data.
--
-- Context: replaces the old "POS_LOCAL_URL" push-to-a-desktop-app printing
-- model with a per-business Printbox device (ESP32 + W5500) that polls
-- `/printbox/poll` and acks via `/printbox/ack/:id`. See
-- src/services/printbox.service.ts.

-- =====================================================================
-- ENUMS
-- =====================================================================

CREATE TYPE "PrintJobType" AS ENUM ('SALE_TICKET', 'INVOICE', 'CREDIT_NOTE', 'CASH_CLOSE', 'RECEIPT');

CREATE TYPE "PrintJobStatus" AS ENUM ('PENDING', 'PRINTED', 'ERROR');

-- =====================================================================
-- TABLE: Printbox
-- =====================================================================

CREATE TABLE "Printbox" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Printbox',
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Printbox_businessId_key" ON "Printbox"("businessId");
CREATE UNIQUE INDEX "Printbox_token_key" ON "Printbox"("token");
CREATE INDEX "Printbox_token_idx" ON "Printbox"("token");

ALTER TABLE "Printbox" ADD CONSTRAINT "Printbox_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- TABLE: PrintJob
-- =====================================================================

CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "printboxId" TEXT NOT NULL,
    "type" "PrintJobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrintJob_printboxId_status_createdAt_idx" ON "PrintJob"("printboxId", "status", "createdAt");
CREATE INDEX "PrintJob_businessId_idx" ON "PrintJob"("businessId");

ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printboxId_fkey"
    FOREIGN KEY ("printboxId") REFERENCES "Printbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
