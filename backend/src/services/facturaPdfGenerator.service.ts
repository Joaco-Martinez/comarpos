import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import cloudinary from "cloudinary";
import QRCode from "qrcode";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type Product = {
  name: string;
  quantity: number;
  quantityKg?: number | null;
  price: number;
  subtotal?: number;
};

export type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";

export type FacturaPDFData = {
  factura: {
    cuit: string;
    puntoVenta: number;
    tipoComprobante: number;
    tipoDoc: number;
    nroDoc: number;
    numero: number;
    fechaEmision: Date;
    resultado: string;
    cae: string;
    caeVto: Date;
    total: number;
    neto: number;
    iva: number;
    condicionIVAReceptor: number;
    moneda: string;
    urlQR?: string;
    saleId: string;
  };

  empresa?: {
    name?: string;
    subtitle?: string;
    cuit?: string;
    address?: string;
    phone?: string;
    ivaCondition?: string;
  };

  cliente: {
    nombre: string;
    apellido?: string;
    dni: string;
    telefono?: string;
    gmail?: string;
    category?: TipoCliente;
  };

  products: Product[];
  logoPath?: string;
};

const COLORS = {
  black: "#111111",
  red: "#b91c1c",
  redDark: "#7f1d1d",
  gray900: "#222222",
  gray700: "#4b5563",
  gray500: "#6b7280",
  gray300: "#d1d5db",
  gray200: "#e5e7eb",
  gray100: "#f3f4f6",
  white: "#ffffff",
};

function getEmpresa(data: FacturaPDFData) {
  return {
    name: data.empresa?.name || process.env.BUSINESS_NAME || "ComarPOS",
    subtitle:
      data.empresa?.subtitle ||
      process.env.BUSINESS_SUBTITLE ||
      "SANTILLAN JULIO CESAR",
    cuit: data.empresa?.cuit || process.env.BUSINESS_CUIT || data.factura.cuit,
    address:
      data.empresa?.address ||
      process.env.BUSINESS_ADDRESS ||
      "PASO DE LOS ANDES 893, BARRIO OBSERVATORIO, 5000-CORDOBA",
    phone:
      data.empresa?.phone ||
      process.env.BUSINESS_PHONE ||
      "+54 9 3513 79-0057",
    ivaCondition:
      data.empresa?.ivaCondition ||
      process.env.BUSINESS_IVA_CONDITION ||
      undefined,
  };
}

function getLetraComprobante(tipoComprobante: number): string {
  switch (tipoComprobante) {
    case 1:
    case 3:
      return "A";
    case 6:
    case 8:
      return "B";
    case 11:
    case 13:
      return "C";
    default:
      return "?";
  }
}

