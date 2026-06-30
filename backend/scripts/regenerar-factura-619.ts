import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import cloudinary from "cloudinary";
import QRCode from "qrcode";

// =========================
// CONFIG CLOUDINARY
// =========================
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type Product = {
  name: string;
  quantity: number;
  price: number;
};

type TipoCliente = "Consumidor Final" | "Cliente" | "Mayorista";

// =========================
// DATA FACTURA REAL
// =========================
const factura = {
  cuit: "20176301458",
  puntoVenta: 7,
  tipoComprobante: 11, // 11 = Factura C
  tipoDoc: 80,
  nroDoc: 30527151453,
  numero: 619,
  fechaEmision: new Date("2026-03-30T13:24:05"),
  resultado: "A",
  cae: "86139525320569",
  caeVto: new Date("2026-04-09T00:00:00"),
  total: 1040500,
  neto: 1040500,
  iva: 0,
  condicionIVAReceptor: 5,
  moneda: "PES",
  urlQR:
    "https://www.afip.gob.ar/fe/qr/?p=eyJ2ZXIiOjEsImZlY2hhIjoiMjAyNi0wMy0zMCIsImN1aXQiOjIwMTc2MzAxNDU4LCJwdG9WdGEiOjcsInRpcG9DbXAiOjExLCJucm9DbXAiOjYxOSwiaW1wb3J0ZSI6MTA0MDUwMCwibW9uZWRhIjoiUEVTIiwiY3R6IjoxLCJ0aXBvRG9jUmVjIjo4MCwibnJvRG9jUmVjIjozMDUyNzE1MTQ1MywidGlwb0NvZEF1dCI6IkUiLCJjb2RBdXQiOjg2MTM5NTI1MzIwNTY5fQ==",
  saleId: "24954486-6631-4a72-b0e2-213c4bafe6cd",
};

const cliente = {
  nombre: "COTAGRO COOPERATIVA AGROPECUARIA LIMITADA",
  apellido: "",
  dni: "30-52715145-3",
  telefono: "",
  gmail: "alencina@cotagro.com.ar",
  category: "Mayorista" as TipoCliente,
};

const products: Product[] = [
  { name: "Caja x6 Alfajores", price: 14000, quantity: 22 },
  { name: "Caja x12 Alfajores", price: 27000, quantity: 11 },
  { name: "Caja x12 Bombones", price: 43000, quantity: 1 },
  { name: "Caja X7 Bombones", price: 22000, quantity: 4 },
  { name: "CAJA X12 BOMBONES NACIONALES", price: 15000, quantity: 6 },
  { name: "CAJA X7 BOMBONES NACIONALES", price: 8000, quantity: 15 },
  { name: "Tableta Xl Rellenas", price: 9000, quantity: 6 },
  { name: "TABLETA DE AVELLANAS", price: 7500, quantity: 3 },
  { name: "Tableta Grande Chocolate", price: 6000, quantity: 3 },
  { name: "Ron Alfajor", price: 0, quantity: 86 },
  { name: "Crocante Alfajor", price: 0, quantity: 86 },
  { name: "Dulce D Leche Alfajor", price: 0, quantity: 86 },
];

// =========================
// HELPERS
// =========================
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

function getCondicionIVAEmisor(tipoComprobante: number): string {
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
    default:
      return "CONSUMIDOR FINAL";
  }
}

function getCondicionIVAReceptorLabel(
  tipoComprobante: number,
  tipoCliente?: TipoCliente
) {
  if (tipoComprobante === 11 || tipoComprobante === 13) {
    return "CONSUMIDOR FINAL";
  }

  if (tipoCliente === "Mayorista" || tipoCliente === "Cliente") {
    return "RESPONSABLE INSCRIPTO / SEGÚN PADRÓN";
  }

  return "CONSUMIDOR FINAL";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR").format(new Date(date));
}

