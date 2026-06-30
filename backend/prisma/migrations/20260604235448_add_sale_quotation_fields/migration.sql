-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "quotationExpiredAt" TIMESTAMP(3),
ADD COLUMN     "quotationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "quotationPdfUrl" TEXT;

-- CreateIndex
CREATE INDEX "Sale_quotationExpiresAt_idx" ON "Sale"("quotationExpiresAt");