function getTipoComprobanteLabel(tipoComprobante: number): string {
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

function getCondicionIVAEmisor(tipoComprobante: number, custom?: string): string {
  if (custom) return custom;

  if ([1, 3, 6, 8].includes(tipoComprobante)) {
    return "IVA RESPONSABLE INSCRIPTO";
  }

  return "IVA RESPONSABLE MONOTRIBUTO";
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

function getCondicionIVAReceptorLabel(condicionIVAReceptor?: number | null) {
  switch (Number(condicionIVAReceptor)) {
    case 1:
      return "IVA RESPONSABLE INSCRIPTO";
    case 4:
      return "IVA SUJETO EXENTO";
    case 5:
      return "CONSUMIDOR FINAL";
    case 6:
      return "RESPONSABLE MONOTRIBUTO";
    case 7:
      return "SUJETO NO CATEGORIZADO";
    case 8:
      return "PROVEEDOR DEL EXTERIOR";
    case 9:
      return "CLIENTE DEL EXTERIOR";
    case 10:
      return "IVA LIBERADO - LEY 19.640";
    case 13:
      return "MONOTRIBUTISTA SOCIAL";
    case 15:
      return "IVA NO ALCANZADO";
    case 16:
      return "MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO";
    default:
      return "CONSUMIDOR FINAL";
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
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

function buildNumeroComprobante(pv: number, nro: number) {
  return `${String(pv).padStart(4, "0")}-${String(nro).padStart(8, "0")}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function uploadPDFtoCloudinary(
  filePath: string,
  numero: number
): Promise<string> {
  const res = await cloudinary.v2.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "facturas-afip",
    public_id: `factura-${numero}`,
    overwrite: true,
  });

  return res.secure_url;
}

async function generarQRPNGDesdeURL(url: string, outputPath: string) {
  await QRCode.toFile(outputPath, url, {
    type: "png",
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor?: string,
  strokeColor = COLORS.gray300
) {
  if (fillColor) {
    doc.save();
    doc.fillColor(fillColor).rect(x, y, w, h).fill();
    doc.restore();
  }

  doc.save();
  doc.lineWidth(0.7).strokeColor(strokeColor).rect(x, y, w, h).stroke();
  doc.restore();
}

function getDefaultLogoPath(basePath: string, custom?: string) {
  if (custom && fs.existsSync(custom)) return custom;

  const logoVj = path.join(basePath, "assets/logo-vj.png");
  if (fs.existsSync(logoVj)) return logoVj;

  const logoVjJpg = path.join(basePath, "assets/logo-vj.jpg");
  if (fs.existsSync(logoVjJpg)) return logoVjJpg;

  const oldLogo = path.join(basePath, "assets/logo-comarpos.png");
  if (fs.existsSync(oldLogo)) return oldLogo;

  return undefined;
}

function renderPageHeader(
  doc: PDFKit.PDFDocument,
  data: FacturaPDFData,
  logoPath?: string
) {
  const factura = data.factura;
  const empresa = getEmpresa(data);

  const pageWidth = doc.page.width;
  const left = 40;
  const right = pageWidth - 40;
  const width = right - left;
  const top = 30;

  const headerH = 132;
  const emisorW = width * 0.6;
  const letterW = 72;
  const metaW = width - emisorW - letterW;

  drawBox(doc, left, top, emisorW, headerH, COLORS.white);
  drawBox(doc, left + emisorW, top, letterW, headerH, COLORS.white);
  drawBox(doc, left + emisorW + letterW, top, metaW, headerH, COLORS.white);

  doc.save();
  doc.fillColor(COLORS.red).rect(left, top, width, 5).fill();
  doc.restore();

  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, left + 14, top + 14, {
        fit: [82, 42],
      });
    } catch {}
  }

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.black)
    .fontSize(18)
    .text(empresa.name, left + 14, top + 60, {
      width: emisorW - 28,
      align: "left",
      lineBreak: false,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.redDark)
    .text(empresa.subtitle, left + 14, top + 82, {
      width: emisorW - 28,
      align: "left",
      lineBreak: false,
    });

  doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.gray700);

  doc.text(empresa.address, left + 14, top + 99, {
    width: emisorW - 28,
    lineBreak: false,
  });

  doc.text(`CUIT: ${empresa.cuit}`, left + 14, top + 112, {
    width: emisorW - 28,
    lineBreak: false,
  });

  doc.text(
    getCondicionIVAEmisor(factura.tipoComprobante, empresa.ivaCondition),
    left + 14,
    top + 124,
    {
      width: emisorW - 28,
      lineBreak: false,
    }
  );

  const letra = getLetraComprobante(factura.tipoComprobante);

  doc
    .font("Helvetica-Bold")
    .fontSize(38)
    .fillColor(COLORS.black)
    .text(letra, left + emisorW, top + 18, {
      width: letterW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.gray900)
    .text(
      `COD. ${String(factura.tipoComprobante).padStart(3, "0")}`,
      left + emisorW,
      top + 82,
      {
        width: letterW,
        align: "center",
      }
    );

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.gray500)
    .text("ORIGINAL", left + emisorW, top + 104, {
      width: letterW,
      align: "center",
    });

  const metaX = left + emisorW + letterW + 12;
  const metaWInner = metaW - 24;

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.black)
    .text(getTipoComprobanteLabel(factura.tipoComprobante), metaX, top + 16, {
      width: metaWInner,
      align: "left",
      lineBreak: false,
    });

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray700);

  doc.text(
    `Punto de Venta: ${String(factura.puntoVenta).padStart(4, "0")}`,
    metaX,
    top + 44,
    {
      width: metaWInner,
      lineBreak: false,
    }
  );

  doc.text(
    `Comp. Nro: ${String(factura.numero).padStart(8, "0")}`,
    metaX,
    top + 62,
    {
      width: metaWInner,
      lineBreak: false,
    }
  );

  doc.text(`Fecha: ${formatDateAR(factura.fechaEmision)}`, metaX, top + 80, {
    width: metaWInner,
    lineBreak: false,
  });

  doc.text(`Hora: ${formatTimeAR(factura.fechaEmision)}`, metaX, top + 98, {
    width: metaWInner,
    lineBreak: false,
  });

  doc.text(`Tel: ${empresa.phone}`, metaX, top + 116, {
    width: metaWInner,
    lineBreak: false,
  });

  doc.y = top + headerH + 14;
}

function renderClienteSection(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"],
  cliente: FacturaPDFData["cliente"]
) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 82;

  drawBox(doc, left, top, width, sectionH, COLORS.white);

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.redDark)
    .fontSize(10.5)
    .text("DATOS DEL RECEPTOR", left + 12, top + 9, {
      width: width - 24,
    });

  const fullName = `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim();

  const col1X = left + 12;
  const col2X = left + width / 2 + 6;
  const line1Y = top + 30;
  const line2Y = top + 48;
  const line3Y = top + 65;

  doc.font("Helvetica").fontSize(9).fillColor(COLORS.gray900);

  doc.text(`Razón social: ${fullName || "Consumidor Final"}`, col1X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`CUIT / Doc: ${cliente.dni || "-"}`, col2X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`Tipo cliente: ${getClienteLabel(cliente.category)}`, col1X, line2Y, {
    width: width / 2 - 18,
  });

  doc.text(
    `Condición IVA: ${getCondicionIVAReceptorLabel(
      factura.condicionIVAReceptor
    )}`,
    col2X,
    line2Y,
    {
      width: width / 2 - 18,
    }
  );

  doc.text(`Teléfono: ${cliente.telefono || "-"}`, col1X, line3Y, {
    width: width / 2 - 18,
  });

  doc.text(`Email: ${cliente.gmail || "-"}`, col2X, line3Y, {
    width: width / 2 - 18,
  });

  doc.y = top + sectionH + 12;
}

function renderTableHeader(doc: PDFKit.PDFDocument) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const rowH = 24;

  drawBox(doc, left, top, width, rowH, COLORS.gray100);

  const cols = {
    qty: 54,
    desc: width - 54 - 92 - 102,
    unit: 92,
    total: 102,
  };

  let x = left;

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(COLORS.black)
    .text("Cant.", x + 7, top + 7, {
      width: cols.qty - 14,
      align: "left",
    });

  x += cols.qty;

  doc.text("Descripción", x + 7, top + 7, {
    width: cols.desc - 14,
    align: "left",
  });

  x += cols.desc;

  doc.text("P. Unitario", x + 7, top + 7, {
    width: cols.unit - 14,
    align: "right",
  });

  x += cols.unit;

  doc.text("Importe", x + 7, top + 7, {
    width: cols.total - 14,
    align: "right",
  });

  doc.y = top + rowH;
}

function ensureTableSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const reservedBottomSpace = 218;
  const bottomLimit = doc.page.height - reservedBottomSpace;

  if (doc.y + neededHeight > bottomLimit) {
    throw new Error(
      "La factura excede el espacio disponible de una sola hoja A4. Ajustá el layout o reducí el contenido."
    );
  }
}

function renderProductsTable(doc: PDFKit.PDFDocument, products: Product[]) {
  renderTableHeader(doc);

  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;

  const cols = {
    qty: 54,
    desc: width - 54 - 92 - 102,
    unit: 92,
    total: 102,
  };

  if (!products.length) {
    const rowH = 24;
    drawBox(doc, left, doc.y, width, rowH);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.gray700)
      .text("Sin productos", left + 8, doc.y + 7, {
        width: width - 16,
      });

    doc.y += rowH;
    return;
  }

  for (const prod of products) {
    const quantity = numberOrZero(prod.quantity);

    const quantityKg =
      prod.quantityKg !== null && prod.quantityKg !== undefined
        ? numberOrZero(prod.quantityKg)
        : undefined;

    const displayQuantity =
      quantityKg !== undefined && quantityKg > 0
        ? `${quantityKg} kg`
        : String(quantity);

    const price = numberOrZero(prod.price);

    const importe =
      prod.subtotal !== undefined && prod.subtotal !== null
        ? numberOrZero(prod.subtotal)
        : quantityKg !== undefined && quantityKg > 0
        ? quantityKg * price
        : quantity * price;

    const descHeight = doc.heightOfString(prod.name, {
      width: cols.desc - 14,
      align: "left",
    });

    const rowH = Math.max(22, descHeight + 10);

    ensureTableSpace(doc, rowH);

    const y = doc.y;

    drawBox(doc, left, y, width, rowH);

    let x = left;

    doc.font("Helvetica").fontSize(8.8).fillColor(COLORS.gray900);

    doc.text(displayQuantity, x + 7, y + 7, {
      width: cols.qty - 14,
      align: "left",
    });

    x += cols.qty;

    doc.text(prod.name, x + 7, y + 7, {
      width: cols.desc - 14,
      align: "left",
    });

    x += cols.desc;

    doc.text(formatCurrency(price), x + 7, y + 7, {
      width: cols.unit - 14,
      align: "right",
    });

    x += cols.unit;

    doc.text(formatCurrency(importe), x + 7, y + 7, {
      width: cols.total - 14,
      align: "right",
    });

    doc.y = y + rowH;
  }

  doc.moveDown(0.45);
}

function renderTotals(doc: PDFKit.PDFDocument, factura: FacturaPDFData["factura"]) {
  const boxW = 230;
  const boxH = 68;
  const x = doc.page.width - 40 - boxW;
  const y = doc.y;

  drawBox(doc, x, y, boxW, boxH, COLORS.white);

  const labelX = x + 14;
  const valueX = x + 115;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.gray900)
    .text("Subtotal:", labelX, y + 10, { width: 90 })
    .text(formatCurrency(factura.neto), valueX, y + 10, {
      width: 98,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.gray900)
    .text("IVA:", labelX, y + 28, { width: 90 })
    .text(formatCurrency(factura.iva), valueX, y + 28, {
      width: 98,
      align: "right",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(COLORS.redDark)
    .text("TOTAL:", labelX, y + 47, { width: 90 })
    .text(formatCurrency(factura.total), valueX, y + 47, {
      width: 98,
      align: "right",
    });

  doc.y = y + boxH + 10;
}

function renderFiscalSection(
  doc: PDFKit.PDFDocument,
  factura: FacturaPDFData["factura"],
  qrPath?: string
) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 126;

  drawBox(doc, left, top, width, sectionH, COLORS.white);

  doc.save();
  doc.fillColor(COLORS.red).rect(left, top, width, 4).fill();
  doc.restore();

  const qrW = 86;
  const qrX = right - qrW - 14;
  const qrY = top + 18;

  const infoX = left + 14;
  const infoW = width - qrW - 42;

  doc
    .font("Helvetica-Bold")
    .fontSize(10.2)
    .fillColor(COLORS.redDark)
    .text("DATOS FISCALES", infoX, top + 13, { width: infoW });

  let textY = top + 35;

  doc
    .font("Helvetica")
    .fontSize(8.8)
    .fillColor(COLORS.gray900)
    .text("Comprobante autorizado electrónicamente.", infoX, textY, {
      width: infoW,
    });

  textY += 17;

  doc.text(`CAE: ${factura.cae || "-"}`, infoX, textY, { width: infoW });

  textY += 17;

  doc.text(`Vencimiento CAE: ${formatDateAR(factura.caeVto)}`, infoX, textY, {
    width: infoW,
  });

  textY += 17;

  doc.text(
    `Comprobante: ${buildNumeroComprobante(
      factura.puntoVenta,
      factura.numero
    )}`,
    infoX,
    textY,
    { width: infoW }
  );

  textY += 18;

  doc
    .fontSize(7.6)
    .fillColor(COLORS.gray700)
    .text("Verificación: comprobante.afip.gob.ar", infoX, textY, {
      width: infoW,
    });

  if (qrPath && fs.existsSync(qrPath)) {
    try {
      doc.image(qrPath, qrX, qrY, { fit: [qrW, qrW] });
    } catch {
      drawBox(doc, qrX, qrY, qrW, qrW, COLORS.gray100);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.gray700)
        .text("QR no disponible", qrX, qrY + 36, {
          width: qrW,
          align: "center",
        });
    }
  } else {
    drawBox(doc, qrX, qrY, qrW, qrW, COLORS.gray100);

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLORS.gray700)
      .text("QR no disponible", qrX, qrY + 36, {
        width: qrW,
        align: "center",
      });
  }

  doc.y = top + sectionH + 6;
}