function formatTimeAR(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function buildNumeroComprobante(pv: number, nro: number) {
  return `${String(pv).padStart(4, "0")}-${String(nro).padStart(8, "0")}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function uploadPDFtoCloudinary(filePath: string): Promise<string> {
  const res = await cloudinary.v2.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "facturas-afip",
    public_id: `factura-${factura.numero}`,
    overwrite: true,
  });

  return res.secure_url;
}

async function generarQRPNGDesdeURL(url: string, outputPath: string) {
  await QRCode.toFile(outputPath, url, {
    type: "png",
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

// =========================
// PDF LAYOUT HELPERS
// =========================
const COLORS = {
  black: "#111111",
  gray900: "#222222",
  gray700: "#4b5563",
  gray500: "#6b7280",
  gray300: "#d1d5db",
  gray200: "#e5e7eb",
  gray100: "#f3f4f6",
  white: "#ffffff",
};

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor?: string
) {
  if (fillColor) {
    doc.save();
    doc.fillColor(fillColor).rect(x, y, w, h).fill();
    doc.restore();
  }

  doc.save();
  doc.lineWidth(0.7).strokeColor(COLORS.gray300).rect(x, y, w, h).stroke();
  doc.restore();
}

function renderPageHeader(doc: PDFKit.PDFDocument, logoPath?: string) {
  const pageWidth = doc.page.width;
  const left = 40;
  const right = pageWidth - 40;
  const width = right - left;
  const top = 28;

  const headerH = 112;
  const emisorW = width * 0.62;
  const letterW = width * 0.12;
  const metaW = width - emisorW - letterW;

  drawBox(doc, left, top, emisorW, headerH);
  drawBox(doc, left + emisorW, top, letterW, headerH);
  drawBox(doc, left + emisorW + letterW, top, metaW, headerH);

  if (logoPath && fs.existsSync(logoPath)) {
    doc.image(logoPath, left + 14, top + 12, { fit: [90, 50] });
  }

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.black)
    .fontSize(19)
    .text(process.env.BUSINESS_NAME ?? "ComarPOS", left + 14, top + 64, {
      width: emisorW - 28,
      align: "left",
    });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(COLORS.gray700)
    .text("Av. Julio Argentino Roca 288", left + 14, top + 88, {
      width: emisorW - 28,
    })
    .text("X5194 Villa General Belgrano, Córdoba", left + 14, doc.y + 1, {
      width: emisorW - 28,
    })
    .text(`CUIT: ${factura.cuit}`, left + 14, doc.y + 1, {
      width: emisorW - 28,
    })
    .text(getCondicionIVAEmisor(factura.tipoComprobante), left + 14, doc.y + 1, {
      width: emisorW - 28,
    });

  const letra = getLetraComprobante(factura.tipoComprobante);

  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(COLORS.black)
    .text(letra, left + emisorW, top + 18, {
      width: letterW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text("COD. 011", left + emisorW, top + 70, {
      width: letterW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(COLORS.black)
    .text(`FACTURA ${letra}`, left + emisorW + letterW + 12, top + 12, {
      width: metaW - 24,
      align: "left",
    });

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(COLORS.gray700)
    .text(
      `Punto de Venta: ${String(factura.puntoVenta).padStart(4, "0")}`,
      left + emisorW + letterW + 12,
      top + 38,
      { width: metaW - 24 }
    )
    .text(
      `Comp. Nro: ${String(factura.numero).padStart(8, "0")}`,
      left + emisorW + letterW + 12,
      doc.y + 3,
      { width: metaW - 24 }
    )
    .text(
      `Fecha de Emisión: ${formatDateAR(factura.fechaEmision)}`,
      left + emisorW + letterW + 12,
      doc.y + 3,
      { width: metaW - 24 }
    )
    .text(
      `Hora: ${formatTimeAR(factura.fechaEmision)}`,
      left + emisorW + letterW + 12,
      doc.y + 3,
      { width: metaW - 24 }
    );

  doc.y = top + headerH + 14;
}

function renderClienteSection(doc: PDFKit.PDFDocument) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 78;
  drawBox(doc, left, top, width, sectionH, COLORS.white);

  doc
    .font("Helvetica-Bold")
    .fillColor(COLORS.black)
    .fontSize(10.5)
    .text("DATOS DEL RECEPTOR", left + 12, top + 8, {
      width: width - 24,
    });

  const col1X = left + 12;
  const col2X = left + width / 2 + 6;
  const line1Y = top + 26;
  const line2Y = top + 43;

  doc.font("Helvetica").fontSize(9.2).fillColor(COLORS.gray900);

  doc.text(`Razón social: ${cliente.nombre}`, col1X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`CUIT / Doc: ${cliente.dni}`, col2X, line1Y, {
    width: width / 2 - 18,
  });

  doc.text(`Condición: ${getClienteLabel(cliente.category)}`, col1X, line2Y, {
    width: width / 2 - 18,
  });

  doc.text(
    `Condición IVA: ${getCondicionIVAReceptorLabel(
      factura.tipoComprobante,
      cliente.category
    )}`,
    col2X,
    line2Y,
    {
      width: width / 2 - 18,
    }
  );

  if (cliente.gmail) {
    doc.text(`Email: ${cliente.gmail}`, col1X, top + 60, {
      width: width - 24,
    });
  }

  doc.y = top + sectionH + 12;
}

function renderTableHeader(doc: PDFKit.PDFDocument) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const rowH = 22;
  drawBox(doc, left, top, width, rowH, COLORS.gray100);

  const cols = {
    qty: 48,
    desc: width - 48 - 92 - 102,
    unit: 92,
    total: 102,
  };

  let x = left;

  doc
    .font("Helvetica-Bold")
    .fontSize(9.2)
    .fillColor(COLORS.black)
    .text("Cant.", x + 6, top + 5, {
      width: cols.qty - 12,
      align: "left",
    });
  x += cols.qty;

  doc.text("Descripción", x + 6, top + 5, {
    width: cols.desc - 12,
    align: "left",
  });
  x += cols.desc;

  doc.text("P. Unitario", x + 6, top + 5, {
    width: cols.unit - 12,
    align: "right",
  });
  x += cols.unit;

  doc.text("Importe", x + 6, top + 5, {
    width: cols.total - 12,
    align: "right",
  });

  doc.y = top + rowH;
}

function ensureTableSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  const reservedBottomSpace = 215;
  const bottomLimit = doc.page.height - reservedBottomSpace;

  if (doc.y + neededHeight > bottomLimit) {
    throw new Error(
      "La factura excede el espacio disponible de una sola hoja A4. Ajustá el layout o reducí el contenido."
    );
  }
}

function renderProductsTable(doc: PDFKit.PDFDocument) {
  renderTableHeader(doc);

  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;

  const cols = {
    qty: 48,
    desc: width - 48 - 92 - 102,
    unit: 92,
    total: 102,
  };

  for (const prod of products) {
    const importe = prod.quantity * prod.price;
    const baseRowMinHeight = 18;

    const descHeight = doc.heightOfString(prod.name, {
      width: cols.desc - 12,
      align: "left",
    });

    const rowH = Math.max(baseRowMinHeight, descHeight + 4);

    ensureTableSpace(doc, rowH);

    const y = doc.y;

    drawBox(doc, left, y, width, rowH);

    let x = left;
    doc.font("Helvetica").fontSize(8.8).fillColor(COLORS.gray900);

    doc.text(String(prod.quantity), x + 6, y + 4, {
      width: cols.qty - 12,
      align: "left",
    });
    x += cols.qty;

    doc.text(prod.name, x + 6, y + 4, {
      width: cols.desc - 12,
      align: "left",
    });
    x += cols.desc;

    doc.text(formatCurrency(prod.price), x + 6, y + 4, {
      width: cols.unit - 12,
      align: "right",
    });
    x += cols.unit;

    doc.text(formatCurrency(importe), x + 6, y + 4, {
      width: cols.total - 12,
      align: "right",
    });

    doc.y = y + rowH;
  }

  doc.moveDown(0.35);
}

function renderTotals(doc: PDFKit.PDFDocument) {
  const boxW = 220;
  const boxH = 60;
  const x = doc.page.width - 40 - boxW;
  const y = doc.y;

  drawBox(doc, x, y, boxW, boxH);

  const labelX = x + 12;
  const valueX = x + 110;

  doc
    .font("Helvetica")
    .fontSize(9.2)
    .fillColor(COLORS.gray900)
    .text("Subtotal:", labelX, y + 8, { width: 90 })
    .text(formatCurrency(factura.neto), valueX, y + 8, {
      width: 95,
      align: "right",
    });

  doc.text("IVA:", labelX, y + 24, { width: 90 }).text(
    formatCurrency(factura.iva),
    valueX,
    y + 24,
    {
      width: 95,
      align: "right",
    }
  );

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.black)
    .text("TOTAL:", labelX, y + 40, { width: 90 })
    .text(formatCurrency(factura.total), valueX, y + 40, {
      width: 95,
      align: "right",
    });

  doc.y = y + boxH + 8;
}

function renderFiscalSection(doc: PDFKit.PDFDocument, qrPath?: string) {
  const left = 40;
  const right = doc.page.width - 40;
  const width = right - left;
  const top = doc.y;

  const sectionH = 125;
  drawBox(doc, left, top, width, sectionH);

  const qrW = 84;
  const qrX = right - qrW - 14;
  const qrY = top + 14;

  const infoX = left + 14;
  const infoW = width - qrW - 36;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.black)
    .text("DATOS FISCALES", infoX, top + 10, { width: infoW });

  let textY = top + 30;

  doc
    .font("Helvetica")
    .fontSize(8.9)
    .fillColor(COLORS.gray900)
    .text("Comprobante autorizado electrónicamente.", infoX, textY, {
      width: infoW,
    });

  textY += 16;
  doc.text(`CAE: ${factura.cae}`, infoX, textY, {
    width: infoW,
  });

  textY += 16;
  doc.text(`Vencimiento CAE: ${formatDateAR(factura.caeVto)}`, infoX, textY, {
    width: infoW,
  });

  textY += 16;
  doc.text(
    `Comprobante: ${buildNumeroComprobante(
      factura.puntoVenta,
      factura.numero
    )}`,
    infoX,
    textY,
    {
      width: infoW,
    }
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
      doc.image(qrPath, qrX, qrY, {
        fit: [qrW, qrW],
      });
    } catch (error) {
      console.warn("⚠️ QR inválido, se omite del PDF:", error);

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
  }

  doc.y = top + sectionH + 6;
}

function renderFooter(doc: PDFKit.PDFDocument) {
  const left = 40;
  const y = doc.page.height - 40;

  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(COLORS.gray500)
    .text(
      "Este documento representa un comprobante electrónico autorizado por ARCA/AFIP.",
      left,
      y,
      { width: doc.page.width - 80, align: "center" }
    )
    .text("Verificación: comprobante.afip.gob.ar", left, y + 10, {
      width: doc.page.width - 80,
      align: "center",
    });
}

// =========================
// GENERAR PDF
// =========================
async function generarFacturaPDF({
  uploadToCloudinary = false,
}: {
  uploadToCloudinary?: boolean;
}) {
  const basePath = path.resolve("./");
  const outputDir = path.join(basePath, "tmp");
  ensureDir(outputDir);

  const filePath = path.join(outputDir, `factura-${factura.numero}.pdf`);
  const logoPath = path.join(basePath, "assets/logo-comarpos.png");
  const qrPath = path.join(outputDir, `qr-${factura.numero}.png`);

  try {
    let qrDisponible = false;

    if (factura.urlQR) {
      try {
        await generarQRPNGDesdeURL(factura.urlQR, qrPath);
        qrDisponible = true;
      } catch (error) {
        console.warn("⚠️ No se pudo generar el QR desde la URL:", error);
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

        renderPageHeader(doc, logoPath);
        renderClienteSection(doc);
        renderProductsTable(doc);
        renderTotals(doc);
        renderFiscalSection(
          doc,
          qrDisponible && fs.existsSync(qrPath) ? qrPath : undefined
        );
        renderFooter(doc);

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

    console.log(`✅ PDF generado en: ${filePath}`);

    if (!uploadToCloudinary) {
      return { filePath };
    }

    const cloudinaryUrl = await uploadPDFtoCloudinary(filePath);
    console.log(`☁️ PDF subido a Cloudinary: ${cloudinaryUrl}`);

    return { filePath, cloudinaryUrl };
  } catch (error) {
    if (fs.existsSync(qrPath)) {
      fs.unlinkSync(qrPath);
    }
    throw error;
  }
}

// =========================
// RUN
// =========================
(async () => {
  try {
    const shouldUpload = process.argv.includes("--cloudinary");

    const result = await generarFacturaPDF({
      uploadToCloudinary: shouldUpload,
    });

    console.log("RESULTADO:");
    console.log(result);
  } catch (error) {
    console.error("❌ Error generando factura:", error);
    process.exit(1);
  }
})();