import PDFDocument from "pdfkit";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary"; // tu config
import { Sale, SaleItem, Product, User } from "@prisma/client";
import axios from "axios";
type SaleWithRelations = Sale & {
  items: (SaleItem & { product: Product })[];
  user?: User | null;
};

export async function generateInvoicePDF(sale: SaleWithRelations) {
  return new Promise<string>(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      try {
        const pdfBuffer = Buffer.concat(buffers);

        const result = await new Promise<any>((res, rej) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "raw", public_id: `invoices/invoice-${sale.id}` },
            (error, result) => {
              if (error) rej(error);
              else res(result);
            }
          );
          streamifier.createReadStream(pdfBuffer).pipe(uploadStream);
        });

        resolve(result.secure_url);
      } catch (err) {
        reject(err);
      }
    });

    // ---------------------
    // Contenido del PDF
    // ---------------------

    // 🔹 Traer logo desde Cloudinary como buffer
    const logoUrl =
      process.env.BUSINESS_LOGO_URL ??
      "https://res.cloudinary.com/deb7jg37j/image/upload/v1759503064/logo-von-konig-png-1_az9yxx.png";
    const response = await axios.get(logoUrl, { responseType: "arraybuffer" });
    const logoBuffer = Buffer.from(response.data, "binary");
// ---------------------
// Encabezado
// ---------------------

// Logo centrado arriba
doc.image(logoBuffer, (doc.page.width - 100) / 2, 40, { width: 100 });

// Espaciado debajo del logo
doc.moveDown(7);

// Nombre y datos de la tienda

doc.fontSize(10).fillColor("gray").text("Av. Julio A. Roca 288 • 401480", { align: "center" });
doc.text("Chocolatería Von König", { align: "center" });
doc.fillColor("black").text(`Atendió: ${sale.user?.name || "Empleado"}`, { align: "center" });

// Más espacio antes del número de compra
doc.moveDown(2);

// Número de compra centrado y destacado
doc.fontSize(12).fillColor("#2C2C2C").text(`N° de compra: ${sale.id}`, { align: "center" });

doc.moveDown(2);

// ---------------------
// Detalle de artículos
// ---------------------

const totalQty = sale.items.reduce((a, i) => a + i.quantity, 0);
doc.fontSize(12).text(`${sale.items.length} artículos (Cant.: ${totalQty})`, { align: "left" });
doc.moveDown(0.5);

doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
doc.moveDown(0.5);

sale.items.forEach((item) => {
  doc.text(`${item.quantity}x ${item.product.name}`, 60, doc.y, { continued: true });
  doc.text(`$${item.price.toFixed(2)}`, { align: "right" });
});

// ---------------------
// Totales
// ---------------------

doc.moveDown();
doc.fontSize(12).text(`Subtotal: $${sale.subtotal.toFixed(2)}`, { align: "right" });
doc.fontSize(14).fillColor("#000").text(`Total: $${sale.total.toFixed(2)}`, { align: "right" });
doc.fontSize(12).fillColor("black").text(`Cambio: $0.00`, { align: "right" });

// ---------------------
// Footer
// ---------------------

doc.moveDown(3);
doc.fontSize(11).fillColor("black").text("Gracias por su compra", { align: "center" });
doc.fontSize(9).fillColor("gray").text(new Date(sale.createdAt).toLocaleString("es-AR"), { align: "center" });

doc.end();
  });
}
