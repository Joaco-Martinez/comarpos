-- CreateEnum
CREATE TYPE "public"."SaleUnit" AS ENUM ('UNIT', 'KG');

-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "pricePerKg" DOUBLE PRECISION,
ADD COLUMN     "saleUnit" "public"."SaleUnit" NOT NULL DEFAULT 'UNIT',
ADD COLUMN     "stockDepositoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "stockLocalKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."SaleItem" ADD COLUMN     "quantityKg" DOUBLE PRECISION;
