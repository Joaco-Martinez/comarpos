/*
  Warnings:

  - A unique constraint covering the columns `[saleId]` on the table `InvoiceAfip` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "InvoiceAfip_saleId_key" ON "public"."InvoiceAfip"("saleId");

-- AddForeignKey
ALTER TABLE "public"."InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "public"."Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
