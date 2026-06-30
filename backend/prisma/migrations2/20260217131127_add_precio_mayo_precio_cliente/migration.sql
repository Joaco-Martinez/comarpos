-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "clientPricePerKg" DOUBLE PRECISION,
ADD COLUMN     "wholesalePricePerKg" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."StockMovement" ADD COLUMN     "quantityKg" DOUBLE PRECISION,
ALTER COLUMN "quantity" DROP NOT NULL;
