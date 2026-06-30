import "../config/timezone";
import prisma from "../prisma";
import { emitirFacturaAFIP } from "../afip/wsfe.service";
import { generarFacturaAfipPDF } from "../afip/utils/generarFacturaAfipPDF";

function isAfipUnavailable(err: any) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  const htmlUnavailable =
    typeof data === "string" && data.toLowerCase().includes("service unavailable");

  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    htmlUnavailable ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ECONNRESET" ||
    err?.code === "ECONNABORTED"
  );
}

function calcNextRetry(retryCount: number) {
  // Backoff: 5m, 10m, 15m, 20m, ... máx 60m
  const minutes = Math.min(60, 5 * Math.max(1, retryCount));
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function processAfipPendingInvoices() {
  const now = new Date();

  const pendingSales = await prisma.sale.findMany({
    where: {
      invoiceStatus: "PENDING_AFIP",
      nextRetryAt: { lte: now },
    },
    take: 5, // no mates al server
    orderBy: { nextRetryAt: "asc" },
  });

  if (pendingSales.length === 0) return;

  for (const sale of pendingSales) {
    // 🔒 “lock” básico para que no lo agarre 2 veces en el mismo proceso
    const locked = await prisma.sale.updateMany({
      where: {
        id: sale.id,
        invoiceStatus: "PENDING_AFIP",
        nextRetryAt: { lte: now },
      },
      data: {
        nextRetryAt: new Date(Date.now() + 2 * 60 * 1000), // lo pateamos 2 min mientras procesamos
      },
    });

    if (locked.count === 0) continue;

    try {
      const payload: any = sale.afipPayloadJson;
      if (!payload?.saleId) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            invoiceStatus: "ERROR",
            afipLastError: "NO_AFIP_PAYLOAD",
          },
        });
        continue;
      }

      const { saleId, products, metodoPago, ...facturaData } = payload;

      const factura = await emitirFacturaAFIP({
        ...facturaData,
        saleId,
      });

      // Si aprobó => PDF + estado OK
      if (factura.resultado === "A" && factura.cae) {
        await generarFacturaAfipPDF({
          tipoComprobante: factura.tipoComprobante,
          puntoVenta: factura.puntoVenta,
          saleId,
          numero: factura.numero,
          fechaEmision: new Date(factura.fechaEmision),
          total: factura.total,
          products: products ?? [],
          metodoPago: metodoPago ?? "EFECTIVO",
          cae: factura.cae,
          caeVto: factura.caeVto ? new Date(factura.caeVto) : new Date(),
          cuit: factura.cuit,
          qrBase64: factura.qrBase64 ?? null,
        });

        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            invoiceStatus: "INVOICED",
            afipLastError: null,
            nextRetryAt: null,
            retryCount: 0,
          },
        });

        console.log("✅ AFIP retry OK:", sale.id);
        continue;
      }

      // AFIP respondió pero rechazó
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          invoiceStatus: "ERROR",
          afipLastError: "AFIP_REJECTED_ON_RETRY",
        },
      });

      console.warn("⚠️ AFIP rechazó en retry:", sale.id);
    } catch (err: any) {
      const retryCount = (sale.retryCount ?? 0) + 1;

      // Si sigue caído => reprogramar
      if (isAfipUnavailable(err)) {
        const next = calcNextRetry(retryCount);

        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            invoiceStatus: "PENDING_AFIP",
            afipLastError: "AFIP_UNAVAILABLE",
            retryCount,
            nextRetryAt: next,
          },
        });

        console.log("⏳ AFIP sigue caído, reintento programado:", sale.id, next.toISOString());
        continue;
      }

      // Error real (no caída de AFIP)
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          invoiceStatus: "ERROR",
          afipLastError: err?.message ?? "UNKNOWN_ERROR",
          retryCount,
          nextRetryAt: null,
        },
      });

      console.error("❌ Error en retry AFIP:", sale.id, err?.message);
    }
  }
}
