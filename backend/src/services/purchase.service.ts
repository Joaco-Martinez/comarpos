import prisma from "../prisma";
import {
  CategoryFinance,
  FinanceType,
  Location,
  MovementType,
  PaymentMethod,
  ProductType,
  PurchaseStatus,
  SaleUnit,
} from "@prisma/client";
import alertService from "./alert.service";
import { parseDateInputAR } from "../utils/dateAR";
import { supplierAccountService } from "./supplierAccount.service";

type PurchaseItemInput = {
  productId: string;
  quantity?: number | string;
  quantityKg?: number | string;
  unitCost?: number | string;
};

type CreatePurchaseInput = {
  supplierId?: string;
  invoiceNumber?: string;
  description?: string;
  paymentMethod?: PaymentMethod;
  to?: Location;
  date?: string | Date;
  items: PurchaseItemInput[];
};

type UpdatePurchaseSupplierInput = {
  supplierId?: string | null;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function validateLocation(value: unknown): Location {
  if (value === Location.LOCAL || value === Location.DEPOSITO) return value;
  return Location.DEPOSITO;
}

function validatePaymentMethod(value: unknown): PaymentMethod | undefined {
  if (!value) return undefined;
  if (Object.values(PaymentMethod).includes(value as PaymentMethod)) return value as PaymentMethod;
  throw new Error("Método de pago inválido");
}

function parseDate(value: unknown): Date {
  if (!value) return new Date();
  const parsed = parseDateInputAR(value as Date | string);
  if (!parsed) throw new Error("Fecha inválida");
  return parsed;
}

export const purchaseService = {
  async getAll(businessId: string) {
    return prisma.purchase.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true, cuit: true } },
        finance: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, saleUnit: true } },
          },
        },
      },
    });
  },

  async getById(id: string, businessId: string) {
    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true, cuit: true } },
        finance: true,
        items: { include: { product: true } },
        stockMovements: {
          include: {
            product: { select: { id: true, name: true, sku: true, saleUnit: true } },
          },
        },
      },
    });

    if (!purchase) throw new Error("Compra no encontrada");
    return purchase;
  },

  async create(data: CreatePurchaseInput, businessId: string, userId?: string) {
    if (!businessId) throw new Error("Falta businessId para registrar la compra");
    if (!userId) throw new Error("Falta userId para registrar la compra");
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("La compra debe tener al menos un producto");
    }

    const to = validateLocation(data.to);
    const paymentMethod = validatePaymentMethod(data.paymentMethod);
    const date = parseDate(data.date);

    let supplierName: string | null = null;
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, businessId },
        select: { id: true, name: true },
      });
      if (!supplier) throw new Error("Proveedor no encontrado");
      supplierName = supplier.name;
    }

    const createdPurchase = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId: data.supplierId || null,
          invoiceNumber: data.invoiceNumber?.trim() || null,
          description: data.description?.trim() || null,
          paymentMethod,
          to,
          date,
          userId,
          status: PurchaseStatus.COMPLETED,
          totalAmount: 0,
        },
      });

      let totalAmount = 0;

      for (const item of data.items) {
        if (!item.productId) throw new Error("Cada item debe tener productId");

        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId },
        });
        if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
        if (!product.isActive) throw new Error(`El producto "${product.name}" está inactivo`);
        if ((product as any).isService) throw new Error(`"${product.name}" es un servicio, no puede ingresar stock`);
        if (product.type === ProductType.COMPUESTO) {
          throw new Error(`No se puede comprar stock directo de "${product.name}" porque es un producto compuesto`);
        }

        const rawUnitCost =
          item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== ""
            ? item.unitCost
            : (product as any).purchasePrice ?? 0;

        const unitCost = toNumber(rawUnitCost);
        if (!Number.isFinite(unitCost) || unitCost < 0) {
          throw new Error(`El costo unitario de "${product.name}" debe ser válido`);
        }

        let quantity: number | null = null;
        let quantityKg: number | null = null;
        let subtotal = 0;

        if (product.saleUnit === SaleUnit.UNIT) {
          const qty = toNumber(item.quantity);
          if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Cantidad inválida para "${product.name}"`);

          quantity = Math.trunc(qty);
          subtotal = roundMoney(quantity * unitCost);

          await tx.product.update({
            where: { id: product.id },
            data: {
              ...(to === Location.LOCAL
                ? { stockLocal: { increment: quantity } }
                : { stockDeposito: { increment: quantity } }),
              purchasePrice: unitCost,
            } as any,
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              userId,
              purchaseId: purchase.id,
              type: MovementType.INGRESS,
              from: null,
              to,
              quantity,
              reason: "Compra de mercadería",
              reference: `[purchase:${purchase.id}]`,
            } as any,
          });
        }

        if (product.saleUnit === SaleUnit.KG) {
          const qtyKg = toNumber(item.quantityKg);
          if (!Number.isFinite(qtyKg) || qtyKg <= 0) throw new Error(`Cantidad KG inválida para "${product.name}"`);

          quantityKg = qtyKg;
          subtotal = roundMoney(quantityKg * unitCost);

          await tx.product.update({
            where: { id: product.id },
            data: {
              ...(to === Location.LOCAL
                ? { stockLocalKg: { increment: quantityKg } }
                : { stockDepositoKg: { increment: quantityKg } }),
              purchasePrice: unitCost,
            } as any,
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              userId,
              purchaseId: purchase.id,
              type: MovementType.INGRESS,
              from: null,
              to,
              quantityKg,
              reason: "Compra de mercadería",
              reference: `[purchase:${purchase.id}]`,
            } as any,
          });
        }

        totalAmount += subtotal;

        await tx.purchaseItem.create({
          data: {
            businessId,
            purchaseId: purchase.id,
            productId: product.id,
            quantity,
            quantityKg,
            unitCost,
            subtotal,
            productNameSnapshot: product.name,
            productSkuSnapshot: product.sku,
          },
        });
      }

      const total = roundMoney(totalAmount);

      const finance = await tx.finance.create({
        data: {
          businessId,
          type: FinanceType.EGRESO,
          amount: total,
          category: CategoryFinance.CompraMercaderia,
          paymentMethod,
          description: `[purchase:${purchase.id}] Compra de mercadería${supplierName ? ` - ${supplierName}` : ""}`,
          date,
        },
      });

      return tx.purchase.update({
        where: { id: purchase.id },
        data: { totalAmount: total, financeId: finance.id },
        include: {
          supplier: { select: { id: true, name: true, cuit: true } },
          finance: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  saleUnit: true,
                  stockLocal: true,
                  stockDeposito: true,
                  stockLocalKg: true,
                  stockDepositoKg: true,
                  purchasePrice: true,
                },
              },
            },
          },
          stockMovements: true,
        },
      });
    });

    // Si la compra se realiza con CUENTA_CORRIENTE y tiene proveedor asociado,
    // se registra la deuda en la cuenta corriente del proveedor (mismo
    // criterio que sale.service.ts usa para clientes).
    if (createdPurchase.supplierId && paymentMethod === PaymentMethod.CUENTA_CORRIENTE) {
      await supplierAccountService.registerDebt(
        businessId,
        createdPurchase.supplierId,
        createdPurchase.totalAmount,
        createdPurchase.id,
        `Deuda generada por compra${supplierName ? ` - ${supplierName}` : ""}`
      );
    }

    for (const item of createdPurchase.items) {
      await alertService.checkProductStock(item.productId).catch(() => undefined);
    }

    return createdPurchase;
  },

  async updateSupplier(id: string, businessId: string, data: UpdatePurchaseSupplierInput) {
    const supplierId = data.supplierId || null;

    let supplierName: string | null = null;
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, businessId },
        select: { id: true, name: true },
      });
      if (!supplier) throw new Error("Proveedor no encontrado");
      supplierName = supplier.name;
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        select: { id: true, financeId: true },
      });

      if (!purchase) throw new Error("Compra no encontrada");

      const updated = await tx.purchase.update({
        where: { id },
        data: { supplierId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          supplier: { select: { id: true, name: true, cuit: true } },
          finance: true,
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, saleUnit: true } },
            },
          },
        },
      });

      if (purchase.financeId) {
        await tx.finance.update({
          where: { id: purchase.financeId },
          data: {
            description: `[purchase:${purchase.id}] Compra de mercadería${supplierName ? ` - ${supplierName}` : ""}`,
          },
        });
      }

      return updated;
    });

    return updatedPurchase;
  },

  async cancel(id: string, businessId: string, userId?: string) {
    if (!userId) throw new Error("Falta userId para cancelar la compra");

    const cancelled = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id, businessId },
        include: { items: { include: { product: true } }, finance: true },
      });

      if (!purchase) throw new Error("Compra no encontrada");
      if (purchase.status === PurchaseStatus.CANCELLED) throw new Error("La compra ya está cancelada");

      for (const item of purchase.items) {
        const product = item.product;

        if (product.saleUnit === SaleUnit.UNIT) {
          const qty = Number(item.quantity || 0);

          if (purchase.to === Location.LOCAL && product.stockLocal < qty) {
            throw new Error(`No hay stock local suficiente para revertir "${product.name}"`);
          }
          if (purchase.to === Location.DEPOSITO && product.stockDeposito < qty) {
            throw new Error(`No hay stock en depósito suficiente para revertir "${product.name}"`);
          }

          await tx.product.update({
            where: { id: product.id },
            data:
              purchase.to === Location.LOCAL
                ? { stockLocal: { decrement: qty } }
                : { stockDeposito: { decrement: qty } },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              userId,
              purchaseId: purchase.id,
              type: MovementType.ADJUSTMENT,
              from: purchase.to,
              to: null,
              quantity: qty,
              reason: "Cancelación de compra de mercadería",
              reference: `[purchase-cancel:${purchase.id}]`,
            } as any,
          });
        }

        if (product.saleUnit === SaleUnit.KG) {
          const qtyKg = Number(item.quantityKg || 0);

          if (purchase.to === Location.LOCAL && product.stockLocalKg < qtyKg) {
            throw new Error(`No hay stock local KG suficiente para revertir "${product.name}"`);
          }
          if (purchase.to === Location.DEPOSITO && product.stockDepositoKg < qtyKg) {
            throw new Error(`No hay stock en depósito KG suficiente para revertir "${product.name}"`);
          }

          await tx.product.update({
            where: { id: product.id },
            data:
              purchase.to === Location.LOCAL
                ? { stockLocalKg: { decrement: qtyKg } }
                : { stockDepositoKg: { decrement: qtyKg } },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              userId,
              purchaseId: purchase.id,
              type: MovementType.ADJUSTMENT,
              from: purchase.to,
              to: null,
              quantityKg: qtyKg,
              reason: "Cancelación de compra de mercadería",
              reference: `[purchase-cancel:${purchase.id}]`,
            } as any,
          });
        }
      }

      await tx.finance.create({
        data: {
          businessId,
          type: FinanceType.INGRESO,
          amount: purchase.totalAmount,
          category: CategoryFinance.CompraMercaderia,
          paymentMethod: purchase.paymentMethod,
          description: `[purchase-cancel:${purchase.id}] Reversión de compra de mercadería`,
          date: new Date(),
        },
      });

      return tx.purchase.update({
        where: { id: purchase.id },
        data: { status: PurchaseStatus.CANCELLED },
        include: { finance: true, items: { include: { product: true } }, stockMovements: true },
      });
    });

    for (const item of cancelled.items) {
      await alertService.checkProductStock(item.productId).catch(() => undefined);
    }

    return cancelled;
  },
};
