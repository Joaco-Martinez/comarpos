import axios from "axios";
import prisma from "../prisma";
import PDFDocument from "pdfkit";
import { Buffer } from "buffer";
import { dayRangeAR, rangeAR } from "../utils/dateAR";

type CashClosePrintBody =
  | { date: string }
  | { from: string; to: string };

function isRangeBody(body: any): body is { from: string; to: string } {
  return typeof body?.from === "string" && typeof body?.to === "string";
}
function isDateBody(body: any): body is { date: string } {
  return typeof body?.date === "string";
}

async function textToPdfBase64(text: string) {
  const doc = new PDFDocument({ size: [226, 1000], margin: 10 });
  const chunks: Buffer[] = [];

  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  doc.font("Courier").fontSize(9).text(text);
  doc.end();

  const pdfBuffer = await done;
  return pdfBuffer.toString("base64");
}

function formatMoneyARS(n: number) {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeMethodCode(pm?: string | null) {
  const v = String(pm ?? "UNKNOWN");

  // nuevos
  if (v === "QR_NACION") return "QR_NACION";
  if (v === "QR_MERCADOPAGO") return "QR_MP";
  if (v === "TARJETA_DEBITO") return "CARD_DEBIT";
  if (v === "TARJETA_CREDITO") return "CARD_CREDIT";

  // viejos / genéricos
  if (v === "EFECTIVO") return "CASH";
  if (v === "TRANSFERENCIA") return "TRANSFER";
  if (v === "DEBITO") return "CARD_DEBIT";
  if (v === "CREDITO") return "CARD_CREDIT";
  if (v === "TARJETA") return "CARD";
  if (v === "QR") return "QR";

  return "UNKNOWN";
}

function labelMethod(code: string) {
  const map: Record<string, string> = {
    CASH: "Efectivo",
    CARD_CREDIT: "Tarj. Crédito",
    CARD_DEBIT: "Tarj. Débito",
    CARD: "Tarjeta (gen)",
    QR_MP: "QR MercadoPago",
    QR_NACION: "QR Nación",
    QR: "QR (gen)",
    TRANSFER: "Transferencia",
    UNKNOWN: "Sin definir",
  };
  return map[code] ?? code;
}

// ===== Helpers ticket =====
const WIDTH = 30;

function line(char = "-") {
  return char.repeat(WIDTH);
}
function center(text: string) {
  const t = text.slice(0, WIDTH);
  const left = Math.floor((WIDTH - t.length) / 2);
  return " ".repeat(Math.max(0, left)) + t;
}
function cut(text: string, n: number) {
  return text.length > n ? text.slice(0, n) : text;
}
function right(text: string) {
  return text.padStart(WIDTH, " ");
}

function buildTicket(params: {
  from: Date;
  to: Date;
  totalAmount: number;
  totalCount: number;
  byMethod: Array<{ methodCode: string; amount: number; count: number }>;
}) {
  const { from, to, totalAmount, totalCount, byMethod } = params;

  const fromStr = from.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const toStr = to.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const header = [
    center(process.env.BUSINESS_NAME ?? "ComarPOS"),
    center("CIERRE DE CAJA"),
    line(),
    cut(`Desde: ${fromStr}`, WIDTH),
    cut(`Hasta: ${toStr}`, WIDTH),
    line(),
  ];

  const methods = byMethod
    .sort((a, b) => b.amount - a.amount)
    .map((m) => {
      const name = cut(labelMethod(m.methodCode), 16).padEnd(16, " ");
      const cnt = String(m.count).padStart(3, " ");
      const amt = formatMoneyARS(m.amount).padStart(10, " ");
      return `${name} x${cnt} ${amt}`;
    });

  const footer = [
    line(),
    cut(`Ventas: ${totalCount}`, WIDTH),
    right(`TOTAL: $ ${formatMoneyARS(totalAmount)}`),
    line(),
    center("Gracias"),
    "",
    "",
  ];

  return [...header, ...methods, ...footer].join("\n");
}

async function sendToLocalPrinter(payload: { text: string; meta?: any }) {
  const localPOS = process.env.POS_LOCAL_URL;
  if (!localPOS) throw new Error("POS_LOCAL_URL no configurado. No se puede imprimir.");

  const pdfBase64 = await textToPdfBase64(payload.text);

  await axios.post(
    `${localPOS}/print`,
    {
      pdfBase64,
      factura: {
        tipo: "CASH_CLOSE",
        ...payload.meta,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    }
  );
}

export async function printCashClose(body: CashClosePrintBody) {
  let start: Date;
  let end: Date;

  if (isRangeBody(body)) {
    ({ start, end } = rangeAR(body.from, body.to));
  } else if (isDateBody(body)) {
    ({ start, end } = dayRangeAR(body.date));
  } else {
    throw new Error("Body inválido");
  }

  // ✅ MISMA FUENTE QUE LA UI: FINANCE
  const records = await prisma.finance.findMany({
    where: {
      date: { gte: start, lte: end },
      type: "INGRESO",
    },
    select: {
      amount: true,
      category: true,
      paymentMethod: true,
    },
    orderBy: { date: "asc" },
  });

  // ✅ Solo ventas (tolerante a mayúsculas / espacios)
  const ventas = records.filter((r) => {
    const cat = String(r.category ?? "").trim().toLowerCase();
    return cat === "venta";
  });

  const map = new Map<string, { amount: number; count: number }>();

  for (const v of ventas) {
    const methodCode = normalizeMethodCode(v.paymentMethod as any);
    const amt = Number(v.amount ?? 0);

    const prev = map.get(methodCode) ?? { amount: 0, count: 0 };
    prev.amount = Number((prev.amount + (Number.isFinite(amt) ? amt : 0)).toFixed(2));
    prev.count += 1;
    map.set(methodCode, prev);
  }

  const byMethod = Array.from(map.entries()).map(([methodCode, v]) => ({
    methodCode,
    amount: v.amount,
    count: v.count,
  }));

  const totalAmount = Number(byMethod.reduce((acc, m) => acc + m.amount, 0).toFixed(2));
  const totalCount = ventas.length;

  const ticket = buildTicket({ from: start, to: end, totalAmount, totalCount, byMethod });

  // ✅ imprimir (descomentá)
  await sendToLocalPrinter({
    text: ticket,
    meta: {
      start: start.toISOString(),
      end: end.toISOString(),
      totalAmount,
      totalCount,
      byMethod,
    },
  });

  // console.log("=== TICKET DE CIERRE DE CAJA (DESDE FINANCE) ===");
  // console.log(ticket);

  return { ok: true, start, end, totalAmount, totalCount, byMethod };
}