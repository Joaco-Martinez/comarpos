-- AddForeignKey
ALTER TABLE "public"."InvoiceAfip" ADD CONSTRAINT "InvoiceAfip_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "public"."InvoiceAfip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
