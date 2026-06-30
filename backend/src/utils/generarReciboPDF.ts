
import PDFDocument from "pdfkit";
import axios from "axios";
import fs from "fs";
import path from "path";

const POS_LOCAL_URL = process.env.POS_LOCAL_URL;
type Product = { name: string; quantity: number; price: number; };
export async function generarTicketPedidoPDF({
  saleId,
  products,
  total,
  metodoPago = "EFECTIVO",
  nombreCliente = "A CONSUMIDOR FINAL",
  razonSocial = process.env.BUSINESS_NAME ?? "ComarPOS",
  direccion = process.env.BUSINESS_ADDRESS ?? "",
  cuit = "20-00000000-0",
  mensaje = "RECIBO / NOTA DE PEDIDO",
}: {
  saleId: string;
  products: Product[];
  total: number;
  metodoPago?: string;
  nombreCliente?: string;
  razonSocial?: string;
  direccion?: string;
  cuit?: string;
  mensaje?: string;
}) {
  return new Promise<void>((resolve, reject) => {
    try {
      const basePath = path.resolve("./");
      const filePath = path.join(basePath, `ticket-${saleId}.pdf`);
      const logoPath = path.join(basePath, "assets/logo-comarpos.png");

      const doc = new PDFDocument({
        size: [226, 650], // altura más real para ticket 58mm
        margin: 6,        // márgenes más chicos como en la foto
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ----------------------------
      // TÍTULO
      // ----------------------------
      doc.font("Helvetica-Bold")
        .fontSize(11)
        .text(mensaje, { align: "center" });
      doc.moveDown(1.2);

      // ----------------------------
      // DATOS COMERCIO
      // ----------------------------
      doc.font("Helvetica-Bold").fontSize(9).text(razonSocial, { align: "center" });
      doc.font("Helvetica").fontSize(8)
        .text(direccion, { align: "center" })
        .text(`CUIT: ${cuit}`, { align: "center" });
      doc.moveDown(1.2);

      // ----------------------------
      // FECHA
      // ----------------------------
      const now = new Date();
      doc.font("Helvetica").fontSize(8)
        .text(
          `${now.toLocaleDateString("es-AR")} ${now.toLocaleTimeString("es-AR").slice(0, 5)}`,
          { align: "center" }
        );
      doc.moveDown(1.2);

      // ----------------------------
      // CLIENTE
      // ----------------------------
      doc.font("Helvetica-Bold").fontSize(9).text("CLIENTE", { align: "center" });
      doc.font("Helvetica").fontSize(8).text(nombreCliente, { align: "center" });
      doc.moveDown(1.5);

      // ----------------------------
      // DETALLE
      // ----------------------------
      doc.font("Helvetica-Bold").fontSize(10).text("DETALLE", { align: "center" });
      doc.moveDown(1.2);

      doc.font("Helvetica").fontSize(8);

      const colQty = 8;
      const colName = 28;
      const colPrice = 165;

      products.forEach((prod) => {
        const importe = prod.quantity * prod.price;

        doc.text(`${prod.quantity}x`, colQty, doc.y);
        doc.text(
          prod.name.length > 18 ? prod.name.slice(0, 18) + "…" : prod.name,
          colName,
          doc.y
        );
        doc.text(`$${importe.toFixed(2)}`, colPrice, doc.y, { width: 60, align: "right" });

        doc.moveDown(0.75);
      });

      doc.moveDown(1.2);

      // ----------------------------
      // TOTAL
      // ----------------------------
      const y = doc.y;
      doc.rect(4, y, 218, 28).stroke();

      doc.font("Helvetica-Bold")
        .fontSize(14)
        .text(`TOTAL $${total.toFixed(2)}`, 0, y + 6, {
          align: "center",
          width: 226,
        });

      doc.moveDown(3);

      // ----------------------------
      // MÉTODO DE PAGO
      // ----------------------------
      doc.font("Helvetica")
        .fontSize(9)
        .text(`Método de pago: ${metodoPago}`, { align: "center" });
      doc.moveDown(1);

      // ----------------------------
      // PIE
      // ----------------------------
      doc.font("Helvetica").fontSize(7)
        .text("Este ticket no es un comprobante fiscal.", { align: "center" })
        .text("Gracias por su compra.", { align: "center" });

      doc.end();

      stream.on("finish", async () => {
        try {
          if (POS_LOCAL_URL) {
            const pdfBuffer = await fs.promises.readFile(filePath);

            await axios.post(
              `${POS_LOCAL_URL}/print`,
              {
                pdfBase64: pdfBuffer.toString("base64"),
                ticket: { saleId, total, metodoPago },
              },
              { headers: { "Content-Type": "application/json" }, timeout: 30000 }
            );
          }

          resolve();
        } catch (err) {
          reject(err);
        } finally {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
