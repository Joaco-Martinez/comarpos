import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

type ComprobanteVentaSale = {
  id: string;
  subtotal: number;
  total: number;
  discountType?: string | null;
  discountValue?: number | null;
  paymentMethod?: string | null;
  receiptType?: string | null;
  status?: string | null;
  createdAt: Date;

  user?: {
    name?: string | null;
  } | null;

  client?: {
    nombre?: string | null;
    apellido?: string | null;
    dni?: string | null;
    telefono?: string | null;
    gmail?: string | null;
    address?: string | null;
    direccion?: string | null;
    category?: string | null;
  } | null;

  items: {
    quantity: number;
    quantityKg?: number | null;
    price: number;
    subtotal: number;
    productNameSnapshot?: string | null;
    productSkuSnapshot?: string | null;
    product?: {
      name?: string | null;
      sku?: string | null;
      imageUrl?: string | null;
      saleUnit?: string | null;
    } | null;
  }[];
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 46,
  top: 42,
  bottom: 790,
};

const C = {
  black: "#111827",
  text: "#172033",
  muted: "#667085",
  lightMuted: "#98A2B3",
  line: "#D0D5DD",
  lightLine: "#EAECF0",
  white: "#FFFFFF",
  soft: "#F8FAFC",
  headerSoft: "#F4F6F8",
  rowSoft: "#FAFBFC",
};

const imageCache = new Map<string, Buffer | null>();

function getPdfSafeImageUrl(src?: string | null) {
  if (!src) return null;

  const trimmed = src.trim();

  if (
    trimmed.includes("res.cloudinary.com") &&
    trimmed.includes("/image/upload/")
  ) {
    return trimmed.replace("/image/upload/", "/image/upload/f_png,q_auto/");
  }

  return trimmed;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  })
    .format(Number(value || 0))
    .replace(/\s/g, " ");
}

function dateText(date?: Date | string | null) {
  if (!date) return "-";

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(parsed)
    .replace(",", " -");
}

function safe(value?: string | null) {
  return value?.trim() || "-";
}

function getPaymentMethodLabel(method?: string | null) {
  if (!method) return "-";

  const labels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    QR: "QR",
    DEBITO: "Débito",
    CREDITO: "Crédito",
    QR_NACION: "QR Nación",
    QR_MERCADOPAGO: "QR Mercado Pago",
    TARJETA_DEBITO: "Tarjeta de débito",
    TARJETA_CREDITO: "Tarjeta de crédito",
  };

  return labels[method] || method;
}

function getCategoryLabel(client?: ComprobanteVentaSale["client"]) {
  const category = client?.category?.trim();

  if (!client || !category) return "Minorista";

  if (category === "Mayorista") return "Mayorista";
  if (category === "Cliente") return "Cliente";
  if (category === "Price") return "Minorista";

  const normalized = category.toLowerCase();

  if (normalized.includes("mayorista")) return "Mayorista";
  if (normalized.includes("cliente")) return "Cliente";

  if (
    normalized.includes("minorista") ||
    normalized.includes("consumidor") ||
    normalized.includes("final") ||
    normalized.includes("price")
  ) {
    return "Minorista";
  }

  return "Minorista";
}

function getClientName(client?: ComprobanteVentaSale["client"]) {
  if (!client) return "Consumidor final";

  const name = `${client.nombre ?? ""} ${client.apellido ?? ""}`.trim();

  return name || "Consumidor final";
}

function getClientDetails(client?: ComprobanteVentaSale["client"]) {
  if (!client) return "";

  const phone = client.telefono ? `Tel: ${client.telefono}` : "";
  const dni = client.dni ? `DNI/CUIT: ${client.dni}` : "";

  return [phone, dni].filter(Boolean).join(" - ");
}

function getProductName(item: ComprobanteVentaSale["items"][number]) {
  return item.productNameSnapshot || item.product?.name || "Producto";
}

function getProductSku(item: ComprobanteVentaSale["items"][number]) {
  return item.productSkuSnapshot || item.product?.sku || "-";
}

function getProductQty(item: ComprobanteVentaSale["items"][number]) {
  if (item.product?.saleUnit === "KG") {
    return Number(item.quantityKg ?? 0);
  }

  return Number(item.quantity ?? 0);
}

function findLogoPath() {
  const candidates = [
    path.join(process.cwd(), "src", "utils", "logo-vj.png"),
    path.join(process.cwd(), "src", "utils", "logo-vj.jpg"),
    path.join(process.cwd(), "src", "utils", "logo-vj.jpeg"),
    path.join(process.cwd(), "src", "utils", "logo-vj.webp"),
  ];

  return candidates.find((file) => fs.existsSync(file)) || null;
}

