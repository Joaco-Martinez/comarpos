import express from "express";
import { generarTokenAFIP } from "../afip/wsaa.service";
import { emitirNotaCreditoAFIP } from "../afip/wsfe.service";
import {
  emitirFacturaCConsumidorFinal,
  emitirFacturaCACliente,
} from "../afip/wsfe-C.service";
import { generarFacturaAfipPDF } from "./utils/generarFacturaAfipPDF";
import { financeService } from "../services/finance.service";
import { generarNotaCreditoAfipPDF } from "./utils/generarNotaCreditoAfipPDF";
import { isAfipUnavailable } from "./utils/isAfipUnavailable";
import prisma from "../prisma";

const router = express.Router();

function normalizarDocumento(valor: unknown): string {
  if (valor == null) return "";
  return String(valor).replace(/\D/g, "").trim();
}

function detectarTipoDocumento(valor: unknown): {
  tipoDoc: number;
  nroDoc: number;
  label: "DNI" | "CUIT" | "CUIL";
} | null {
  const limpio = normalizarDocumento(valor);

  if (!limpio) return null;

  if (limpio.length === 7 || limpio.length === 8) {
    return {
      tipoDoc: 96,
      nroDoc: Number(limpio),
      label: "DNI",
    };
  }

  if (limpio.length === 11) {
    const prefijo = limpio.slice(0, 2);

    if (["20", "23", "24", "27"].includes(prefijo)) {
      return {
        tipoDoc: 86,
        nroDoc: Number(limpio),
        label: "CUIL",
      };
    }

    if (["30", "33", "34"].includes(prefijo)) {
      return {
        tipoDoc: 80,
        nroDoc: Number(limpio),
        label: "CUIT",
      };
    }

    return {
      tipoDoc: 80,
      nroDoc: Number(limpio),
      label: "CUIT",
    };
  }

  return null;
}

function mapTipoCliente(clientCategory?: string): "Consumidor Final" | "Cliente" | "Mayorista" {
  if (clientCategory === "Mayorista") return "Mayorista";
  if (clientCategory === "Cliente") return "Cliente";
  return "Consumidor Final";
}

function getNombreCliente(
  client?: {
    nombre?: string | null;
    apellido?: string | null;
  } | null
) {
  const nombre = client?.nombre?.trim() ?? "";
  const apellido = client?.apellido?.trim() ?? "";
  const fullName = `${nombre} ${apellido}`.trim();

  return fullName || "A CONSUMIDOR FINAL ***********";
}

function getDocumentoCliente(client: any, facturaData: any) {
  if (client?.dni) return String(client.dni);
  if (facturaData?.nroDoc) return String(facturaData.nroDoc);
  return undefined;
}

function getDomicilioCliente(client: any) {
  return [client?.address, client?.locality, client?.province]
    .filter(Boolean)
    .join(", ");
}

