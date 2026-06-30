-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PaymentMethod" ADD VALUE 'QR_NACION';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'QR_MERCADOPAGO';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'TARJETA_DEBITO';
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'TARJETA_CREDITO';

-- DropForeignKey
ALTER TABLE "public"."SalePayment" DROP CONSTRAINT "SalePayment_saleId_fkey";

-- AlterTable
ALTER TABLE "public"."SalePayment" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE INDEX "SalePayment_saleId_idx" ON "public"."SalePayment"("saleId");

-- AddForeignKey
ALTER TABLE "public"."SalePayment" ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
