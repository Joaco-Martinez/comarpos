import prisma from "../prisma";
import {
  CategoryFinance,
  FinanceType,
  PaymentMethod,
  SupplierAccountMovementType,
} from "@prisma/client";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function assertPositiveAmount(amount: number) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("El monto debe ser mayor a 0");
  }

  return round2(value);
}

export const supplierAccountService = {
  async getBalance(businessId: string, supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
      select: { id: true, name: true },
    });

    if (!supplier) throw new Error("Proveedor no encontrado");

    const lastMovement = await prisma.supplierAccountMovement.findFirst({
      where: { businessId, supplierId },
      orderBy: { date: "desc" },
      select: { newBalance: true },
    });

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      balance: lastMovement?.newBalance ?? 0,
    };
  },

  async getMovements(businessId: string, supplierId: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    });

    if (!supplier) throw new Error("Proveedor no encontrado");

    return prisma.supplierAccountMovement.findMany({
      where: { businessId, supplierId },
      orderBy: { date: "desc" },
      include: {
        purchase: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  },

  async registerDebt(
    businessId: string,
    supplierId: string,
    amount: number,
    purchaseId?: string | null,
    description?: string | null
  ) {
    const amountValue = assertPositiveAmount(amount);

    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, businessId },
        select: { id: true, name: true },
      });

      if (!supplier) throw new Error("Proveedor no encontrado");

      const lastMovement = await tx.supplierAccountMovement.findFirst({
        where: { businessId, supplierId },
        orderBy: { date: "desc" },
        select: { newBalance: true },
      });

      const previousBalance = round2(lastMovement?.newBalance ?? 0);
      const newBalance = round2(previousBalance + amountValue);

      return tx.supplierAccountMovement.create({
        data: {
          businessId,
          supplierId,
          purchaseId: purchaseId ?? null,
          type: SupplierAccountMovementType.DEBT,
          amount: amountValue,
          previousBalance,
          newBalance,
          paymentMethod: null,
          description: description ?? "Deuda generada por compra",
        },
        include: {
          supplier: true,
          purchase: true,
        },
      });
    });
  },

  async registerPayment(
    businessId: string,
    supplierId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    reference?: string | null,
    description?: string | null,
    userId?: string | null
  ) {
    const amountValue = assertPositiveAmount(amount);

    if (paymentMethod === PaymentMethod.CUENTA_CORRIENTE) {
      throw new Error("Un pago no puede registrarse con CUENTA_CORRIENTE");
    }

    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, businessId },
        select: { id: true, name: true },
      });

      if (!supplier) throw new Error("Proveedor no encontrado");

      const lastMovement = await tx.supplierAccountMovement.findFirst({
        where: { businessId, supplierId },
        orderBy: { date: "desc" },
        select: { newBalance: true },
      });

      const previousBalance = round2(lastMovement?.newBalance ?? 0);
      const newBalance = round2(Math.max(previousBalance - amountValue, 0));

      const movement = await tx.supplierAccountMovement.create({
        data: {
          businessId,
          supplierId,
          userId: userId ?? null,
          purchaseId: null,
          type: SupplierAccountMovementType.PAYMENT,
          amount: amountValue,
          previousBalance,
          newBalance,
          paymentMethod,
          reference: reference ?? null,
          description: description ?? `Pago a proveedor ${supplier.name}`,
        },
        include: {
          supplier: true,
        },
      });

      await tx.finance.create({
        data: {
          businessId,
          type: FinanceType.EGRESO,
          amount: amountValue,
          category: CategoryFinance.CompraMercaderia,
          paymentMethod,
          description: description ?? `Pago cuenta corriente proveedor ${supplier.name}`,
          date: new Date(),
        },
      });

      return movement;
    });
  },

  async createAdjustment(
    businessId: string,
    data: {
      supplierId: string;
      type: "POSITIVE" | "NEGATIVE";
      amount: number;
      userId?: string | null;
      reference?: string | null;
      description?: string | null;
    }
  ) {
    const amountValue = assertPositiveAmount(data.amount);

    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: data.supplierId, businessId },
        select: { id: true, name: true },
      });

      if (!supplier) throw new Error("Proveedor no encontrado");

      const lastMovement = await tx.supplierAccountMovement.findFirst({
        where: { businessId, supplierId: data.supplierId },
        orderBy: { date: "desc" },
        select: { newBalance: true },
      });

      const previousBalance = round2(lastMovement?.newBalance ?? 0);

      const isPositive = data.type === "POSITIVE";
      const newBalance = isPositive
        ? round2(previousBalance + amountValue)
        : round2(Math.max(previousBalance - amountValue, 0));

      return tx.supplierAccountMovement.create({
        data: {
          businessId,
          supplierId: data.supplierId,
          userId: data.userId ?? null,
          purchaseId: null,
          type: isPositive
            ? SupplierAccountMovementType.ADJUSTMENT_POSITIVE
            : SupplierAccountMovementType.ADJUSTMENT_NEGATIVE,
          amount: amountValue,
          previousBalance,
          newBalance,
          paymentMethod: null,
          reference: data.reference ?? null,
          description:
            data.description ??
            (isPositive
              ? "Ajuste positivo de cuenta corriente de proveedor"
              : "Ajuste negativo de cuenta corriente de proveedor"),
        },
        include: {
          supplier: true,
        },
      });
    });
  },
};
