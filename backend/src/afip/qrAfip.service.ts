import QRCode from "qrcode";

export async function generarQR({
  fecha,            // "YYYYMMDD"
  cuit,             // string o number
  puntoVenta,       // number
  tipoComprobante,  // number
  numero,           // number
  total,            // number
  tipoDoc,          // number
  nroDoc,           // number
  cae,              // string o number
}: {
  fecha: string;
  cuit: string | number;
  puntoVenta: number;
  tipoComprobante: number;
  numero: number;
  total: number;
  tipoDoc: number;
  nroDoc: number;
  cae: string | number;
}) {
  const payload = {
    ver: 1,
    fecha: `${fecha.slice(0,4)}-${fecha.slice(4,6)}-${fecha.slice(6,8)}`,
    cuit: Number(cuit),                 // 👈 en número
    ptoVta: Number(puntoVenta),
    tipoCmp: Number(tipoComprobante),
    nroCmp: Number(numero),
    importe: Number(total.toFixed(2)),  // 👈 2 decimales
    moneda: "PES",
    ctz: 1,
    tipoDocRec: Number(tipoDoc),
    nroDocRec: Number(nroDoc),
    tipoCodAut: "E",
    codAut: Number(cae),                // 👈 en número (CAE)
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  const urlQR = `https://www.afip.gob.ar/fe/qr/?p=${encoded}`;
  const qrDataURL = await QRCode.toDataURL(urlQR);

  return { urlQR, qrDataURL, payload }; // payload devuelto por si querés loguearlo
}
