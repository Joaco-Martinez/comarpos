-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "priceType" "SaleItemPriceType" NOT NULL DEFAULT 'PRICE';

-- CreateIndex
CREATE INDEX "SaleItem_priceType_idx" ON "SaleItem"("priceType");