function renderFooter(doc: PDFKit.PDFDocument, data: FacturaPDFData) {
  const empresa = getEmpresa(data);
  const left = 40;
  const y = doc.page.height - 46;
  const width = doc.page.width - 80;

  doc
    .font("Helvetica")
    .fontSize(7.4)
    .fillColor(COLORS.gray500)
    .text(
      `${empresa.name} - ${empresa.subtitle} - CUIT ${empresa.cuit}`,
      left,
      y,
      { width, align: "center" }
    )
    .text(
      "Este documento representa un comprobante electrónico autorizado por ARCA/AFIP.",
      left,
      y + 10,
      { width, align: "center" }
    )
    .text("Verificación: comprobante.afip.gob.ar", left, y + 20, {
      width,
      align: "center",
    });
}

export async function generarFacturaPDF(
  data: FacturaPDFData,
  uploadToCloudinary = false
) {
  const basePath = path.resolve("./");
  const outputDir = path.join(basePath, "tmp");

  ensureDir(outputDir);

  const filePath = path.join(
    outputDir,
    `factura-${data.factura.puntoVenta}-${data.factura.numero}.pdf`
  );

  const qrPath = path.join(
    outputDir,
    `qr-${data.factura.puntoVenta}-${data.factura.numero}.png`
  );

  const logoPath = getDefaultLogoPath(basePath, data.logoPath);

  try {
    let qrDisponible = false;

    if (data.factura.urlQR) {
      try {
        await generarQRPNGDesdeURL(data.factura.urlQR, qrPath);
        qrDisponible = true;
      } catch (err: any) {
        console.warn("⚠️ No se pudo generar QR para factura PDF:", err?.message);
        qrDisponible = false;
      }
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 0,
          bufferPages: true,
        });

        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        renderPageHeader(doc, data, logoPath);
        renderClienteSection(doc, data.factura, data.cliente);
        renderProductsTable(doc, data.products);
        renderTotals(doc, data.factura);
        renderFiscalSection(
          doc,
          data.factura,
          qrDisponible && fs.existsSync(qrPath) ? qrPath : undefined
        );
        renderFooter(doc, data);

        doc.end();

        stream.on("finish", () => resolve());
        stream.on("error", reject);
      } catch (error) {
        reject(error);
      }
    });

    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }

    if (!uploadToCloudinary) {
      return { filePath };
    }

    const cloudinaryUrl = await uploadPDFtoCloudinary(
      filePath,
      data.factura.numero
    );

    return {
      filePath,
      cloudinaryUrl,
    };
  } catch (error) {
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }

    throw error;
  }
}