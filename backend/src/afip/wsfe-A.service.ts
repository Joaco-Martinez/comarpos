import { emitirFacturaAFIPBase } from "./wsfe-base.service";

export async function emitirFacturaA({
  saleId,
  cuit,
  nroDoc,
  importe,
  condicionIVAReceptor = 1,
}: {
  saleId: string;
  cuit?: string;
  nroDoc: number;
  importe: number;
  condicionIVAReceptor?: number;
}) {
  return emitirFacturaAFIPBase({
    saleId,
    cuit,
    tipoComprobante: 1,
    tipoDoc: 80,
    nroDoc,
    importe,
    condicionIVAReceptor,
  });
}
