import { emitirFacturaAFIPBase } from "./wsfe-base.service";

export async function emitirFacturaB({
  saleId,
  cuit,
  tipoDoc,
  nroDoc,
  importe,
  condicionIVAReceptor = 5,
}: {
  saleId: string;
  cuit?: string;
  tipoDoc: number;
  nroDoc: number;
  importe: number;
  condicionIVAReceptor?: number;
}) {
  return emitirFacturaAFIPBase({
    saleId,
    cuit,
    tipoComprobante: 6,
    tipoDoc,
    nroDoc,
    importe,
    condicionIVAReceptor,
  });
}
