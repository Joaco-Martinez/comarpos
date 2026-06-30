import PDFDocument from "pdfkit";
import axios from "axios";
import fs from "fs";
import path from "path";
import { uploadPDFtoCloudinary } from "../utils/uploadPDFtoCloudinary";
import prisma from "../../prisma";

type Product = {
  name: string;
  quantity: number;
  quantityKg?: number | null;
  price: number;
  subtotal?: number;
};

type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";

const POS_LOCAL_URL = process.env.POS_LOCAL_URL;
const POS_LOCAL_TOKEN = process.env.POS_LOCAL_TOKEN;
const PAGE_WIDTH = 226;

function getLetraComprobante(tipoComprobante: number): string {
  switch (tipoComprobante) {
    case 1:
      return "A";
    case 6:
      return "B";
    case 11:
      return "C";
    case 3:
      return "A";
    case 8:
      return "B";
    case 13:
      return "C";
    default:
      return "?";
  }
}

function getReceiptType(tipoComprobante: number): string {
  switch (tipoComprobante) {
    case 1:
      return "FACTURA A";
    case 6:
      return "FACTURA B";
    case 11:
      return "FACTURA C";
    case 3:
      return "NOTA DE CRÉDITO A";
    case 8:
      return "NOTA DE CRÉDITO B";
    case 13:
      return "NOTA DE CRÉDITO C";
    default:
      return "COMPROBANTE";
  }
}

function getCondicionIVAEmisor(tipoComprobante: number): string {
  if (
    tipoComprobante === 1 ||
    tipoComprobante === 6 ||
    tipoComprobante === 3 ||
    tipoComprobante === 8
  ) {
    return "IVA: RESPONSABLE INSCRIPTO";
  }

  return "IVA: RESPONSABLE MONOTRIBUTO";
}

function getClienteLabel(tipoCliente?: TipoCliente): string {
  switch (tipoCliente) {
    case "Mayorista":
      return "CLIENTE MAYORISTA";
    case "Cliente":
      return "CLIENTE";
    case "Consumidor Final":
    default:
      return "CONSUMIDOR FINAL";
  }
}

function getCondicionIVAReceptorLabel(
  tipoComprobante: number,
  tipoCliente?: TipoCliente
) {
  if (tipoComprobante === 11 || tipoComprobante === 13) {
    return "CONDICIÓN IVA RECEPTOR: CONSUMIDOR FINAL";
  }

  if (tipoCliente === "Mayorista" || tipoCliente === "Cliente") {
    return "CONDICIÓN IVA RECEPTOR: RESPONSABLE INSCRIPTO / SEGÚN PADRÓN";
  }

  return "CONDICIÓN IVA RECEPTOR: CONSUMIDOR FINAL";
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDateAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatTimeAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDateTimeTicket(date: Date) {
  return `${formatDateAR(date)} ${formatTimeAR(date)}`;
}

function formatCaeDate(date: Date) {
  return formatDateAR(date);
}

function formatPointOfSale(value: number) {
  return String(value).padStart(4, "0");
}

function formatCbteNumber(value: number) {
  return String(value).padStart(8, "0");
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildTicketPayload({
  tipoComprobante,
  puntoVenta,
  numero,
  fechaEmision,
  nombreCliente,
  total,
  metodoPago,
  cae,
  caeVto,
  products,
  cuit,
  razonSocial,
  direccion,
  documentoCliente,
  telefonoCliente,
  qrUrl,
}: {
  tipoComprobante: number;
  puntoVenta: number;
  numero: number;
  fechaEmision: Date;
  nombreCliente: string;
  total: number;
  metodoPago: string;
  cae: string;
  caeVto: Date;
  products?: Product[];
  cuit: string;
  razonSocial: string;
  direccion: string;
  documentoCliente?: string | number;
  telefonoCliente?: string;
  qrUrl?: string | null;
}) {
  const items = (products ?? []).map((product) => {
    const quantity = numberOrZero(product.quantity);

    const quantityKg =
      product.quantityKg !== null && product.quantityKg !== undefined
        ? numberOrZero(product.quantityKg)
        : undefined;

    const price = numberOrZero(product.price);

    const subtotal =
      product.subtotal !== undefined && product.subtotal !== null
        ? numberOrZero(product.subtotal)
        : quantityKg !== undefined && quantityKg > 0
        ? quantityKg * price
        : quantity * price;

    return {
      name: product.name,
      quantity,
      ...(quantityKg !== undefined ? { quantityKg } : {}),
      price,
      subtotal,
    };
  });

  const subtotal = items.reduce((acc, item) => acc + numberOrZero(item.subtotal), 0);
  const discount = subtotal > total ? subtotal - total : 0;

  return {
    saleId: `FAC-${formatCbteNumber(numero)}`,
    receiptType: getReceiptType(tipoComprobante),
    paymentMethod: metodoPago,
    createdAt: formatDateTimeTicket(fechaEmision),

    business: {
      name: process.env.BUSINESS_NAME ?? razonSocial ?? "ComarPOS",
      subtitle: process.env.BUSINESS_SUBTITLE ?? "",
      cuit: process.env.BUSINESS_CUIT ?? cuit,
      address: process.env.BUSINESS_ADDRESS ?? direccion,
      phone: process.env.BUSINESS_PHONE ?? "Teléfono del negocio",
    },

    client: {
      name: nombreCliente || "Consumidor Final",
      dni: documentoCliente ? String(documentoCliente) : "",
      phone: telefonoCliente ?? "",
    },

    items,

    subtotal,
    discount,
    total: numberOrZero(total),

    afip: {
      invoiceLetter: getLetraComprobante(tipoComprobante),
      pointOfSale: formatPointOfSale(puntoVenta),
      cbteNumber: formatCbteNumber(numero),
      cae,
      caeExpiresAt: formatCaeDate(caeVto),
      qrUrl: qrUrl ?? "",
    },

    footer: "Gracias por su compra",
  };
}

async function enviarTicketAlPOSLocal(payload: any) {
  if (!POS_LOCAL_URL) {
    console.warn("⚠️ POS_LOCAL_URL no configurado, no se imprimió localmente");
    return;
  }

  const url = `${POS_LOCAL_URL.replace(/\/$/, "")}/print/ticket`;

  console.log("🖨️ Enviando ticket JSON al POS local:", url);
  console.log("📦 Payload enviado:", JSON.stringify(payload, null, 2));

  await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      ...(POS_LOCAL_TOKEN ? { "x-pos-token": POS_LOCAL_TOKEN } : {}),
    },
    timeout: 60000,
  });

  console.log("✅ Ticket enviado correctamente al POS local");
}

