import { Request, Response, NextFunction } from "express";
import { saleService } from "../services/sale.service";
import {
  DeliveryMethod,
  DeliveryStatus,
  PaymentMethod,
  SaleStatus,
} from "@prisma/client";
import { getParamAsString } from "../utils/params";

const toNumber = (v: any) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

const toIntOrNull = (v: any) => {
  const n = toNumber(v);
  if (n === undefined) return undefined;
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
};

function isDeliveryMethod(value: any): value is DeliveryMethod {
  return Object.values(DeliveryMethod).includes(value);
}

function isDeliveryStatus(value: any): value is DeliveryStatus {
  return Object.values(DeliveryStatus).includes(value);
}

function normalizeSaleBody(body: any) {
  const items = Array.isArray(body.items)
    ? body.items.map((item: any) => ({
        productId: item.productId,
        quantity: toNumber(item.quantity) ?? 0,
        quantityKg: toNumber(item.quantityKg),
        price: toNumber(item.price),
        priceType: item.priceType,
        boxContents: Array.isArray(item.boxContents)
          ? item.boxContents.map((box: any) => ({
              productId: box.productId,
              quantity: toNumber(box.quantity),
              quantityKg: toNumber(box.quantityKg),
            }))
          : undefined,
      }))
    : [];

  const stockLocation = body.stockLocation ?? body.stockSource ?? "LOCAL";

  if (!["LOCAL", "DEPOSITO"].includes(stockLocation)) {
    return {
      error: {
        status: 400,
        body: {
          message: "Depósito/origen de stock inválido. Usá LOCAL o DEPOSITO",
        },
      },
    };
  }

  const deliveryMethod = body.deliveryMethod ?? "PICKUP";

  if (!isDeliveryMethod(deliveryMethod)) {
    return {
      error: {
        status: 400,
        body: {
          message:
            "Método de entrega inválido. Usá PICKUP, LOCAL_DELIVERY o TRANSPORT",
        },
      },
    };
  }

  const deliveryStatus = body.deliveryStatus ?? "NONE";

  if (!isDeliveryStatus(deliveryStatus)) {
    return {
      error: {
        status: 400,
        body: {
          message:
            "Estado de entrega inválido. Usá NONE, PENDING, PREPARING, IN_TRANSIT, DELIVERED o CANCELLED",
        },
      },
    };
  }

  return {
    payload: {
      ...body,
      isWebSale: false,
      stockLocation,
      quotationHours: toNumber(body.quotationHours),
      discountValue: toNumber(body.discountValue),
      businessLocationId: body.businessLocationId ?? null,
      deliveryMethod,
      deliveryStatus,
      deliveryAddressSnapshot: body.deliveryAddressSnapshot ?? null,
      deliveryDistanceKm: toNumber(body.deliveryDistanceKm),
      deliveryPricePerKm: toNumber(body.deliveryPricePerKm),
      deliveryCost: toNumber(body.deliveryCost) ?? 0,
      transportName: body.transportName ?? null,
      transportCuit: body.transportCuit ?? null,
      packagesCount: toIntOrNull(body.packagesCount),
      declaredValue: toNumber(body.declaredValue),
      items,
      payments: Array.isArray(body.payments)
        ? body.payments.map((payment: any) => ({
            method: payment.method as PaymentMethod,
            amount: Number(payment.amount),
            reference: payment.reference,
            notes: payment.notes,
          }))
        : undefined,
    },
  };
}

function safeJson(data: any) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

function getAuthUserId(req: Request) {
  const r = req as any;

  return (
    r.user?.id ??
    r.user?.userId ??
    r.auth?.id ??
    r.auth?.userId ??
    r.usuario?.id ??
    r.usuario?.userId ??
    r.userId ??
    r.idUsuario ??
    null
  );
}