async function getImageBuffer(src?: string | null) {
  const safeSrc = getPdfSafeImageUrl(src);

  if (!safeSrc) return null;

  if (imageCache.has(safeSrc)) {
    return imageCache.get(safeSrc) ?? null;
  }

  try {
    if (safeSrc.startsWith("data:image/")) {
      const base64 = safeSrc.split(",")[1];
      const buffer = Buffer.from(base64, "base64");
      imageCache.set(safeSrc, buffer);
      return buffer;
    }

    if (safeSrc.startsWith("http://") || safeSrc.startsWith("https://")) {
      const response = await fetch(safeSrc);

      if (!response.ok) {
        imageCache.set(safeSrc, null);
        return null;
      }

      const arr = await response.arrayBuffer();
      const buffer = Buffer.from(arr);
      imageCache.set(safeSrc, buffer);
      return buffer;
    }

    const absolute = path.isAbsolute(safeSrc)
      ? safeSrc
      : path.join(process.cwd(), safeSrc);

    if (!fs.existsSync(absolute)) {
      imageCache.set(safeSrc, null);
      return null;
    }

    const buffer = fs.readFileSync(absolute);
    imageCache.set(safeSrc, buffer);
    return buffer;
  } catch {
    imageCache.set(safeSrc, null);
    return null;
  }
}

function drawPageBackground(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(C.white);
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number) {
  const logoPath = findLogoPath();

  doc.save();
  doc.circle(x + 31, y + 31, 31).fill("#000000");
  doc.restore();

  if (logoPath) {
    try {
      doc.image(logoPath, x, y, {
        cover: [62, 62],
        align: "center",
        valign: "center",
      });
      return;
    } catch {}
  }

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("VJ", x, y + 21, {
      width: 62,
      align: "center",
    });
}

function drawNotFiscalBadge(doc: PDFKit.PDFDocument) {
  const boxW = 250;
  const boxH = 20;
  const boxX = (PAGE.width - boxW) / 2;
  const boxY = 6;

  doc.roundedRect(boxX, boxY, boxW, boxH, 10).fill(C.black);

  doc
    .fillColor(C.white)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("DOCUMENTO NO VÁLIDO COMO FACTURA", boxX, boxY + 6, {
      width: boxW,
      align: "center",
    });
}

function drawHeader(doc: PDFKit.PDFDocument, sale: ComprobanteVentaSale) {
  drawPageBackground(doc);
  drawNotFiscalBadge(doc);

  const x = PAGE.marginX;
  const y = PAGE.top + 20;

  drawLogo(doc, x, y);

  doc
    .fillColor(C.black)
    .font("Helvetica-Bold")
    .fontSize(21)
    .text(`${getCategoryLabel(sale.client)}`, x + 78, y + 13);

  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text("Comprobante de venta", x + 79, y + 41);

  doc
    .fillColor(C.black)
    .font("Helvetica")
    .fontSize(10)
    .text(dateText(sale.createdAt), 415, y + 12, {
      width: 92,
      align: "right",
      lineGap: 1,
    });

  const contactY = y + 82;

  doc
    .fillColor(C.text)
    .font("Helvetica")
    .fontSize(10.5)
    .text("Paso de los Andes 893", x, contactY)
    .text("03513790057", x + 172, contactY)
    .text("contacto@comarpos.com.ar", x + 300, contactY);

  doc
    .moveTo(x, contactY + 23)
    .lineTo(PAGE.width - x, contactY + 23)
    .strokeColor(C.line)
    .lineWidth(1)
    .stroke();
}