export async function generarFacturaAfipPDF({
  tipoComprobante,
  puntoVenta,
  saleId,
  numero,
  fechaEmision,
  nombreCliente = "A CONSUMIDOR FINAL ***********",
  domicilioCliente = "",
  total,
  metodoPago = "EFECTIVO",
  cae,
  caeVto,
  products,
  cuit,
  razonSocial = process.env.BUSINESS_NAME ?? "ComarPOS",
  direccion = process.env.BUSINESS_ADDRESS ?? "",
  qrBase64,
  qrUrl,

  tipoCliente = "Consumidor Final",
  documentoCliente,
  telefonoCliente,
}: {
  tipoComprobante: number;
  puntoVenta: number;
  saleId: string;
  numero: number;
  fechaEmision: Date;
  nombreCliente?: string;
  domicilioCliente?: string;
  total: number;
  metodoPago?: string;
  cae: string;
  caeVto: Date;
  cuit: string;
  razonSocial?: string;
  direccion?: string;
  qrBase64?: string | null;
  qrUrl?: string | null;
  products?: Product[];

  tipoCliente?: TipoCliente;
  documentoCliente?: string | number;
  telefonoCliente?: string;
}) {
  return new Promise<void>((resolve, reject) => {
    let filePath = "";

    try {
      const basePath = path.resolve("./");
      filePath = path.join(basePath, `factura-${numero}.pdf`);
      const logoPath = path.join(basePath, "assets/logo-comarpos.png");

      const letraComprobante = getLetraComprobante(tipoComprobante);
      const condicionIVAEmisor = getCondicionIVAEmisor(tipoComprobante);
      const clienteLabel = getClienteLabel(tipoCliente);
      const condicionIVAReceptor = getCondicionIVAReceptorLabel(
        tipoComprobante,
        tipoCliente
      );

      const doc = new PDFDocument({
        size: [PAGE_WIDTH, 1000],
        margin: 10,
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      if (fs.existsSync(logoPath)) {
        const imgWidth = 80;
        const x = (PAGE_WIDTH - imgWidth) / 2;
        doc.image(logoPath, x, 8, { width: imgWidth });
        doc.moveDown(4.8);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`FACTURA ${letraComprobante}`, { align: "center" });

      doc
        .font("Helvetica")
        .fontSize(9)
        .text(
          `NRO: ${String(puntoVenta).padStart(4, "0")}-${String(numero).padStart(
            8,
            "0"
          )}`,
          { align: "center" }
        )
        .text(`${formatDateAR(fechaEmision)} ${formatTimeAR(fechaEmision)}`, {
          align: "center",
        })
        .moveDown(0.8);

      doc.fontSize(9).text(razonSocial, { align: "center" });

      doc
        .fontSize(8)
        .text(direccion, { align: "center" })
        .text(`CUIT: ${cuit}`, { align: "center" })
        .text(condicionIVAEmisor, { align: "center" })
        .moveDown(0.8);

      const yCliente = doc.y;
      doc.rect(5, yCliente, 216, 70).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(clienteLabel, 0, yCliente + 6, {
          align: "center",
          width: PAGE_WIDTH,
        });

      doc
        .font("Helvetica")
        .fontSize(8)
        .text(nombreCliente || "-", {
          align: "center",
          width: PAGE_WIDTH,
        });

      if (documentoCliente) {
        doc.text(`DOC: ${documentoCliente}`, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      if (telefonoCliente) {
        doc.text(`TEL: ${telefonoCliente}`, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      if (domicilioCliente) {
        doc.text(domicilioCliente, {
          align: "center",
          width: PAGE_WIDTH,
        });
      }

      doc.text(condicionIVAReceptor, {
        align: "center",
        width: PAGE_WIDTH,
      });

      doc.moveDown(1.2);

      doc.font("Helvetica-Bold").fontSize(10).text("DETALLE", {
        align: "center",
      });
      doc.moveDown(0.5);

      if (products && products.length > 0) {
        doc.font("Helvetica").fontSize(8);

        const tableWidth = 195;
        const tableLeft = (PAGE_WIDTH - tableWidth) / 2;
        const tableTop = doc.y;

        products.forEach((prod, index) => {
          const quantityForImporte =
            prod.quantityKg !== null && prod.quantityKg !== undefined
              ? Number(prod.quantityKg)
              : Number(prod.quantity);

          const importe =
            prod.subtotal !== undefined && prod.subtotal !== null
              ? Number(prod.subtotal)
              : quantityForImporte * Number(prod.price);

          const tableRowTop = tableTop + index * 10;

          doc.text(`${quantityForImporte}`, tableLeft, tableRowTop, {
            width: 25,
            align: "left",
          });

          doc.text(
            prod.name.length > 18 ? `${prod.name.slice(0, 18)}…` : prod.name,
            tableLeft + 25,
            tableRowTop,
            {
              width: 100,
              align: "left",
            }
          );

          doc.text(formatCurrency(importe), tableLeft + 125, tableRowTop, {
            width: 60,
            align: "right",
          });
        });

        doc.y = tableTop + products.length * 10 + 10;
      } else {
        doc.fontSize(8).text("(sin productos)", { align: "center" });
      }

      doc.moveDown(1);

      const yTotal = doc.y;
      doc.rect(5, yTotal, 216, 25).stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(`TOTAL ${formatCurrency(total)}`, 0, yTotal + 6, {
          align: "center",
          width: PAGE_WIDTH,
        });

      doc.y = yTotal + 35;

      const yDatos = doc.y;
      doc.rect(5, yDatos, 216, 70).stroke();

      doc.font("Helvetica").fontSize(8);
      doc.text(`FORMA DE PAGO: ${metodoPago}`, 0, yDatos + 5, {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text("FACTURA ELECTRÓNICA AUTORIZADA", {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text(`CAE: ${cae}`, { align: "center", width: PAGE_WIDTH });
      doc.text(`FV: ${formatCaeDate(caeVto)}`, {
        align: "center",
        width: PAGE_WIDTH,
      });
      doc.text("CÓDIGO QR ARCA R.G. 4892/2020", {
        align: "center",
        width: PAGE_WIDTH,
      });

      doc.y = yDatos + 85;

      if (qrBase64) {
        const qrPath = path.join(basePath, `qr-${numero}.png`);
        const base64Data = qrBase64.replace(/^data:image\/png;base64,/, "");

        fs.writeFileSync(qrPath, base64Data, "base64");

        const xQR = (PAGE_WIDTH - 110) / 2;
        const yQR = doc.y;

        doc.rect(5, yQR - 3, 216, 125).stroke();
        doc.image(qrPath, xQR, yQR + 5, { width: 110 });

        fs.unlinkSync(qrPath);
        doc.y = yQR + 135;
      } else {
        doc
          .font("Helvetica")
          .fontSize(7)
          .text("QR no disponible en PDF", {
            align: "center",
            width: PAGE_WIDTH,
          });

        doc.moveDown(1);
      }

      const yPie = doc.y;
      doc.rect(5, yPie, 216, 60).stroke();

      doc
        .fontSize(7)
        .text("PARA ACCEDER A ESTE COMPROBANTE", 0, yPie + 5, {
          align: "center",
          width: PAGE_WIDTH,
        })
        .text("comprobante.afip.gob.ar", {
          align: "center",
          width: PAGE_WIDTH,
        })
        .moveDown(0.5)
        .text(
          "Este comprobante fue emitido conforme a las disposiciones de AFIP. Gracias por su compra.",
          {
            align: "center",
            width: 216,
            indent: 5,
          }
        );

      doc.end();

      stream.on("finish", async () => {
        try {
          console.log("🧾 PDF generado correctamente:", filePath);

          const pdfUrl = await uploadPDFtoCloudinary(filePath);

          await prisma.sale.update({
            where: { id: saleId },
            data: { pdfUrl },
          });

          console.log("✅ Factura subida y asociada correctamente");

          const ticketPayload = buildTicketPayload({
            tipoComprobante,
            puntoVenta,
            numero,
            fechaEmision,
            nombreCliente,
            total,
            metodoPago,
            cae,
            caeVto,
            products,
            cuit,
            razonSocial,
            direccion,
            documentoCliente,
            telefonoCliente,
            qrUrl,
          });

          await enviarTicketAlPOSLocal(ticketPayload);

          resolve();
        } catch (err: any) {
          console.error("⚠️ Error al procesar factura:", err.message);
          reject(err);
        } finally {
          if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🧹 Archivo temporal eliminado:", filePath);
          }
        }
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}