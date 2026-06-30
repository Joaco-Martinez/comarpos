/**
 * Mapeo de alícuota de IVA (porcentaje) -> Id oficial de AFIP (Iva.Id en WSFE).
 * Códigos estándar AFIP:
 *   3 = 0% (exento/no gravado a nivel alícuota)
 *   4 = 10.5%
 *   5 = 21%
 *   6 = 27%
 *   8 = 5%
 *   9 = 2.5%
 */
export const AFIP_ALICUOTA_IVA_ID: Record<string, number> = {
  "0": 3,
  "10.5": 4,
  "21": 5,
  "27": 6,
  "5": 8,
  "2.5": 9,
};

export function getAfipAlicuotaId(ivaPorcentaje: number): number {
  const key = String(ivaPorcentaje);
  const id = AFIP_ALICUOTA_IVA_ID[key];

  if (id) return id;

  // Fallback: si no matchea exacto, default a 21% (Id 5)
  return 5;
}

export type SaleItemForIva = {
  subtotal: number;
  ivaPorcentajeSnapshot: number;
};

export type AlicuotaIva = {
  id: number;
  baseImp: number;
  importe: number;
};

export type IvaCalculoResult = {
  alicuotas: AlicuotaIva[];
  totalIva: number;
  totalNeto: number;
};

/**
 * Agrupa los items de una venta por su alícuota de IVA (ivaPorcentajeSnapshot)
 * y calcula la base imponible (neto) y el importe de IVA por cada grupo.
 *
 * Reemplaza el cálculo hardcodeado `importe / 1.21` para soportar facturas
 * con múltiples alícuotas (21%, 10.5%, 27%, 5%, 2.5%, 0%/exento).
 */
export function calcularIvaPorAlicuota(items: SaleItemForIva[]): IvaCalculoResult {
  const groups = new Map<number, { baseImp: number; importe: number }>();

  for (const item of items) {
    const rate = item.ivaPorcentajeSnapshot ?? 21;
    const subtotal = item.subtotal ?? 0;
    const neto = rate > 0 ? subtotal / (1 + rate / 100) : subtotal;
    const iva = subtotal - neto;

    const existing = groups.get(rate) ?? { baseImp: 0, importe: 0 };
    existing.baseImp += neto;
    existing.importe += iva;
    groups.set(rate, existing);
  }

  const alicuotas: AlicuotaIva[] = Array.from(groups.entries()).map(
    ([rate, { baseImp, importe }]) => ({
      id: getAfipAlicuotaId(rate),
      baseImp: +baseImp.toFixed(2),
      importe: +importe.toFixed(2),
    })
  );

  const totalNeto = +alicuotas.reduce((acc, a) => acc + a.baseImp, 0).toFixed(2);
  const totalIva = +alicuotas.reduce((acc, a) => acc + a.importe, 0).toFixed(2);

  return { alicuotas, totalIva, totalNeto };
}

/**
 * Construye el bloque XML <ar:Iva> con uno o más <ar:AlicIva> a partir
 * del resultado de calcularIvaPorAlicuota.
 */
export function buildIvaXml(alicuotas: AlicuotaIva[]): string {
  if (!alicuotas.length) return "";

  const alicIvaBlocks = alicuotas
    .map(
      (a) => `
        <ar:AlicIva>
          <ar:Id>${a.id}</ar:Id>
          <ar:BaseImp>${a.baseImp.toFixed(2)}</ar:BaseImp>
          <ar:Importe>${a.importe.toFixed(2)}</ar:Importe>
        </ar:AlicIva>`
    )
    .join("");

  return `
      <ar:Iva>${alicIvaBlocks}
      </ar:Iva>
    `;
}
