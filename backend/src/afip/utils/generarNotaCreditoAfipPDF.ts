import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { uploadPDFtoCloudinary } from "../utils/uploadPDFtoCloudinary";
import prisma from "../../prisma";
import { printboxService } from "../../services/printbox.service";

type Product = {
  name: string;
  quantity: number;
  price: number;
};

function getLetraComprobanteNC(tipoComprobante: number): string {
  if (tipoComprobante === 3) return "A";
  if (tipoComprobante === 8) return "B";
  return "C";
}

function buildTicketPayloadNC({
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
}) {
  const items = (products ?? []).map((p) => ({
    name: p.name,
    quantity: p.quantity,
    price: p.price,
    subtotal: p.quantity * p.price,
  }));

  return {
    saleId: `NC-${String(puntoVenta).padStart(4, "0")}-${String(numero).padStart(8, "0")}`,
    receiptType: `NOTA DE CRÉDITO ${getLetraComprobanteNC(tipoComprobante)}`,
    paymentMethod: metodoPago,
    createdAt: fechaEmision.toLocaleString("es-AR"),

    business: {
      name: process.env.BUSINESS_NAME ?? razonSocial ?? "ComarPOS",
      subtitle: process.env.BUSINESS_SUBTITLE ?? "",
      cuit: process.env.BUSINESS_CUIT ?? cuit,
      address: process.env.BUSINESS_ADDRESS ?? direccion,
      phone: process.env.BUSINESS_PHONE ?? "",
    },

    client: {
      name: nombreCliente || "Consumidor Final",
    },

    items,
    subtotal: items.reduce((acc, i) => acc + i.subtotal, 0),
    discount: 0,
    total,

    afip: {
      invoiceLetter: getLetraComprobanteNC(tipoComprobante),
      pointOfSale: String(puntoVenta).padStart(4, "0"),
      cbteNumber: String(numero).padStart(8, "0"),
      cae,
      caeExpiresAt: caeVto.toLocaleDateString("es-AR"),
    },

    footer: "Nota de crédito - documento sin valor fiscal como comprobante de compra",
  };
}

