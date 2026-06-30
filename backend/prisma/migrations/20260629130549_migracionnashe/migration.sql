-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "isWebSale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "isClientMovement" BOOLEAN NOT NULL DEFAULT false;
