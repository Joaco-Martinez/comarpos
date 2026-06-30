import prisma from "../prisma";
import fs from "fs";
import path from "path";
import {
  generarFacturaPDF,
  FacturaPDFData,
  TipoCliente,
} from "./facturaPdfGenerator.service";

export async function regenerarFacturaPDFService(
  saleId: string,
  uploadToCloudinary = false
) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      client: true,
      invoiceAfip: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!sale) {
    throw new Error("Venta no encontrada");
  }

  if (!sale.invoiceAfip) {
    throw new Error("La venta no tiene factura AFIP asociada");
  }

  const invoice = sale.invoiceAfip;

  const pdfData: FacturaPDFData = {
    factura: {
      cuit: invoice.cuit,
      puntoVenta: invoice.puntoVenta,
      tipoComprobante: invoice.tipoComprobante,
      tipoDoc: invoice.tipoDoc,
      nroDoc: Number(invoice.nroDoc),
      numero: invoice.numero,
      fechaEmision: new Date(invoice.fechaEmision),
      resultado: invoice.resultado,
      cae: invoice.cae || "",
      caeVto: invoice.caeVto ? new Date(invoice.caeVto) : new Date(),
      total: Number(invoice.total),
      neto: Number(invoice.neto),
      iva: Number(invoice.iva),
      condicionIVAReceptor: invoice.condicionIVAReceptor,
      moneda: invoice.moneda,
      urlQR: invoice.urlQR || undefined,
      saleId: sale.id,
    },

    empresa: {
      name: process.env.BUSINESS_NAME || "ComarPOS",
      subtitle: process.env.BUSINESS_SUBTITLE || "SANTILLAN JULIO CESAR",
      cuit: process.env.BUSINESS_CUIT || invoice.cuit,
      address:
        process.env.BUSINESS_ADDRESS ||
        "PASO DE LOS ANDES 893, BARRIO OBSERVATORIO, 5000-CORDOBA",
      phone: process.env.BUSINESS_PHONE || "+54 9 3513 79-0057",
      ivaCondition:
        process.env.BUSINESS_IVA_CONDITION ||
        undefined,
    },

    cliente: {
      nombre: sale.client?.nombre || "Consumidor Final",
      apellido: sale.client?.apellido || "",
      dni: sale.client?.dni || "",
      telefono: sale.client?.telefono || "",
      gmail: sale.client?.gmail || sale.gmailSend || "",
      category:
        (sale.client?.category as TipoCliente | undefined) || "Consumidor Final",
    },

    products: sale.items.map((item) => {
      const quantity = Number(item.quantity || 0);
      const quantityKg =
        (item as any).quantityKg !== null && (item as any).quantityKg !== undefined
          ? Number((item as any).quantityKg)
          : undefined;

      const price = Number(item.price || 0);

      const subtotal =
        (item as any).subtotal !== null && (item as any).subtotal !== undefined
          ? Number((item as any).subtotal)
          : quantityKg !== undefined && quantityKg > 0
          ? quantityKg * price
          : quantity * price;

      return {
        name:
          item.product?.name ||
          (item as any).productNameSnapshot ||
          "Producto",
        quantity,
        quantityKg,
        price,
        subtotal,
      };
    }),
  };

  const result = await generarFacturaPDF(pdfData, uploadToCloudinary);

  if (uploadToCloudinary && "cloudinaryUrl" in result && result.cloudinaryUrl) {
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        pdfUrl: result.cloudinaryUrl,
      },
    });

    await prisma.invoice.updateMany({
      where: { saleId },
      data: {
        pdfUrl: result.cloudinaryUrl,
      },
    });
  }

  return result;
}

export async function obtenerTodasLasFacturasService() {
  const facturas = await prisma.invoiceAfip.findMany({
    orderBy: {
      fechaEmision: "desc",
    },
    include: {
      sale: {
        include: {
          client: true,
        },
      },
    },
  });

  return facturas.map((factura) => ({
    id: factura.id,
    saleId: factura.saleId,
    cuit: factura.cuit,
    puntoVenta: factura.puntoVenta,
    tipoComprobante: factura.tipoComprobante,
    tipoDoc: factura.tipoDoc,
    nroDoc: Number(factura.nroDoc),
    numero: factura.numero,
    fechaEmision: factura.fechaEmision,
    resultado: factura.resultado,
    cae: factura.cae,
    caeVto: factura.caeVto,
    total: factura.total,
    neto: factura.neto,
    iva: factura.iva,
    condicionIVAReceptor: factura.condicionIVAReceptor,
    moneda: factura.moneda,
    urlQR: factura.urlQR,
    qrBase64: factura.qrBase64,
    createdAt: factura.createdAt,
    updatedAt: factura.updatedAt,
    relatedInvoiceId: factura.relatedInvoiceId,
    pdfUrl: factura.sale?.pdfUrl || null,

    client: factura.sale?.client
      ? {
          id: factura.sale.client.id,
          nombre: factura.sale.client.nombre,
          apellido: factura.sale.client.apellido,
          dni: factura.sale.client.dni,
          telefono: factura.sale.client.telefono,
          gmail: factura.sale.client.gmail,
          category: factura.sale.client.category,
        }
      : null,
  }));
}

export async function obtenerFacturaPDFPathService(saleId: string) {
  const result = await regenerarFacturaPDFService(saleId, false);

  if (!result.filePath || !fs.existsSync(result.filePath)) {
    throw new Error("No se pudo generar el archivo PDF");
  }

  return {
    filePath: result.filePath,
    fileName: path.basename(result.filePath),
  };
}