function numberOrZero(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function mapProductsFromSaleOrBody(reqBody: any, sale: any) {
  if (reqBody.products && Array.isArray(reqBody.products)) {
    return reqBody.products.map((item: any) => {
      const quantity = numberOrZero(item.quantity);
      const quantityKg =
        item.quantityKg !== null && item.quantityKg !== undefined
          ? numberOrZero(item.quantityKg)
          : undefined;

      const price = numberOrZero(item.price);

      const subtotal =
        item.subtotal !== undefined && item.subtotal !== null
          ? numberOrZero(item.subtotal)
          : quantityKg !== undefined && quantityKg > 0
          ? quantityKg * price
          : quantity * price;

      return {
        name: item.name ?? "Producto",
        quantity,
        ...(quantityKg !== undefined ? { quantityKg } : {}),
        price,
        subtotal,
      };
    });
  }

  return sale.items.map((item: any) => {
    const quantity = numberOrZero(item.quantity);
    const quantityKg =
      item.quantityKg !== null && item.quantityKg !== undefined
        ? numberOrZero(item.quantityKg)
        : undefined;

    const price = numberOrZero(item.price);

    const subtotal =
      item.subtotal !== undefined && item.subtotal !== null
        ? numberOrZero(item.subtotal)
        : quantityKg !== undefined && quantityKg > 0
        ? quantityKg * price
        : quantity * price;

    return {
      name: item.product?.name ?? "Producto",
      quantity,
      ...(quantityKg !== undefined ? { quantityKg } : {}),
      price,
      subtotal,
    };
  });
}

function getMetodoPago(reqBody: any, sale: any) {
  if (reqBody.metodoPago) return reqBody.metodoPago;
  if (reqBody.paymentMethod) return reqBody.paymentMethod;

  if (sale.payments && sale.payments.length > 0) {
    return sale.payments
      .map(
        (p: any) =>
          `${p.method}: ${Number(p.amount).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
      )
      .join(" | ");
  }

  return sale.paymentMethod || "EFECTIVO";
}

function getFacturaQrUrl(factura: any): string | undefined {
  return factura?.urlQR ?? factura?.qrUrl ?? factura?.qrURL ?? undefined;
}

router.get("/token", async (_req, res) => {
  try {
    const data = await generarTokenAFIP();
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error("❌ Error detallado en /afip/token:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get("/prueba", async (_req, res) => {
  res.json({ ok: true, message: "La ruta de prueba funciona correctamente." });
});

router.post("/facturar", async (req, res) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  const { saleId, ...facturaData } = req.body;

  // Seguridad backend: aunque el frontend mande A o B, este sistema solo emite Factura C.
  facturaData.tipoComprobante = 11;
  req.body.tipoComprobante = 11;

  console.log("============================================================");
  console.log(`🟦 [${requestId}] INICIO POST /afip/facturar`);
  console.log(`🟦 [${requestId}] Timestamp:`, new Date().toISOString());
  console.log(`🟦 [${requestId}] Body completo:`, JSON.stringify(req.body, null, 2));
  console.log(`🟦 [${requestId}] Body resumen:`, {
    saleId,
    tipoComprobante: facturaData.tipoComprobante,
    tipoDoc: facturaData.tipoDoc,
    nroDoc: facturaData.nroDoc,
    cuit: facturaData.cuit,
    importe: facturaData.importe,
    condicionIVAReceptor: facturaData.condicionIVAReceptor,
  });

  try {
    console.log(`🔎 [${requestId}] Validando saleId...`);

    if (!saleId) {
      console.warn(`⚠️ [${requestId}] saleId faltante`);
      return res.status(400).json({ ok: false, error: "saleId es requerido" });
    }

    console.log(`🔎 [${requestId}] Buscando venta en DB:`, saleId);

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        invoiceAfip: true,
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      console.warn(`❌ [${requestId}] Venta no encontrada:`, saleId);
      return res.status(404).json({ ok: false, error: "Venta no encontrada" });
    }

    console.log(`✅ [${requestId}] Venta encontrada:`, {
      id: sale.id,
      total: sale.total,
      subtotal: (sale as any).subtotal,
      discount: (sale as any).discount,
      status: sale.status,
      isInvoiced: sale.isInvoiced,
      invoiceStatus: sale.invoiceStatus,
      tieneInvoiceAfip: Boolean(sale.invoiceAfip),
      invoiceAfipId: sale.invoiceAfip?.id ?? null,
      clientId: sale.clientId,
      tieneCliente: Boolean(sale.client),
      itemsLength: sale.items.length,
      paymentsLength: sale.payments.length,
      afipLastError: sale.afipLastError,
      nextRetryAt: sale.nextRetryAt,
      retryCount: sale.retryCount,
    });

    console.log(`👤 [${requestId}] Cliente:`, sale.client
      ? {
          id: sale.client.id,
          nombre: sale.client.nombre,
          apellido: sale.client.apellido,
          dni: sale.client.dni,
          gmail: sale.client.gmail,
          telefono: sale.client.telefono,
          category: sale.client.category,
        }
      : null
    );

    console.log(`📦 [${requestId}] Items de venta:`, sale.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name,
      sku: item.product?.sku,
      quantity: item.quantity,
      quantityKg: item.quantityKg,
      price: item.price,
      subtotal: item.subtotal,
    })));

    console.log(`💳 [${requestId}] Pagos:`, sale.payments.map((payment: any) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount,
    })));

    const invoiceApproved =
      sale.isInvoiced ||
      sale.invoiceStatus === "INVOICED" ||
      Boolean(sale.invoiceAfip?.cae);

    if (invoiceApproved) {
      console.warn(`⚠️ [${requestId}] Venta ya facturada/aprobada:`, {
        saleId,
        isInvoiced: sale.isInvoiced,
        invoiceStatus: sale.invoiceStatus,
        invoiceAfipId: sale.invoiceAfip?.id ?? null,
        cae: sale.invoiceAfip?.cae ?? null,
      });

      return res.status(400).json({
        ok: false,
        error: "Esta venta ya fue facturada.",
      });
    }

    if (sale.invoiceStatus === "PENDING_AFIP") {
      console.warn(`🔁 [${requestId}] Venta pendiente AFIP. Reintentando facturación manualmente...`, {
        saleId,
        nextRetryAt: sale.nextRetryAt,
        retryCount: sale.retryCount,
        afipLastError: sale.afipLastError,
      });

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          afipLastError: null,
          nextRetryAt: null,
        },
      });
    }

    console.log(`📝 [${requestId}] Guardando payload AFIP en sale.afipPayloadJson...`);

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        afipPayloadJson: req.body,
        afipLastError: null,
        nextRetryAt: null,
      },
    });

    console.log(`✅ [${requestId}] Payload AFIP guardado correctamente`);

    let factura: any;

    console.log(`🧾 [${requestId}] Decidiendo tipo de comprobante...`, {
      tipoComprobante: facturaData.tipoComprobante,
      tipoComprobanteNumber: Number(facturaData.tipoComprobante),
    });

    if (facturaData.tipoComprobante !== 11) {
      console.warn(`⚠️ [${requestId}] Tipo de comprobante no soportado:`, facturaData.tipoComprobante);

      return res.status(400).json({
        ok: false,
        error: "Tipo de comprobante no soportado. Este sistema solo permite Factura C.",
      });
    }

    console.log(`🇨 [${requestId}] Entró a Factura C`);

    const docLimpio = normalizarDocumento(facturaData.nroDoc);

    const quiereConsumidorFinal =
      Number(facturaData.tipoDoc) === 99 ||
      docLimpio === "" ||
      Number(docLimpio) === 0;

    console.log(`🪪 [${requestId}] Documento Factura C:`, {
      tipoDocOriginal: facturaData.tipoDoc,
      nroDocOriginal: facturaData.nroDoc,
      docLimpio,
      quiereConsumidorFinal,
    });

    if (quiereConsumidorFinal) {
      console.log(`👤 [${requestId}] Factura C consumidor final`);

      console.log(`🚀 [${requestId}] Llamando emitirFacturaCConsumidorFinal...`, {
        saleId,
        cuit: facturaData.cuit,
        importe: facturaData.importe,
      });

      factura = await emitirFacturaCConsumidorFinal({
        saleId,
        cuit: facturaData.cuit,
        importe: facturaData.importe,
      });

      console.log(`✅ [${requestId}] emitirFacturaCConsumidorFinal respondió`);
    } else {
      const docDetectado = detectarTipoDocumento(facturaData.nroDoc);

      console.log(`🪪 [${requestId}] Documento detectado Factura C cliente:`, docDetectado);

      if (!docDetectado) {
        console.warn(`⚠️ [${requestId}] Factura C con cliente sin documento válido`);
        return res.status(400).json({
          ok: false,
          error:
            "Para Factura C con cliente, el documento debe ser válido. Puede ser DNI, CUIT o CUIL.",
        });
      }

      console.log(`🚀 [${requestId}] Llamando emitirFacturaCACliente...`, {
        saleId,
        cuit: facturaData.cuit,
        tipoDoc: docDetectado.tipoDoc,
        nroDoc: docDetectado.nroDoc,
        importe: facturaData.importe,
        condicionIVAReceptor: facturaData.condicionIVAReceptor,
      });

      factura = await emitirFacturaCACliente({
        saleId,
        cuit: facturaData.cuit,
        tipoDoc: docDetectado.tipoDoc,
        nroDoc: docDetectado.nroDoc,
        importe: facturaData.importe,
        condicionIVAReceptor: facturaData.condicionIVAReceptor,
      });

      console.log(`✅ [${requestId}] emitirFacturaCACliente respondió`);
    }

    console.log(`📨 [${requestId}] Respuesta cruda de AFIP/factura:`, factura);

    const safeFactura = JSON.parse(
      JSON.stringify(factura, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );

    console.log(`🧾 [${requestId}] Factura safe:`, safeFactura);

    console.log(`🔎 [${requestId}] Evaluando resultado AFIP:`, {
      resultado: factura?.resultado,
      cae: factura?.cae,
      numero: factura?.numero,
      tipoComprobante: factura?.tipoComprobante,
      puntoVenta: factura?.puntoVenta,
      total: factura?.total,
    });

    if (factura.resultado === "A" && factura.cae) {
      console.log(`✅ [${requestId}] AFIP APROBÓ la factura`);

      let posDisconnected = false;
      let posErrorMessage: string | null = null;

      try {
        console.log(`🖨️ [${requestId}] Preparando generación PDF / impresión POS...`);

        const client = sale.client;

        console.log(`👤 [${requestId}] Mapeando cliente para PDF...`);

        const tipoCliente = mapTipoCliente(client?.category);
        const nombreCliente = getNombreCliente(client);
        const documentoCliente = getDocumentoCliente(client, facturaData);
        const telefonoCliente = client?.telefono ?? undefined;
        const domicilioCliente = getDomicilioCliente(client);

        console.log(`👤 [${requestId}] Cliente PDF:`, {
          tipoCliente,
          nombreCliente,
          documentoCliente,
          telefonoCliente,
          domicilioCliente,
        });

        console.log(`📦 [${requestId}] Mapeando productos para PDF...`);

        const products = mapProductsFromSaleOrBody(req.body, sale);

        console.log(`📦 [${requestId}] Productos PDF:`, products);

        console.log(`💳 [${requestId}] Mapeando método de pago...`);

        const metodoPago = getMetodoPago(req.body, sale);

        console.log(`💳 [${requestId}] Método de pago PDF:`, metodoPago);

        const qrUrl = getFacturaQrUrl(factura);

        console.log(`🧾 [${requestId}] QR URL enviado al agente:`, qrUrl ?? "SIN QR URL");

        console.log(`🚀 [${requestId}] Llamando generarFacturaAfipPDF...`, {
          tipoComprobante: Number(factura.tipoComprobante),
          puntoVenta: Number(factura.puntoVenta),
          saleId,
          numero: Number(factura.numero),
          fechaEmision: factura.fechaEmision ? new Date(factura.fechaEmision) : new Date(),
          total: Number(factura.total),
          metodoPago,
          cae: String(factura.cae),
          caeVto: factura.caeVto ? new Date(factura.caeVto) : new Date(),
          cuit: String(factura.cuit),
          tieneQrBase64: Boolean(factura.qrBase64),
          qrUrl,
        });

        await generarFacturaAfipPDF({
          tipoComprobante: Number(factura.tipoComprobante),
          puntoVenta: Number(factura.puntoVenta),
          saleId,
          numero: Number(factura.numero),
          fechaEmision: factura.fechaEmision
            ? new Date(factura.fechaEmision)
            : new Date(),
          total: Number(factura.total),
          products,
          metodoPago,
          cae: String(factura.cae),
          caeVto: factura.caeVto ? new Date(factura.caeVto) : new Date(),
          cuit: String(factura.cuit),

          qrBase64: factura.qrBase64 ?? null,
          qrUrl,

          tipoCliente,
          nombreCliente,
          documentoCliente,
          telefonoCliente,
          domicilioCliente,
        });

        console.log(`✅ [${requestId}] PDF generado, subido y ticket enviado correctamente`);
      } catch (printErr: any) {
        posDisconnected = true;

        console.error(`❌ [${requestId}] Error en generación PDF / impresión POS`);
        console.error(`📛 [${requestId}] printErr message:`, printErr?.message);
        console.error(`📛 [${requestId}] printErr name:`, printErr?.name);
        console.error(`📛 [${requestId}] printErr code:`, printErr?.code);
        console.error(`📛 [${requestId}] printErr stack:`, printErr?.stack);

        if (printErr?.response) {
          console.error(`🌐 [${requestId}] printErr response status:`, printErr.response.status);
          console.error(`🌐 [${requestId}] printErr response data:`, printErr.response.data);
          console.error(`🌐 [${requestId}] printErr response headers:`, printErr.response.headers);
        }

        if (printErr?.config) {
          console.error(`🌐 [${requestId}] printErr axios config:`, {
            method: printErr.config.method,
            url: printErr.config.url,
            baseURL: printErr.config.baseURL,
            timeout: printErr.config.timeout,
          });
        }

        const status = printErr?.response?.status;
        const ngrokCode = printErr?.response?.headers?.["ngrok-error-code"];
        const url = printErr?.config?.url;

        posErrorMessage =
          ngrokCode === "ERR_NGROK_3200" || status === 404
            ? `AFIP aprobó y se facturó, pero el POS está desconectado. Endpoint: ${
                url ?? "desconocido"
              }`
            : `AFIP aprobó y se facturó, pero falló la impresión en el POS. ${
                printErr?.message ?? ""
              }`;

        console.warn(`⚠️ [${requestId}]`, posErrorMessage);
      }

      console.log(`📝 [${requestId}] Actualizando venta como INVOICED...`, {
        saleId,
        posDisconnected,
        posErrorMessage,
      });

      await prisma.sale.update({
        where: { id: saleId },
        data: {
          invoiceStatus: "INVOICED",
          afipLastError: posDisconnected ? "POS_DISCONNECTED" : null,
          nextRetryAt: null,
          retryCount: 0,
        },
      });

      console.log(`✅ [${requestId}] Venta actualizada como INVOICED`);

      const responsePayload = {
        ok: true,
        invoiceStatus: "INVOICED",
        factura: safeFactura,
        ...(posDisconnected
          ? {
              warning: "AFIP aprobó y se facturó, pero el POS está desconectado.",
              posError: posErrorMessage,
            }
          : {}),
      };

      console.log(`🟩 [${requestId}] Respondiendo 200:`, responsePayload);
      console.log(`🟩 [${requestId}] FIN OK en ${Date.now() - startedAt}ms`);
      console.log("============================================================");

      return res.status(200).json(responsePayload);
    }

    console.warn(`🟥 [${requestId}] AFIP rechazó o no aprobó la factura:`, safeFactura);

    console.log(`📝 [${requestId}] Actualizando venta como ERROR / AFIP_REJECTED...`);

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        invoiceStatus: "ERROR",
        afipLastError: "AFIP_REJECTED",
      },
    });

    console.log(`🟥 [${requestId}] Respondiendo 409 AFIP_REJECTED`);
    console.log(`🟥 [${requestId}] FIN REJECTED en ${Date.now() - startedAt}ms`);
    console.log("============================================================");

    return res.status(409).json({
      ok: false,
      invoiceStatus: "REJECTED",
      message: "AFIP rechazó la factura.",
      factura: safeFactura,
    });
  } catch (err: any) {
    console.error(`❌ [${requestId}] ERROR GENERAL EN /afip/facturar`);
    console.error(`📛 [${requestId}] Message:`, err?.message);
    console.error(`📛 [${requestId}] Name:`, err?.name);
    console.error(`📛 [${requestId}] Code:`, err?.code);
    console.error(`📛 [${requestId}] Stack:`, err?.stack);

    if (err?.response) {
      console.error(`🌐 [${requestId}] Error response status:`, err.response.status);
      console.error(`🌐 [${requestId}] Error response data:`, err.response.data);
      console.error(`🌐 [${requestId}] Error response headers:`, err.response.headers);
    }

    if (err?.config) {
      console.error(`🌐 [${requestId}] Error axios config:`, {
        method: err.config.method,
        url: err.config.url,
        baseURL: err.config.baseURL,
        timeout: err.config.timeout,
      });
    }

    if (err?.cause) {
      console.error(`🧨 [${requestId}] Cause:`, err.cause);
    }

    console.error(`🧾 [${requestId}] Body que causó error:`, JSON.stringify(req.body, null, 2));
    console.error(`🧾 [${requestId}] saleId:`, saleId);

    if (isAfipUnavailable(err)) {
      console.warn(`🟨 [${requestId}] Detectado AFIP_UNAVAILABLE. Marcando venta como PENDING_AFIP...`);

      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);

      try {
        await prisma.sale.update({
          where: { id: saleId },
          data: {
            invoiceStatus: "PENDING_AFIP",
            afipLastError: "AFIP_UNAVAILABLE",
            nextRetryAt,
            retryCount: { increment: 1 },
            afipPayloadJson: req.body,
          },
        });

        console.log(`✅ [${requestId}] Venta marcada como PENDING_AFIP`, {
          saleId,
          nextRetryAt,
        });
      } catch (updateErr: any) {
        console.error(`❌ [${requestId}] No se pudo marcar PENDING_AFIP`);
        console.error(`📛 [${requestId}] updateErr message:`, updateErr?.message);
        console.error(`📛 [${requestId}] updateErr stack:`, updateErr?.stack);
      }

      console.log(`🟨 [${requestId}] Respondiendo 202 PENDING_AFIP`);
      console.log(`🟨 [${requestId}] FIN PENDING_AFIP en ${Date.now() - startedAt}ms`);
      console.log("============================================================");

      return res.status(202).json({
        ok: true,
        invoiceStatus: "PENDING_AFIP",
        nextRetryAt: nextRetryAt.toISOString(),
      });
    }

    const responsePayload = {
      ok: false,
      error: err?.message || "Error interno al facturar",
      detail: err?.response?.data ?? null,
      code: err?.code ?? null,
    };

    console.error(`🟥 [${requestId}] Respondiendo 500:`, responsePayload);
    console.error(`🟥 [${requestId}] FIN ERROR en ${Date.now() - startedAt}ms`);
    console.error("============================================================");

    return res.status(500).json(responsePayload);
  }
});

router.post("/nota-credito", async (req, res) => {
  try {
    const {
      saleId,
      facturaOriginalId,
      motivo = "Devolución de productos",
      importe,
    } = req.body;

    const userId = (req as any).user?.id || "unknown";

    const facturaOriginal = await prisma.invoiceAfip.findUnique({
      where: { id: facturaOriginalId },
      include: {
        sale: {
          include: {
            items: { include: { product: true } },
            client: true,
          },
        },
      },
    });

    if (!facturaOriginal) {
      return res.status(404).json({
        ok: false,
        error: "Factura original no encontrada",
      });
    }

    const notaCredito = await emitirNotaCreditoAFIP({
      saleId,
      facturaOriginalId,
      motivo,
      importe,
    });

    const safeNotaCredito = JSON.parse(
      JSON.stringify(notaCredito, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
      )
    );

    let posDisconnected = false;
    let posErrorMessage: string | null = null;

    try {
      await generarNotaCreditoAfipPDF({
        saleId,
        tipoComprobante: notaCredito.tipoComprobante,
        puntoVenta: notaCredito.puntoVenta,
        numero: notaCredito.numero,
        fechaEmision: notaCredito.fechaEmision,
        nombreCliente: facturaOriginal.sale?.client
          ? `${facturaOriginal.sale.client.nombre} ${facturaOriginal.sale.client.apellido}`
          : "A CONSUMIDOR FINAL ***********",
        domicilioCliente: "",
        total: notaCredito.total,
        metodoPago: facturaOriginal.sale?.paymentMethod || "EFECTIVO",
        cae: notaCredito.cae || "—",
        caeVto: notaCredito.caeVto || new Date(),
        cuit: notaCredito.cuit,
        qrBase64: notaCredito.qrBase64 || null,
        products: facturaOriginal.sale?.items.map((i: any) => ({
          name: i.product.name,
          quantity: i.quantity,
          quantityKg: i.quantityKg ?? undefined,
          price: i.price,
          subtotal: i.subtotal,
        })),
      });
    } catch (printErr: any) {
      posDisconnected = true;

      const status = printErr?.response?.status;
      const ngrokCode = printErr?.response?.headers?.["ngrok-error-code"];
      const url = printErr?.config?.url;

      posErrorMessage =
        ngrokCode === "ERR_NGROK_3200" || status === 404
          ? `AFIP aprobó y se generó la nota de crédito, pero el POS está desconectado. Endpoint: ${
              url ?? "desconocido"
            }`
          : `AFIP aprobó y se generó la nota de crédito, pero falló la impresión en el POS. ${
              printErr?.message ?? ""
            }`;

      console.warn("⚠️", posErrorMessage);
    }

    if (!facturaOriginal.sale) {
      return res.status(404).json({
        ok: false,
        error: "La factura original no tiene una venta asociada",
      });
    }

    await financeService.registerCreditNote(
      facturaOriginal.sale.businessId,
      importe,
      `Nota de crédito: ${motivo}`,
      userId
    );

    return res.status(200).json({
      ok: true,
      message: posDisconnected
        ? "Nota de crédito generada en AFIP y registrada en finanzas, pero el POS está desconectado."
        : "Nota de crédito generada en AFIP, impresa y registrada en finanzas.",
      notaCredito: safeNotaCredito,
      ...(posDisconnected
        ? {
            warning: "AFIP aprobó, pero no se pudo imprimir la nota de crédito.",
            posError: posErrorMessage,
          }
        : {}),
    });
  } catch (err: any) {
    console.error("❌ Error en /afip/nota-credito:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/pending-afip", async (_req, res) => {
  try {
    const pendingSales = await prisma.sale.findMany({
      where: {
        invoiceStatus: "PENDING_AFIP",
        isInvoiced: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
      },
    });

    const count = pendingSales.length;

    return res.status(200).json({
      ok: true,
      hasPendingAfip: count > 0,
      count,
      message:
        count > 0
          ? `Hay ${count} venta${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"} de facturar en AFIP.`
          : "No hay ventas pendientes de AFIP.",
      sales: pendingSales.map((sale: any) => ({
        id: sale.id,
        total: sale.total,
        subtotal: sale.subtotal,
        discount: sale.discount,
        status: sale.status,
        isInvoiced: sale.isInvoiced,
        invoiceStatus: sale.invoiceStatus,
        afipLastError: sale.afipLastError,
        nextRetryAt: sale.nextRetryAt,
        retryCount: sale.retryCount,
        createdAt: sale.createdAt,
        client: sale.client
          ? {
              id: sale.client.id,
              nombre: sale.client.nombre,
              apellido: sale.client.apellido,
              dni: sale.client.dni,
              telefono: sale.client.telefono,
              gmail: sale.client.gmail,
              category: sale.client.category,
            }
          : null,
        items: sale.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product?.name ?? "Producto",
          sku: item.product?.sku ?? null,
          quantity: item.quantity,
          quantityKg: item.quantityKg,
          price: item.price,
          subtotal: item.subtotal,
        })),
        payments: sale.payments.map((payment: any) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
        })),
      })),
    });
  } catch (err: any) {
    console.error("❌ Error en GET /afip/pending-afip:", err);

    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Error al buscar ventas pendientes de AFIP",
    });
  }
});

router.get("/factura-by-sale/:saleId", async (req, res) => {
  try {
    const { saleId } = req.params;

    const factura = await prisma.invoiceAfip.findUnique({
      where: { saleId },
    });

    if (!factura) {
      return res.status(404).json({ ok: false, error: "Factura no encontrada" });
    }

    const safeFactura = JSON.parse(
      JSON.stringify(factura, (_, v) => (typeof v === "bigint" ? v.toString() : v))
    );

    res.status(200).json(safeFactura);
  } catch (err: any) {
    console.error("❌ Error en /factura-by-sale:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;