function drawInfo(doc: PDFKit.PDFDocument, sale: ComprobanteVentaSale) {
  const x = PAGE.marginX;
  const y = 182;
  const rightX = 292;
  const rightW = 216;

  const clientDetails = getClientDetails(sale.client);

  const rows = [
    {
      label: "Nombre del cliente",
      value: getClientName(sale.client),
      detail: clientDetails,
    },
    {
      label: "N° de comprobante",
      value: sale.id.slice(0, 8).toUpperCase(),
      detail: "",
    },
    {
      label: "Forma de pago",
      value: getPaymentMethodLabel(sale.paymentMethod),
      detail: "",
    },
    {
      label: "Vendedor",
      value: safe(sale.user?.name),
      detail: "",
    },
  ];

  let currentY = y;

  rows.forEach((row) => {
    doc.font("Helvetica-Bold").fontSize(11);

    const valueHeight = doc.heightOfString(row.value, {
      width: rightW,
      align: "right",
      lineGap: 1,
    });

    let detailHeight = 0;

    if (row.detail) {
      doc.font("Helvetica").fontSize(9.2);

      detailHeight = doc.heightOfString(row.detail, {
        width: rightW,
        align: "right",
        lineGap: 1,
      });
    }

    const rowHeight = Math.max(
      34,
      valueHeight + (row.detail ? detailHeight + 5 : 0) + 12
    );

    doc
      .fillColor(C.text)
      .font("Helvetica")
      .fontSize(11)
      .text(row.label, x, currentY);

    doc
      .fillColor(C.black)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(row.value, rightX, currentY, {
        width: rightW,
        align: "right",
        lineGap: 1,
      });

    if (row.detail) {
      doc
        .fillColor(C.muted)
        .font("Helvetica")
        .fontSize(9.2)
        .text(row.detail, rightX, currentY + valueHeight + 3, {
          width: rightW,
          align: "right",
          lineGap: 1,
        });
    }

    currentY += rowHeight;
  });

  const lineY = currentY + 3;

  doc
    .moveTo(x, lineY)
    .lineTo(PAGE.width - x, lineY)
    .strokeColor(C.line)
    .lineWidth(1)
    .stroke();

  return lineY + 22;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  const x = PAGE.marginX;

  doc
    .roundedRect(x, y - 8, PAGE.width - x * 2, 34, 8)
    .fill(C.headerSoft);

  doc
    .fillColor(C.black)
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text("Producto", x + 12, y + 3)
    .text("Código", 272, y + 3)
    .text("Cant.", 364, y + 3, { width: 45, align: "right" })
    .text("Precio unit.", 425, y + 3, { width: 70, align: "right" })
    .text("Subtotal", 502, y + 3, { width: 48, align: "right" });

  return y + 45;
}

function drawNoImage(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc
    .roundedRect(x, y, 52, 52, 7)
    .fillAndStroke(C.soft, C.lightLine);

  doc
    .fillColor(C.lightMuted)
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("SIN", x, y + 16, { width: 52, align: "center" })
    .text("FOTO", x, y + 27, { width: 52, align: "center" });
}

async function drawProductRow(
  doc: PDFKit.PDFDocument,
  sale: ComprobanteVentaSale,
  item: ComprobanteVentaSale["items"][number],
  y: number,
  index: number
) {
  const x = PAGE.marginX;
  const rowHeight = 76;

  if (y + rowHeight > 704) {
    y = addPage(doc, sale);
  }

  const isEven = index % 2 === 0;

  doc
    .roundedRect(x, y - 8, PAGE.width - x * 2, rowHeight - 4, 10)
    .fill(isEven ? C.white : C.rowSoft);

  doc
    .moveTo(x + 12, y + rowHeight - 12)
    .lineTo(PAGE.width - x - 12, y + rowHeight - 12)
    .strokeColor("#EEF1F4")
    .lineWidth(0.8)
    .stroke();

  const imgX = x + 12;
  const imgY = y;
  const imageBuffer = await getImageBuffer(item.product?.imageUrl);

  if (imageBuffer) {
    try {
      doc.roundedRect(imgX, imgY, 58, 58, 8).fill(C.white);

      doc.image(imageBuffer, imgX + 3, imgY + 3, {
        fit: [52, 52],
        align: "center",
        valign: "center",
      });
    } catch {
      drawNoImage(doc, imgX, imgY);
    }
  } else {
    drawNoImage(doc, imgX, imgY);
  }

  doc
    .fillColor(C.black)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(getProductName(item), x + 84, y + 13, {
      width: 160,
      height: 30,
      ellipsis: true,
    });

  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(8.5)
    .text("Producto vendido", x + 84, y + 34, {
      width: 160,
      ellipsis: true,
    });

  doc
    .fillColor(C.text)
    .font("Helvetica")
    .fontSize(10)
    .text(getProductSku(item), 272, y + 21, {
      width: 74,
      align: "left",
      ellipsis: true,
    });

  doc
    .fillColor(C.black)
    .font("Helvetica")
    .fontSize(10.5)
    .text(String(getProductQty(item)), 364, y + 21, {
      width: 45,
      align: "right",
    });

  doc.text(money(item.price), 425, y + 21, {
    width: 70,
    align: "right",
  });

  doc
    .font("Helvetica-Bold")
    .text(money(item.subtotal), 502, y + 21, {
      width: 48,
      align: "right",
    });

  return y + rowHeight;
}

