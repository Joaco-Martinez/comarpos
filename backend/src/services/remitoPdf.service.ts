import PDFDocument from "pdfkit";

export type RemitoPDFData = {
  remito: {
    pointOfSale: number;
    number: number;
    issueDate: Date | string;
    placeOfIssue?: string | null;
    cai?: string | null;
    caiExpiresAt?: Date | string | null;
    sellerName?: string | null;
    saleCondition?: string | null;
    transportName?: string | null;
    packages?: number | null;
    declaredValue?: number | null;
    copyLabel?: string | null;
  };
  business: {
    businessName: string;
    fantasyName?: string | null;
    cuit: string;
    ivaCondition: string;
    grossIncomeNumber?: string | null;
    activityStartDate?: Date | string | null;
    fiscalAddress?: string | null;
    businessAddress?: string | null;
    locality?: string | null;
    province?: string | null;
    phone?: string | null;
    email?: string | null;
    logoPath?: string | null;
  };
  client: {
    name?: string | null;
    address?: string | null;
    locality?: string | null;
    ivaCondition?: string | null;
    cuitOrDni?: string | null;
  };
  items: {
    code?: string | null;
    quantity: number;
    quantityKg?: number | null;
    description: string;
  }[];
};

function formatDateAR(value?: Date | string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatMoneyAR(value?: number | null) {
  if (value === null || value === undefined) return "";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(Number(value));
}

function buildFullNumber(pointOfSale: number, number: number) {
  return `${String(pointOfSale || 0).padStart(4, "0")}-${String(
    number || 0
  ).padStart(8, "0")}`;
}

function safeText(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function upper(value?: string | null) {
  return safeText(value).toUpperCase();
}

function drawBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.save();
  doc.lineWidth(0.7).strokeColor("#444444").rect(x, y, w, h).stroke();
  doc.restore();
}

function drawLine(
  doc: PDFKit.PDFDocument,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  doc.save();
  doc
    .lineWidth(0.7)
    .strokeColor("#444444")
    .moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke();
  doc.restore();
}

function renderHeader(doc: PDFKit.PDFDocument, data: RemitoPDFData) {
  const left = 28;
  const top = 22;
  const width = 539;

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#111111")
    .text("DOCUMENTO NO VÁLIDO COMO FACTURA", left, top, {
      width,
      align: "center",
    });

  const y = top + 18;
  const leftW = 250;
  const letterW = 55;
  const rightW = width - leftW - letterW;
  const headerH = 104;

  drawBox(doc, left, y, leftW, headerH);
  drawBox(doc, left + leftW, y, letterW, headerH);
  drawBox(doc, left + leftW + letterW, y, rightW, headerH);

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor("#111111")
    .text(
      data.business.fantasyName || data.business.businessName || "ComarPOS",
      left + 12,
      y + 18,
      {
        width: leftW - 24,
        align: "center",
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(data.business.businessName || "ComarPOS", left + 12, y + 65, {
      width: leftW - 24,
      align: "center",
    });

  const businessAddress = [
    data.business.businessAddress || data.business.fiscalAddress,
    data.business.locality,
    data.business.province,
  ]
    .filter(Boolean)
    .join(" - ");

  doc
    .font("Helvetica")
    .fontSize(7)
    .text(businessAddress, left + 12, y + 78, {
      width: leftW - 24,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(7)
    .text(
      [data.business.phone ? `T: ${data.business.phone}` : null, data.business.email]
        .filter(Boolean)
        .join(" - "),
      left + 12,
      y + 91,
      {
        width: leftW - 24,
        align: "center",
      }
    );

  const letterX = left + leftW;

  doc
    .font("Helvetica-Bold")
    .fontSize(36)
    .text("R", letterX, y + 18, {
      width: letterW,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("COD Nº 91", letterX, y + 64, {
      width: letterW,
      align: "center",
    });

  const rightX = left + leftW + letterW;

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(
      `REMITO Nº ${buildFullNumber(
        data.remito.pointOfSale,
        data.remito.number
      )}`,
      rightX + 8,
      y + 16,
      {
        width: rightW - 16,
        align: "center",
      }
    );

  drawLine(doc, rightX, y + 45, rightX + rightW, y + 45);
  drawLine(doc, rightX + rightW / 2, y + 45, rightX + rightW / 2, y + headerH);

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("LUGAR DE EMISIÓN", rightX, y + 53, {
      width: rightW / 2,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("FECHA", rightX + rightW / 2, y + 53, {
      width: rightW / 2,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .text(
      upper(data.remito.placeOfIssue || data.business.locality || ""),
      rightX + 6,
      y + 73,
      {
        width: rightW / 2 - 12,
        align: "center",
      }
    );

  doc
    .font("Helvetica")
    .fontSize(8)
    .text(formatDateAR(data.remito.issueDate), rightX + rightW / 2 + 6, y + 73, {
      width: rightW / 2 - 12,
      align: "center",
    });

  const fiscalY = y + headerH;
  const fiscalH = 22;

  drawBox(doc, left, fiscalY, width, fiscalH);

  const fiscalText = [
    data.business.ivaCondition,
    data.business.cuit ? `CUIT: ${data.business.cuit}` : null,
    data.business.grossIncomeNumber
      ? `ING. BRUTOS Nº ${data.business.grossIncomeNumber}`
      : null,
    data.business.activityStartDate
      ? `INICIO ACT. ${formatDateAR(data.business.activityStartDate)}`
      : null,
  ]
    .filter(Boolean)
    .join(" - ");

  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(fiscalText, left + 8, fiscalY + 7, {
      width: width - 16,
      align: "center",
    });

  return fiscalY + fiscalH;
}

function renderClientBlock(
  doc: PDFKit.PDFDocument,
  data: RemitoPDFData,
  y: number
) {
  const left = 28;
  const width = 539;
  const h = 78;
  const half = width / 2;

  drawBox(doc, left, y, width, h);
  drawLine(doc, left + half, y, left + half, y + h);

  const x1 = left + 10;
  const x2 = left + half + 10;

  doc.font("Helvetica-Bold").fontSize(7.5).text("NOMBRE:", x1, y + 10, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.client.name)}`);

  doc.font("Helvetica-Bold").fontSize(7.5).text("VENDEDOR:", x2, y + 10, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.remito.sellerName)}`);

  doc.font("Helvetica-Bold").fontSize(7.5).text("DOMICILIO:", x1, y + 29, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.client.address)}`);

  doc.font("Helvetica-Bold").fontSize(7.5).text("LOCALIDAD:", x1, y + 48, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.client.locality)}`);

  doc.font("Helvetica-Bold").fontSize(7.5).text("IVA:", x1, y + 67, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.client.ivaCondition)}`);

  doc.font("Helvetica-Bold").fontSize(7.5).text(
    "CUIT/DNI:",
    left + half - 110,
    y + 67,
    {
      continued: true,
    }
  );
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.client.cuitOrDni)}`);

  return y + h;
}

function renderTransportBlock(
  doc: PDFKit.PDFDocument,
  data: RemitoPDFData,
  y: number
) {
  const left = 28;
  const width = 539;
  const h = 42;
  const half = width / 2;

  drawBox(doc, left, y, width, h);
  drawLine(doc, left + half, y, left + half, y + h);

  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text("CONDICIONES DE VENTA:", left + 10, y + 12, {
      continued: true,
    });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.remito.saleCondition)}`);

  doc
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text("TRANSPORTE:", left + half + 10, y + 12, {
      continued: true,
    });
  doc.font("Helvetica").fontSize(8).text(` ${upper(data.remito.transportName)}`);

  return y + h;
}

function renderItems(
  doc: PDFKit.PDFDocument,
  data: RemitoPDFData,
  y: number
) {
  const left = 28;
  const width = 539;
  const tableH = 330;
  const codeW = 75;
  const qtyW = 85;
  const descW = width - codeW - qtyW;

  drawBox(doc, left, y, width, tableH);
  drawLine(doc, left + codeW, y, left + codeW, y + tableH);
  drawLine(doc, left + codeW + qtyW, y, left + codeW + qtyW, y + tableH);
  drawLine(doc, left, y + 26, left + width, y + 26);

  doc.font("Helvetica-Bold").fontSize(8);
  doc.text("CÓDIGO", left + 8, y + 9, { width: codeW - 12 });
  doc.text("CANTIDAD", left + codeW + 8, y + 9, { width: qtyW - 12 });
  doc.text("DESCRIPCIÓN", left + codeW + qtyW + 8, y + 9, {
    width: descW - 12,
  });

  let rowY = y + 36;

  doc.font("Helvetica").fontSize(8);

  for (const item of data.items) {
    if (rowY > y + tableH - 18) break;

    const qty =
      item.quantityKg && item.quantityKg > 0
        ? `${item.quantityKg} KG`
        : `${item.quantity}`;

    doc.text(safeText(item.code), left + 8, rowY, { width: codeW - 12 });
    doc.text(qty, left + codeW + 8, rowY, { width: qtyW - 12 });
    doc.text(upper(item.description), left + codeW + qtyW + 8, rowY, {
      width: descW - 12,
    });

    rowY += 18;
  }

  return y + tableH;
}

function renderFooter(
  doc: PDFKit.PDFDocument,
  data: RemitoPDFData,
  y: number
) {
  const left = 28;
  const width = 539;

  doc.font("Helvetica-Bold").fontSize(8).text("BULTOS:", left, y + 22, {
    continued: true,
  });
  doc.font("Helvetica").fontSize(8).text(` ${safeText(data.remito.packages)}`);

  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("VALOR DECLARADO:", left, y + 52, {
      continued: true,
    });
  doc
    .font("Helvetica")
    .fontSize(8)
    .text(` ${formatMoneyAR(data.remito.declaredValue)}`);

  const signX = 340;
  const signW = 195;

  drawLine(doc, signX, y + 28, signX + signW, y + 28);
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .text("RECIBÍ CONFORME - FIRMA", signX, y + 34, {
      width: signW,
      align: "center",
    });

  drawLine(doc, signX, y + 78, signX + signW, y + 78);
  doc.font("Helvetica-Bold").fontSize(7).text("ACLARACIÓN", signX, y + 84, {
    width: signW,
    align: "center",
  });

  const caiText = [
    data.remito.cai ? `CAI Nº ${data.remito.cai}` : null,
    data.remito.caiExpiresAt
      ? `VTO. CAI ${formatDateAR(data.remito.caiExpiresAt)}`
      : null,
  ]
    .filter(Boolean)
    .join(" - ");

  if (caiText) {
    doc.font("Helvetica-Bold").fontSize(7.5).text(caiText, left, y + 118, {
      width,
      align: "center",
    });
  }

  drawBox(doc, left, y + 140, width, 28);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(data.remito.copyLabel || "ORIGINAL", left, y + 150, {
      width,
      align: "center",
    });
}

export async function generateRemitoPDFBuffer(
  data: RemitoPDFData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Remito ${buildFullNumber(
          data.remito.pointOfSale,
          data.remito.number
        )}`,
        Author: data.business.businessName,
      },
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const copies = ["ORIGINAL", "DUPLICADO", "TRIPLICADO"];

    copies.forEach((copyLabel, index) => {
      if (index > 0) {
        doc.addPage({
          size: "A4",
          margin: 0,
        });
      }

      const pageData: RemitoPDFData = {
        ...data,
        remito: {
          ...data.remito,
          copyLabel,
        },
      };

      doc.save();
      doc.opacity(0.06);
      doc
        .font("Helvetica-Bold")
        .fontSize(76)
        .fillColor("#111111")
        .text(
          pageData.business.fantasyName ||
            pageData.business.businessName ||
            "ComarPOS",
          70,
          360,
          {
            width: 460,
            align: "center",
          }
        );
      doc.restore();

      const y1 = renderHeader(doc, pageData);
      const y2 = renderClientBlock(doc, pageData, y1);
      const y3 = renderTransportBlock(doc, pageData, y2);
      const y4 = renderItems(doc, pageData, y3);
      renderFooter(doc, pageData, y4);
    });

    doc.end();
  });
}