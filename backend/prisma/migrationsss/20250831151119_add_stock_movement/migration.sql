-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('TRANSFER', 'INGRESS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."Location" AS ENUM ('LOCAL', 'DEPOSITO');

-- CreateTable
CREATE TABLE "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "public"."MovementType" NOT NULL,
    "from" "public"."Location",
    "to" "public"."Location",
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
