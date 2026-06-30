import prisma from "../prisma";
import { CategoryFinance, FinanceType, Location, SaleStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { Response } from "express";
import {
  formatDateAR,
  startOfDayAR,
  endOfDayAR,
  monthRangeAR,
  yearRangeAR,
  weekRangeAR,
} from "../utils/dateAR";

function fmtKgAR(n: number) {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function pushQty(
  map: Map<string, { productId: string; product: any | null; qty: number }>,
  productId: string,
  qty: number,
  product?: any | null,
) {
  if (!productId || !qty) return;

  const curr = map.get(productId);

  if (curr) {
    curr.qty += qty;
    if (!curr.product && product) curr.product = product;
  } else {
    map.set(productId, {
      productId,
      product: product ?? null,
      qty,
    });
  }
}

type StockLocationScope = Location | "ALL";

type SalesLocationSummary = {
  label: string;
  salesCount: number;
  itemsCount: number;
  total: number;
  cost: number;
  grossProfit: number;
  margin: number;
};

const STOCK_LOCATION_LABELS: Record<Location, string> = {
  [Location.LOCAL]: "Mayorista",
  [Location.DEPOSITO]: "Minorista",
};

function round2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeStockLocationScope(value?: string | null): StockLocationScope {
  const raw = String(value ?? "ALL").toUpperCase();

  if (raw === Location.LOCAL) return Location.LOCAL;
  if (raw === Location.DEPOSITO) return Location.DEPOSITO;

  return "ALL";
}

function createLocationSummary(label: string): SalesLocationSummary {
  return {
    label,
    salesCount: 0,
    itemsCount: 0,
    total: 0,
    cost: 0,
    grossProfit: 0,
    margin: 0,
  };
}

function getItemQuantityForCost(item: {
  quantity?: number | null;
  quantityKg?: number | null;
}) {
  const quantityKg = Number(item.quantityKg || 0);

  if (quantityKg > 0) return quantityKg;

  const quantity = Number(item.quantity || 0);

  return quantity > 0 ? quantity : 1;
}

function getSaleItemCost(item: {
  quantity?: number | null;
  quantityKg?: number | null;
  purchasePriceSnapshot?: number | null;
}) {
  return Number(item.purchasePriceSnapshot || 0) * getItemQuantityForCost(item);
}

function finishSummary(summary: SalesLocationSummary): SalesLocationSummary {
  const total = round2(summary.total);
  const cost = round2(summary.cost);
  const grossProfit = round2(summary.grossProfit);

  return {
    ...summary,
    total,
    cost,
    grossProfit,
    margin: total > 0 ? round2((grossProfit / total) * 100) : 0,
  };
}

async function getProductsInRangeByStockLocation(
  businessId: string,
  from?: Date,
  to?: Date,
  limit = 5,
  order: "asc" | "desc" = "desc",
  stockLocation?: string | null,
) {
  const scope = normalizeStockLocationScope(stockLocation);

  const saleWhere: any = {
    businessId,
    status: SaleStatus.COMPLETED,
  };

  if (scope !== "ALL") {
    saleWhere.stockLocation = scope;
  }

  if (from || to) {
    saleWhere.createdAt = {};

    if (from) saleWhere.createdAt.gte = startOfDayAR(from);
    if (to) saleWhere.createdAt.lte = endOfDayAR(to);
  }

  const items = await prisma.saleItem.findMany({
    where: {
      sale: saleWhere,
    },
    include: {
      product: true,
    },
  });

  const map = new Map<
    string,
    {
      productId: string;
      product: any;
      qty: number;
      qtyKg: number;
      totalQty: number;
      revenue: number;
      grossProfit: number;
    }
  >();

  for (const item of items) {
    const quantity = Number(item.quantity || 0);
    const quantityKg = Number(item.quantityKg || 0);
    const totalQty = quantityKg > 0 ? quantityKg : quantity;
    const subtotal = Number(item.subtotal || 0);
    const profit = Number(item.profit || 0);

    if (!item.productId || totalQty <= 0) continue;

    const current = map.get(item.productId);

    if (current) {
      current.qty += quantity;
      current.qtyKg += quantityKg;
      current.totalQty += totalQty;
      current.revenue += subtotal;
      current.grossProfit += profit;
    } else {
      map.set(item.productId, {
        productId: item.productId,
        product: item.product,
        qty: quantity,
        qtyKg: quantityKg,
        totalQty,
        revenue: subtotal,
        grossProfit: profit,
      });
    }
  }

  return Array.from(map.values())
    .filter((row) => row.totalQty > 0)
    .sort((a, b) =>
      order === "desc" ? b.totalQty - a.totalQty : a.totalQty - b.totalQty,
    )
    .slice(0, limit)
    .map((row) => ({
      productId: row.productId,
      product: row.product,
      stockLocation: scope,
      totalSold: round2(row.totalQty),
      totalQuantity: round2(row.totalQty),
      totalQuantityKg: round2(row.qtyKg),
      totalRevenue: round2(row.revenue),
      grossProfit: round2(row.grossProfit),
      _sum: {
        quantity: round2(row.totalQty),
        quantityKg: round2(row.qtyKg),
        subtotal: round2(row.revenue),
        profit: round2(row.grossProfit),
      },
    }));
}

export const financeService = {
  // --- CRUD ---
  async getAll(businessId: string) {
    return prisma.finance.findMany({
      where: {
        businessId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async create(
    businessId: string,
    data: {
      type: FinanceType;
      amount: number;
      category: CategoryFinance;
      description?: string;
      date?: Date;
    }
  ) {
    return prisma.finance.create({
      data: {
        businessId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date ?? new Date(),
      },
    });
  },

  async registerIncomeFromSale(saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: {
        id: saleId,
      },
      include: {
        payments: true,
        items: {
          include: {
            product: true,
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!sale) throw new Error("Venta no encontrada");
    if (sale.status !== "COMPLETED") return null;

    const marker = `[sale:${sale.id}]`;
    const businessId = sale.businessId;

    const existing = await prisma.finance.findFirst({
      where: {
        businessId,
        type: "INGRESO",
        category: "VENTA",
        description: {
          contains: marker,
        },
      },
    });

    const paidAmount = sale.payments?.length
      ? sale.payments
          .filter((payment) => payment.method !== "CUENTA_CORRIENTE")
          .reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
      : sale.paymentMethod === "CUENTA_CORRIENTE"
        ? 0
        : Number(sale.total || 0);

    const amount = Number(paidAmount.toFixed(2));

    // Si ya existía un ingreso de esta venta, lo sincronizamos.
    // Esto evita que quede mal si después cambian los pagos.
    if (existing) {
      if (amount <= 0) {
        return prisma.finance.delete({
          where: {
            id: existing.id,
          },
        });
      }

      return prisma.finance.update({
        where: {
          id: existing.id,
        },
        data: {
          amount,
          paymentMethod: sale.payments?.length
            ? sale.payments[0].method
            : sale.paymentMethod,
          date: existing.date,
        },
      });
    }

    // Venta 100% cuenta corriente: no genera ingreso hasta que se cobre.
    if (amount <= 0) return null;

    const itemsDesc = sale.items.map((i) => {
      const saleUnit = (i.product as any)?.saleUnit;

      if (i.product) {
        if (saleUnit === "KG") {
          const kg = (i as any).quantityKg ?? 0;
          return `${i.product.name} x${fmtKgAR(kg)} kg`;
        }

        return `${i.product.name} x${i.quantity}`;
      }

      if (i.boxContents && i.boxContents.length > 0) {
        const boxItems = i.boxContents
          .map((b) => `${b.product.name} x${b.quantity ?? b.quantityKg ?? 0}`)
          .join(", ");

        return `Caja (${boxItems}) x${i.quantity}`;
      }

      return "Item desconocido";
    });

    const description = `${marker} Venta de ${itemsDesc.join(", ")}`;

    return prisma.finance.create({
      data: {
        businessId,
        type: "INGRESO",
        amount,
        category: "VENTA",
        description,
        date: new Date(),
        paymentMethod: sale.payments?.length
          ? sale.payments[0].method
          : sale.paymentMethod,
      },
    });
  },

  async registerCreditNote(
    businessId: string,
    amount: number,
    description: string,
    userId: string
  ) {
    return await prisma.finance.create({
      data: {
        businessId,
        description: description || "Nota de crédito",
        amount: -Math.abs(amount),
        type: "EGRESO",
        category: "Otro",
        date: new Date(),
      },
    });
  },

  // --- ESTADÍSTICAS ---
  async getIncomeByMonth(businessId: string, year: number, month: number) {
    const { start, end } = monthRangeAR(year, month);

    return prisma.finance.aggregate({
      where: {
        businessId,
        type: "INGRESO",
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });
  },

  async getIncomeByYear(businessId: string, year: number) {
    const { start, end } = yearRangeAR(year);

    return prisma.finance.aggregate({
      where: {
        businessId,
        type: "INGRESO",
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });
  },

  async getIncomeByWeek(businessId: string, year: number, month: number, day: number) {
    const { start, end } = weekRangeAR(year, month, day);

    return prisma.finance.aggregate({
      where: {
        businessId,
        type: "INGRESO",
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });
  },

  async getTopProducts(businessId: string, limit = 5) {
    const saleWhere: any = {
      status: "COMPLETED",
      businessId,
    };

    const direct = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        product: true,
      },
    });

    const boxItems = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
        boxContents: {
          some: {},
        },
      },
      select: {
        quantity: true,
        boxContents: {
          select: {
            productId: true,
            quantity: true,
            product: true,
          },
        },
      },
    });

    const usage = new Map<
      string,
      {
        productId: string;
        product: any | null;
        qty: number;
      }
    >();

    for (const it of direct) {
      const quantityKg = Number(it.quantityKg || 0);
      const quantity = quantityKg > 0 ? quantityKg : Number(it.quantity || 0);

      pushQty(usage, it.productId as string, quantity, it.product);
    }

    for (const it of boxItems) {
      for (const c of it.boxContents) {
        const componentQty = c.quantity ?? 0;

        if (componentQty > 0) {
          pushQty(usage, c.productId, it.quantity * componentQty, c.product);
        }
      }
    }

    return Array.from(usage.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit)
      .map((r) => ({
        productId: r.productId,
        _sum: {
          quantity: round2(r.qty),
        },
        product: r.product,
      }));
  },

  async getWorstProducts(businessId: string, limit = 5) {
    const grouped = await prisma.saleItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
      },
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          businessId,
        },
      },
      orderBy: {
        _sum: {
          quantity: "asc",
        },
      },
      take: limit,
    });

    const products = await prisma.product.findMany({
      where: {
        businessId,
        id: {
          in: grouped.map((g) => g.productId),
        },
      },
    });

    return grouped.map((g) => ({
      productId: g.productId,
      _sum: {
        quantity: g._sum.quantity ?? 0,
      },
      product: products.find((p) => p.id === g.productId) || null,
    }));
  },

  async getProductsRange(
    businessId: string,
    startDate: Date,
    endDate: Date,
    order: "asc" | "desc",
  ) {
    const grouped = await prisma.saleItem.groupBy({
      by: ["productId"],
      _sum: {
        quantity: true,
      },
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          businessId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      orderBy: {
        _sum: {
          quantity: order,
        },
      },
      take: 1,
    });

    if (!grouped.length) return [];

    const product = await prisma.product.findFirst({
      where: {
        id: grouped[0].productId,
        businessId,
      },
    });

    return [
      {
        productId: grouped[0].productId,
        _sum: {
          quantity: grouped[0]._sum.quantity ?? 0,
        },
        product,
      },
    ];
  },

  async getIncomeByCategory(businessId: string, from: Date, to: Date) {
    return prisma.finance.groupBy({
      by: ["category"],
      where: {
        businessId,
        type: "INGRESO",
        date: {
          gte: startOfDayAR(from),
          lte: endOfDayAR(to),
        },
      },
      _sum: {
        amount: true,
      },
    });
  },

  async getSalesByStockLocation(businessId: string, from?: Date, to?: Date) {
    const where: any = {
      businessId,
      status: {
        not: SaleStatus.CANCELLED,
      },
    };

    if (from || to) {
      where.createdAt = {};

      if (from) where.createdAt.gte = startOfDayAR(from);
      if (to) where.createdAt.lte = endOfDayAR(to);
    }

    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        total: true,
        grossProfit: true,
        stockLocation: true,
        items: {
          select: {
            quantity: true,
            quantityKg: true,
            purchasePriceSnapshot: true,
          },
        },
      },
    });

    const local = createLocationSummary(STOCK_LOCATION_LABELS[Location.LOCAL]);
    const deposito = createLocationSummary(
      STOCK_LOCATION_LABELS[Location.DEPOSITO],
    );
    const all = createLocationSummary("Todo");

    const addSaleToSummary = (
      summary: SalesLocationSummary,
      sale: (typeof sales)[number],
    ) => {
      const total = Number(sale.total || 0);

      const cost = sale.items.reduce((acc, item) => {
        return acc + getSaleItemCost(item);
      }, 0);

      const grossProfit =
        typeof sale.grossProfit === "number"
          ? Number(sale.grossProfit || 0)
          : total - cost;

      summary.salesCount += 1;
      summary.itemsCount += sale.items.length;
      summary.total += total;
      summary.cost += cost;
      summary.grossProfit += grossProfit;
    };

    for (const sale of sales) {
      addSaleToSummary(all, sale);

      if (sale.stockLocation === Location.DEPOSITO) {
        addSaleToSummary(deposito, sale);
      } else {
        addSaleToSummary(local, sale);
      }
    }

    return {
      all: finishSummary(all),
      [Location.LOCAL]: finishSummary(local),
      [Location.DEPOSITO]: finishSummary(deposito),
    };
  },

  async getTopProductsInRange(
    businessId: string,
    from?: Date,
    to?: Date,
    limit = 5,
    stockLocation?: string | null,
  ) {
    return getProductsInRangeByStockLocation(
      businessId,
      from,
      to,
      limit,
      "desc",
      stockLocation,
    );
  },

  async getWorstProductsInRange(
    businessId: string,
    from?: Date,
    to?: Date,
    limit = 5,
    stockLocation?: string | null,
  ) {
    return getProductsInRangeByStockLocation(
      businessId,
      from,
      to,
      limit,
      "asc",
      stockLocation,
    );
  },

  // --- EXPORTACIÓN EXCEL ---
  async exportFinanceReport(businessId: string, from: Date, to: Date) {
    const finances = await prisma.finance.findMany({
      where: {
        businessId,
        date: {
          gte: startOfDayAR(from),
          lte: endOfDayAR(to),
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte Finanzas");

    sheet.addRow(["Fecha", "Tipo", "Categoría", "Descripción", "Monto"]);

    finances.forEach((f) => {
      sheet.addRow([
        formatDateAR(f.date),
        f.type,
        f.category,
        f.description ?? "",
        f.amount,
      ]);
    });

    return await workbook.xlsx.writeBuffer();
  },

  // --- EXPORTACIÓN PDF ---
  async exportFinanceReportPDF(businessId: string, res: Response, from: Date, to: Date) {
    const finances = await prisma.finance.findMany({
      where: {
        businessId,
        date: {
          gte: startOfDayAR(from),
          lte: endOfDayAR(to),
        },
      },
    });

    const doc = new PDFDocument();

    res.setHeader("Content-Disposition", "attachment; filename=reporte.pdf");
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    doc.fontSize(18).text("Reporte Financiero", {
      align: "center",
    });

    doc.moveDown();

    finances.forEach((f) => {
      doc
        .fontSize(12)
        .text(
          `${formatDateAR(f.date)} - ${f.type} - ${f.category} - $${f.amount} - ${
            f.description ?? ""
          }`,
        );
    });

    doc.end();
  },

  async update(
    businessId: string,
    id: string,
    data: Partial<{
      type: FinanceType;
      amount: number;
      category: CategoryFinance;
      description?: string;
      date?: Date;
      paymentMethod?: string;
    }>,
  ) {
    const existing = await prisma.finance.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!existing) {
      const err: any = new Error("Registro financiero no encontrado");
      err.code = "P2025";
      throw err;
    }

    const cleanData: any = {};

    if (data.type !== undefined) cleanData.type = data.type;
    if (data.amount !== undefined) cleanData.amount = data.amount;
    if (data.category !== undefined) cleanData.category = data.category;
    if (data.description !== undefined) cleanData.description = data.description;
    if (data.date !== undefined) cleanData.date = data.date;
    if (data.paymentMethod !== undefined) {
      cleanData.paymentMethod = data.paymentMethod;
    }

    return prisma.finance.update({
      where: {
        id,
      },
      data: cleanData,
    });
  },

  async remove(businessId: string, id: string) {
    const existing = await prisma.finance.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!existing) {
      const err: any = new Error("Registro financiero no encontrado");
      err.code = "P2025";
      throw err;
    }

    return prisma.finance.delete({
      where: {
        id,
      },
    });
  },
};