function addPage(doc: PDFKit.PDFDocument, sale: ComprobanteVentaSale) {
  doc.addPage({ size: "A4", margin: 0 });
  drawPageBackground(doc);
  drawNotFiscalBadge(doc);

  doc
    .fillColor(C.black)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(`${getCategoryLabel(sale.client)}`, PAGE.marginX, 42);

  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(`Continuación - ${dateText(sale.createdAt)}`, PAGE.marginX, 61);

  doc
    .moveTo(PAGE.marginX, 84)
    .lineTo(PAGE.width - PAGE.marginX, 84)
    .strokeColor(C.line)
    .lineWidth(1)
    .stroke();

  return drawTableHeader(doc, 105);
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  sale: ComprobanteVentaSale,
  y: number
) {
  const x = PAGE.marginX;

  if (y + 120 > PAGE.bottom) {
    doc.addPage({ size: "A4", margin: 0 });
    drawPageBackground(doc);
    drawNotFiscalBadge(doc);

    doc
      .fillColor(C.black)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(`${getCategoryLabel(sale.client)}`, PAGE.marginX, 42);

    doc
      .fillColor(C.muted)
      .font("Helvetica")
      .fontSize(9)
      .text("Totales del comprobante", PAGE.marginX, 61);

    doc
      .moveTo(PAGE.marginX, 84)
      .lineTo(PAGE.width - PAGE.marginX, 84)
      .strokeColor(C.line)
      .lineWidth(1)
      .stroke();

    y = 116;
  }

  doc
    .moveTo(x, y)
    .lineTo(PAGE.width - x, y)
    .strokeColor(C.line)
    .lineWidth(1)
    .stroke();

  const boxW = 240;
  const boxX = PAGE.width - x - boxW;
  const boxY = y + 24;

  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(10.5)
    .text("Subtotal", boxX, boxY, {
      width: 100,
      align: "left",
    });

  doc
    .fillColor(C.black)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(money(sale.subtotal), boxX + 120, boxY, {
      width: 120,
      align: "right",
    });

  const hasDiscount =
    sale.discountValue !== null &&
    sale.discountValue !== undefined &&
    Number(sale.discountValue) > 0;

  let totalBoxY = boxY + 26;

  if (hasDiscount) {
    const discountAmount = Number(sale.subtotal || 0) - Number(sale.total || 0);

    doc
      .fillColor(C.muted)
      .font("Helvetica")
      .fontSize(10.5)
      .text("Descuento", boxX, boxY + 22, {
        width: 100,
        align: "left",
      });

    doc
      .fillColor(C.black)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(`- ${money(discountAmount)}`, boxX + 120, boxY + 22, {
        width: 120,
        align: "right",
      });

    totalBoxY = boxY + 48;
  }

  doc
    .roundedRect(boxX - 4, totalBoxY, boxW + 4, 42, 10)
    .fill(C.black);

  doc
    .fillColor(C.white)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Total", boxX + 14, totalBoxY + 13);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(money(sale.total), boxX + 92, totalBoxY + 13, {
      width: 134,
      align: "right",
    });
}

function drawFooter(doc: PDFKit.PDFDocument, page: number, totalPages: number) {
  doc
    .fillColor(C.lightMuted)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      "Este comprobante no reemplaza la factura fiscal correspondiente.",
      PAGE.marginX,
      805,
      {
        width: PAGE.width - PAGE.marginX * 2,
        align: "center",
      }
    );

  doc
    .fillColor(C.lightMuted)
    .font("Helvetica")
    .fontSize(7.5)
    .text(`Página ${page} de ${totalPages}`, PAGE.marginX, 820, {
      width: PAGE.width - PAGE.marginX * 2,
      align: "center",
    });
}

export async function generarComprobanteVentaPDF(
  sale: ComprobanteVentaSale
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];

      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
        bufferPages: true,
        info: {
          Title: `Comprobante de venta ${sale.id}`,
          Author: process.env.BUSINESS_NAME ?? "ComarPOS",
          Subject: "Comprobante de venta sin facturar",
        },
      });

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      drawHeader(doc, sale);
      const tableStartY = drawInfo(doc, sale);

      let y = drawTableHeader(doc, tableStartY);

      for (let i = 0; i < sale.items.length; i++) {
        y = await drawProductRow(doc, sale, sale.items[i], y, i);
      }

      drawTotals(doc, sale, y + 6);

      const pages = doc.bufferedPageRange();

      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        drawFooter(doc, i + 1, pages.count);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
