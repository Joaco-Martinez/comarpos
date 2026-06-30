/*
  Warnings:

  - You are about to drop the `ProductComponent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ProductComponent" DROP CONSTRAINT "ProductComponent_childId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductComponent" DROP CONSTRAINT "ProductComponent_parentId_fkey";

-- DropTable
DROP TABLE "public"."ProductComponent";

-- CreateTable
CREATE TABLE "public"."BoxContent" (
    "id" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BoxContent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."BoxContent" ADD CONSTRAINT "BoxContent_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "public"."SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BoxContent" ADD CONSTRAINT "BoxContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
