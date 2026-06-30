-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('NONE', 'PENDING_AFIP', 'INVOICED', 'ERROR');

-- AlterTable
ALTER TABLE "public"."Sale" ADD COLUMN     "afipLastError" TEXT,
ADD COLUMN     "afipPayloadJson" JSONB,
ADD COLUMN     "invoiceStatus" "public"."InvoiceStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