export const saleController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const sales = await saleService.getAll({ businessId: req.business!.id });
      res.json(safeJson(sales));
    } catch (err) {
      next(err);
    }
  },

  async getPending(req: Request, res: Response, next: NextFunction) {
    try {
      const sales = await saleService.getPending(req.business!.id);
      res.json(safeJson(sales));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await saleService.getById(
        getParamAsString(req.params.id, "id"),
        req.business!.id
      );

      if (!sale) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }

      res.json(safeJson(sale));
    } catch (err) {
      next(err);
    }
  },

  async generarCotizacion(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await saleService.generarCotizacion(
        getParamAsString(req.params.id, "id"),
        req.business!.id
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      res.setHeader("Content-Length", result.buffer.length);

      return res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },

  async generarComprobante(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await saleService.generarComprobanteVenta(
        getParamAsString(req.params.id, "id"),
        req.business!.id
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`
      );
      res.setHeader("Content-Length", result.buffer.length);

      return res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const normalized = normalizeSaleBody(req.body);

      if (normalized.error) {
        return res.status(normalized.error.status).json(normalized.error.body);
      }

      const userId = getAuthUserId(req);

      if (!userId) {
        return res.status(401).json({
          message: "No se pudo identificar el usuario autenticado para registrar la venta",
        });
      }

      const newSale = await saleService.create({
        ...(normalized.payload as any),
        userId,
        businessId: req.business!.id,
      });

      res.status(201).json(safeJson(newSale));
    } catch (err) {
      next(err);
    }
  },

  async updateItems(req: Request, res: Response, next: NextFunction) {
    try {
      const normalized = normalizeSaleBody(req.body);

      if (normalized.error) {
        return res.status(normalized.error.status).json(normalized.error.body);
      }

      const updated = await saleService.updateItems(
        getParamAsString(req.params.id, "id"),
        {
          ...(normalized.payload as any),
          userId: getAuthUserId(req) ?? undefined,
        },
        req.business!.id
      );

      res.json(safeJson(updated));
    } catch (err) {
      next(err);
    }
  },

  async bulkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const { action } = req.body;

      if (!["COMPLETE", "CANCEL"].includes(action)) {
        return res.status(400).json({ message: "Acción inválida. Usá COMPLETE o CANCEL" });
      }

      const mapped = action === "COMPLETE" ? "COMPLETED" : "CANCELLED";
      const updated = await saleService.bulkUpdatePending(mapped, req.business!.id);

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body as { status: SaleStatus };

      if (!status || !Object.values(SaleStatus).includes(status)) {
        return res.status(400).json({ message: "Estado de venta inválido" });
      }

      const updated = await saleService.updateStatus(
        getParamAsString(req.params.id, "id"),
        status,
        req.business!.id
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentMethod } = req.body as { paymentMethod: PaymentMethod };

      if (!paymentMethod) {
        return res.status(400).json({ message: "paymentMethod es requerido" });
      }

      const updated = await saleService.updatePaymentMethod(
        getParamAsString(req.params.id, "id"),
        paymentMethod,
        req.business!.id
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async updatePayments(req: Request, res: Response, next: NextFunction) {
    try {
      const { payments, setAsPrimary } = req.body as {
        payments: {
          method: PaymentMethod;
          amount: number;
          reference?: string;
          notes?: string;
        }[];
        setAsPrimary?: boolean;
      };

      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({
          message: "payments debe ser un array con al menos 1 pago",
        });
      }

      const normalizedPayments = payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        notes: payment.notes,
      }));

      const updated = await saleService.updatePayments(
        getParamAsString(req.params.id, "id"),
        normalizedPayments,
        !!setAsPrimary,
        req.business!.id
      );

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },

  async generarNotaPedido(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await saleService.generarNotaPedido(
        getParamAsString(req.params.id, "id"),
        req.business!.id
      );

      res.json({
        ok: true,
        message: "Nota de pedido generada e impresa",
        result,
      });
    } catch (err) {
      next(err);
    }
  },
};
