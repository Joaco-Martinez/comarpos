-- AlterTable
ALTER TABLE "public"."ProductStats" ADD COLUMN     "quantityKg" DOUBLE PRECISION,
ALTER COLUMN "quantity" DROP NOT NULL;
