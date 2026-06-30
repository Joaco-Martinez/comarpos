-- CreateEnum
CREATE TYPE "public"."SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."Sale" ADD COLUMN     "status" "public"."SaleStatus" NOT NULL DEFAULT 'PENDING';
