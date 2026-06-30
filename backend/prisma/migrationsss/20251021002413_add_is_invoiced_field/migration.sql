-- AlterTable
ALTER TABLE "public"."InvoiceAfip" ADD COLUMN     "saleId" TEXT;

-- AlterTable
ALTER TABLE "public"."Sale" ADD COLUMN     "isInvoiced" BOOLEAN NOT NULL DEFAULT false;