export async function generarNotaCreditoAfipPDF({
  businessId,
  tipoComprobante,
  puntoVenta,
  numero,
  saleId,
  fechaEmision,
  nombreCliente = "A CONSUMIDOR FINAL ***********",
  domicilioCliente = "",
  total,
  metodoPago = "EFECTIVO",
  cae,
  caeVto,
  cuit,
  razonSocial = process.env.BUSINESS_NAME ?? "ComarPOS",
  direccion = process.env.BUSINESS_ADDRESS ?? "",
  qrBase64,
  products,
}: {
  businessId: string;
  tipoComprobante: number;
  puntoVenta: number;
  numero: number;
  saleId: string;
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
  products?: Product[];
}) {
  return new Promise<void>((resolve, reject) => {
    try {
      const basePath = path.resolve("./");
      const filePath = path.join(basePath, `nota-credito-${numero}.pdf`);
      const logoPath = path.join(basePath, "assets/logo-comarpos.png");

      const doc = new PDFDocument({ size: [226, 1000], margin: 10 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // --- LOGO ---
      if (fs.existsSync(logoPath)) {
        const imgWidth = 80;
        const x = (226 - imgWidth) / 2;
        doc.image(logoPath, x, 8, { width: imgWidth });
        doc.moveDown(4.8);
      }

      // --- ENCABEZADO ---
      doc.font("Helvetica-Bold")
        .fillColor("red")
        .fontSize(12)
        .text(`NOTA DE CRÉDITO ${tipoComprobante === 13 ? "C" : "B"}`, { align: "center" });

      doc.font("Helvetica")
        .fillColor("black")
        .fontSize(9)
        .text(
          `NRO: ${String(puntoVenta).padStart(4, "0")}-${String(numero).padStart(8, "0")}`,
          { align: "center" }
        )
        .text(
          `${fechaEmision.toLocaleDateString("es-AR")} ${fechaEmision
            .toLocaleTimeString("es-AR")
            .slice(0, 5)}`,
          { align: "center" }
        )
        .moveDown(0.8);

      // --- DATOS DEL EMISOR ---
      doc.fontSize(9).text(razonSocial, { align: "center" });
      doc.fontSize(8)
        .text(direccion, { align: "center" })
        .text(`CUIT: ${cuit}`, { align: "center" })
        .text("IVA: RESPONSABLE MONOTRIBUTO", { align: "center" })
        .moveDown(0.8);

      // --- CLIENTE ---
      doc.fontSize(8).text(nombreCliente, { align: "center" });
      if (domicilioCliente) doc.text(domicilioCliente, { align: "center" });
      doc.moveDown(0.6);

      // --- DETALLE ---
      doc.font("Helvetica-Bold")
        .fontSize(10)
        .text("DEVOLUCIÓN DE PRODUCTOS", { align: "center" });
      doc.moveDown(0.5);

      if (products && products.length > 0) {
        doc.font("Helvetica").fontSize(8);
        const tableWidth = 195;
        const tableLeft = (226 - tableWidth) / 2;
        const tableTop = doc.y;

        products.forEach((prod, index) => {
          const importe = prod.quantity * prod.price;
          const tableRowTop = tableTop + index * 10;
          doc.text(`${prod.quantity}`, tableLeft, tableRowTop, { width: 25, align: "left" });
          doc.text(
            prod.name.length > 18 ? prod.name.slice(0, 18) + "…" : prod.name,
            tableLeft + 25,
            tableRowTop,
            { width: 100, align: "left" }
          );
          doc.text(`-$${importe.toFixed(2)}`, tableLeft + 125, tableRowTop, {
            width: 60,
            align: "right",
          });
        });
      } else {
        doc.fontSize(8).text("(sin detalle de productos)", { align: "center" });
      }

      doc.moveDown(1);

      // --- TOTAL ---
      const yTotal = doc.y;
      doc.rect(5, yTotal, 216, 25).stroke();
      doc.font("Helvetica-Bold")
        .fontSize(13)
        .text(`TOTAL -$${total.toFixed(2)}`, 0, yTotal + 6, { align: "center", width: 226 });
      doc.moveDown(1.5);

      // --- DATOS FISCALES ---
      const yDatos = doc.y;
      doc.rect(5, yDatos, 216, 60).stroke();
      doc.font("Helvetica").fontSize(8);
      doc.text(`FORMA DE DEVOLUCIÓN: ${metodoPago}`, 0, yDatos + 5, { align: "center", width: 226 });
      doc.text("NOTA DE CRÉDITO ELECTRÓNICA", { align: "center", width: 226 });
      doc.text(`CAE: ${cae}`, { align: "center", width: 226 });
      doc.text(`FV: ${caeVto.toISOString().split("T")[0]}`, { align: "center", width: 226 });
      doc.text("CÓDIGO QR ARCA R.G. 4892/2020", { align: "center", width: 226 });
      doc.moveDown(1.5);

      // --- QR ---
      if (qrBase64) {
        const qrPath = path.join(basePath, `qr-nota-${numero}.png`);
        const base64Data = qrBase64.replace(/^data:image\/png;base64,/, "");
        fs.writeFileSync(qrPath, base64Data, "base64");
        const xQR = (226 - 110) / 2;
        const yQR = doc.y;
        doc.rect(5, yQR - 3, 216, 125).stroke();
        doc.image(qrPath, xQR, yQR + 5, { width: 110 });
        fs.unlinkSync(qrPath);
        doc.moveDown(13);
      }

      // --- PIE ---
      const yPie = doc.y;
      doc.rect(5, yPie, 216, 55).stroke();
      doc.fontSize(7)
        .text("PARA CONSULTAR ESTA NOTA DE CRÉDITO", 0, yPie + 5, {
          align: "center",
          width: 226,
        })
        .text("comprobante.afip.gob.ar", { align: "center", width: 226 })
        .moveDown(0.5)
        .text(
          "Documento emitido conforme a las disposiciones vigentes de la AFIP.",
          { align: "center", width: 216, indent: 5 }
        );

      doc.end();

      // --- FINALIZAR PDF ---
      stream.on("finish", async () => {
        try {
          console.log("🧾 Nota de crédito generada:", filePath);

          // 🖨️ Encolar impresión en el Printbox del negocio
          const ticketPayload = buildTicketPayloadNC({
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
          });

          await printboxService.enqueueJob(businessId, "CREDIT_NOTE", ticketPayload);

          // ☁️ Subir a Cloudinary
          const pdfUrl = await uploadPDFtoCloudinary(filePath);

          // 💾 Guardar en DB
          await prisma.sale.update({
            where: { id: saleId },
            data: { pdfUrl, isNoteCredit: true },
          });

          console.log("✅ Nota de crédito subida y asociada correctamente");
          resolve();
        } catch (err: any) {
          console.error("⚠️ Error al procesar nota de crédito:", err.message);
          reject(err);
        } finally {
          // 🧹 Eliminar archivo temporal siempre
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🧹 Archivo temporal eliminado:", filePath);
          }
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
