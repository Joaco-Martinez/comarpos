import prisma from "../prisma";
import {
  AccountMovementType,
  CategoryClient,
  DeliveryMethod,
  DeliveryStatus,
  InvoiceStatus,
  Location,
  MovementType,
  SaleItemPriceType,
  PaymentMethod,
  ProductType,
  ReceiptType,
  SaleStatus,
  SaleUnit,
} from "@prisma/client";
import { financeService } from "./finance.service";
import { generateInvoicePDF } from "../utils/pdfGenerator";
import alertService from "./alert.service";
import { productStatsService } from "./productStats.service";
import { generarTicketPedidoPDF } from "../utils/generarReciboPDF";
import { generarCotizacionPDF } from "../utils/generarCotizacionPDF";
import { generarComprobanteVentaPDF } from "../utils/generarComprobanteVentaPDF";

type CreateSaleInput = {
  userId?: string;
  stockLocation?: Location;
  clientId?: string;
  businessId: string;

  businessLocationId?: string | null;

  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;

  gmailSend?: string;

  paymentMethod: PaymentMethod;

  quotationHours?: number;

  deliveryMethod?: DeliveryMethod;
  deliveryStatus?: DeliveryStatus;
  deliveryAddressSnapshot?: string | null;
  deliveryDistanceKm?: number | null;
  deliveryPricePerKm?: number | null;
  deliveryCost?: number | null;

  transportName?: string | null;
  transportCuit?: string | null;

  packagesCount?: number | null;
  declaredValue?: number | null;

  payments?: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];

  receiptType: ReceiptType;
  status?: SaleStatus;
  isWebSale?: boolean;

  items: {
    productId: string;
    quantity?: number;
    quantityKg?: number;
    price?: number;
    priceType?: string | SaleItemPriceType;
    boxContents?: {
      productId: string;
      quantity?: number;
      quantityKg?: number;
    }[];
  }[];
};

type ClientMini = {
  category: CategoryClient;
} | null;

type ResolvedSaleItem = {
  productId: string;
  productName: string;
  productSku: string | null;
  productType: ProductType;
  saleUnit: SaleUnit;
  isService: boolean;
  priceType: SaleItemPriceType;
  quantity: number;
  quantityKg: number | null;
  price: number;
  subtotal: number;
  purchasePriceSnapshot: number;
  ivaPorcentaje: number;
  costTotal: number;
  profit: number;

  components: {
    productId: string;
    quantity: number | null;
    quantityKg: number | null;
  }[];
};

type StockLocation = "LOCAL" | "DEPOSITO";

type StockLine = {
  productId: string;
  quantity: number;
  quantityKg: number;
  reason: string;
};

type GetSalesParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SaleStatus | string;
  businessId?: string;
};

const DELIVERY_SKU = "ENVIO-FLETE2";

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isDeliverySaleItem(item: ResolvedSaleItem) {
  return normalizeText(item.productSku) === DELIVERY_SKU;
}

function shouldDiscountStock(item: ResolvedSaleItem) {
  if (item.isService) return false;
  if (isDeliverySaleItem(item)) return false;

  return true;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeStockLocation(value?: Location | string): StockLocation {
  if (!value) return "LOCAL";

  if (value !== "LOCAL" && value !== "DEPOSITO") {
    throw new Error("Depósito/origen de stock inválido. Usá LOCAL o DEPOSITO");
  }

  return value;
}

function getStockFieldNames(location: StockLocation) {
  return location === "DEPOSITO"
    ? { unit: "stockDeposito", kg: "stockDepositoKg" }
    : { unit: "stockLocal", kg: "stockLocalKg" };
}

function getLocationLabel(location: StockLocation) {
  return location === "DEPOSITO" ? "depósito" : "local";
}

function resolveQty(product: any, item: any) {
  if (product.saleUnit === SaleUnit.KG) {
    const q = Number(item.quantityKg);

    if (!Number.isFinite(q) || q <= 0) {
      throw new Error(`Cantidad KG inválida para ${product.name}`);
    }

    return {
      quantity: 0,
      quantityKg: q,
      qtyUsedForTotal: q,
    };
  }

  const q = Number(item.quantity);

  if (!Number.isFinite(q) || q <= 0) {
    throw new Error(`Cantidad UNIT inválida para ${product.name}`);
  }

  return {
    quantity: q,
    quantityKg: null as number | null,
    qtyUsedForTotal: q,
  };
}

function normalizeSaleItemPriceType(
  value: any,
  product: any,
  client: ClientMini,
  hasManualPrice: boolean
): SaleItemPriceType {
  const raw = normalizeText(value);

  if (
    raw === "PRICE" ||
    raw === "RETAIL" ||
    raw === "RETAILPRICE" ||
    raw === "RETAIL_PRICE" ||
    raw === "MINORISTA" ||
    raw === "PUBLICO" ||
    raw === "PÚBLICO"
  ) {
    return SaleItemPriceType.PRICE;
  }

  if (
    raw === "WHOLESALE" ||
    raw === "WHOLESALEPRICE" ||
    raw === "WHOLESALE_PRICE" ||
    raw === "MAYORISTA"
  ) {
    return SaleItemPriceType.WHOLESALE_PRICE;
  }

  if (raw === "MANUAL" || raw === "CUSTOM" || raw === "CUSTOM_PRICE") {
    return SaleItemPriceType.MANUAL;
  }

  // El envío siempre usa precio manual porque viene calculado por distancia.
  if (normalizeText(product.sku) === DELIVERY_SKU && hasManualPrice) {
    return SaleItemPriceType.MANUAL;
  }

  // Compatibilidad con el comportamiento anterior:
  // si el frontend viejo no manda priceType, se usa la categoría del cliente.
  if (client?.category === CategoryClient.Mayorista) {
    return SaleItemPriceType.WHOLESALE_PRICE;
  }

  return SaleItemPriceType.PRICE;
}

function resolveUnitPrice(
  product: any,
  client: ClientMini,
  priceTypeInput: any,
  manualPriceInput?: number
) {
  const isKg = product.saleUnit === SaleUnit.KG;
  const hasManualPrice =
    manualPriceInput !== undefined &&
    manualPriceInput !== null &&
    Number.isFinite(Number(manualPriceInput));

  const priceType = normalizeSaleItemPriceType(
    priceTypeInput,
    product,
    client,
    hasManualPrice
  );

  const publicPrice = isKg ? product.pricePerKg : product.price;
  const wholesalePrice = isKg
    ? product.wholesalePricePerKg
    : product.wholesalePrice;

  const validate = (p: number, label: string) => {
    if (!Number.isFinite(p)) {
      throw new Error(
        `Falta precio ${label} (${isKg ? "KG" : "UNIT"}) en ${product.name}`
      );
    }

    if (p < 0) {
      throw new Error(`El precio ${label} no puede ser negativo en ${product.name}`);
    }

    return round2(p);
  };

  if (priceType === SaleItemPriceType.MANUAL) {
    if (!hasManualPrice) {
      throw new Error(`Falta precio manual para ${product.name}`);
    }

    return {
      unitPrice: validate(Number(manualPriceInput), "manual"),
      priceType,
    };
  }

  if (priceType === SaleItemPriceType.WHOLESALE_PRICE) {
    return {
      unitPrice: validate(Number(wholesalePrice ?? publicPrice), "mayorista"),
      priceType,
    };
  }

  return {
    unitPrice: validate(Number(publicPrice), "minorista"),
    priceType,
  };
}

function resolvePurchasePriceSnapshot(product: any) {
  if (product.type !== ProductType.COMPUESTO) {
    const cost = Number(product.purchasePrice ?? 0);
    return Number.isFinite(cost) ? cost : 0;
  }

  const components = Array.isArray(product.components) ? product.components : [];

  return round2(
    components.reduce((acc: number, component: any) => {
      const componentCost = Number(component.component?.purchasePrice ?? 0);
      const unitQty = Number(component.quantity ?? 0);
      const kgQty = Number(component.quantityKg ?? 0);

      return acc + componentCost * unitQty + componentCost * kgQty;
    }, 0)
  );
}


async function resolveSaleItems(
  saleItems: CreateSaleInput["items"],
  client: ClientMini,
  businessId: string
): Promise<ResolvedSaleItem[]> {
  const itemsWithPrices: ResolvedSaleItem[] = [];

  for (const item of saleItems) {
    const product = await prisma.product.findFirst({
      where: {
        id: item.productId,
        businessId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        type: true,
        saleUnit: true,
        isService: true,

        price: true,
        pricePerKg: true,
        purchasePrice: true,
        ivaPorcentaje: true,

        clientPrice: true,
        wholesalePrice: true,
        clientPricePerKg: true,
        wholesalePricePerKg: true,

        components: {
          select: {
            componentId: true,
            quantity: true,
            quantityKg: true,
            component: {
              select: {
                id: true,
                name: true,
                purchasePrice: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new Error("Producto no encontrado");
    }

    const isDeliveryProduct = normalizeText(product.sku) === DELIVERY_SKU;

    const { quantity, quantityKg, qtyUsedForTotal } = isDeliveryProduct
      ? {
          quantity: Number(item.quantity ?? 1),
          quantityKg: null as number | null,
          qtyUsedForTotal: Number(item.quantity ?? 1),
        }
      : resolveQty(product, item);

    if (isDeliveryProduct && (!Number.isFinite(quantity) || quantity <= 0)) {
      throw new Error(`Cantidad inválida para ${product.name}`);
    }

    const manualPrice = item.price !== undefined ? Number(item.price) : undefined;

    if (
      item.price !== undefined &&
      (!Number.isFinite(Number(item.price)) || Number(item.price) < 0)
    ) {
      throw new Error(`Precio inválido para ${product.name}`);
    }

    const resolvedPrice = resolveUnitPrice(
      product,
      client,
      item.priceType,
      manualPrice
    );

    const unitPrice = resolvedPrice.unitPrice;
    const itemPriceType = resolvedPrice.priceType;
    const subtotal = round2(unitPrice * qtyUsedForTotal);
    const purchasePriceSnapshot = resolvePurchasePriceSnapshot(product);
    const costTotal = round2(purchasePriceSnapshot * qtyUsedForTotal);

    let components: ResolvedSaleItem["components"] = [];

    if (product.type === ProductType.COMPUESTO) {
      if (!product.components.length) {
        throw new Error(`El producto compuesto "${product.name}" no tiene componentes`);
      }

      components = product.components.map((component) => ({
        productId: component.componentId,
        quantity: component.quantity ?? null,
        quantityKg: component.quantityKg ?? null,
      }));
    } else if (Array.isArray(item.boxContents) && item.boxContents.length > 0) {
      components = item.boxContents.map((component) => ({
        productId: component.productId,
        quantity:
          component.quantity !== undefined ? Number(component.quantity) : null,
        quantityKg:
          component.quantityKg !== undefined ? Number(component.quantityKg) : null,
      }));
    }

    itemsWithPrices.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productType: product.type,
      saleUnit: product.saleUnit,
      isService: product.isService,
      quantity,
      quantityKg,
      price: unitPrice,
      priceType: itemPriceType,
      subtotal,
      purchasePriceSnapshot,
      ivaPorcentaje: Number(product.ivaPorcentaje ?? 21),
      costTotal,
      profit: 0,
      components,
    });
  }

  return itemsWithPrices;
}

function saleItemToResolved(item: any): ResolvedSaleItem {
  const qtyForCost = item.quantityKg ?? item.quantity;

  return {
    productId: item.productId,
    productName:
      item.productNameSnapshot ?? item.product?.name ?? "Producto",
    productSku: item.productSkuSnapshot ?? item.product?.sku ?? null,
    productType: item.product?.type as ProductType,
    saleUnit: item.product?.saleUnit as SaleUnit,
    isService: Boolean(item.product?.isService),
    quantity: item.quantity,
    quantityKg: item.quantityKg ?? null,
    price: item.price,
    priceType: item.priceType ?? SaleItemPriceType.PRICE,
    subtotal: item.subtotal ?? round2(item.price * qtyForCost),
    purchasePriceSnapshot: item.purchasePriceSnapshot ?? 0,
    ivaPorcentaje: item.ivaPorcentajeSnapshot ?? 21,
    costTotal: round2((item.purchasePriceSnapshot ?? 0) * qtyForCost),
    profit: item.profit ?? 0,
    components:
      item.boxContents?.map((box: any) => ({
        productId: box.productId,
        quantity: box.quantity ?? null,
        quantityKg: box.quantityKg ?? null,
      })) ?? [],
  };
}

function buildSaleItemCreateData(item: ResolvedSaleItem, businessId: string) {
  return {
    businessId,
    productId: item.productId,
    quantity: item.quantity,
    quantityKg: item.quantityKg,
    price: item.price,
    priceType: item.priceType,
    subtotal: item.subtotal,
    purchasePriceSnapshot: item.purchasePriceSnapshot,
    ivaPorcentajeSnapshot: item.ivaPorcentaje,
    profit: item.profit,
    productNameSnapshot: item.productName,
    productSkuSnapshot: item.productSku,

    boxContents: item.components.length
      ? {
          create: item.components.map((component) => ({
            businessId,
            productId: component.productId,
            quantity: component.quantity,
            quantityKg: component.quantityKg,
          })),
        }
      : undefined,
  };
}

function getPaymentsFromExistingSale(sale: any) {
  if (Array.isArray(sale.payments) && sale.payments.length > 0) {
    return sale.payments.map((payment: any) => ({
      method: payment.method as PaymentMethod,
      amount: Number(payment.amount),
      reference: payment.reference ?? undefined,
      notes: payment.notes ?? undefined,
    }));
  }

  if (sale.paymentMethod === PaymentMethod.CUENTA_CORRIENTE) {
    return [
      {
        method: PaymentMethod.CUENTA_CORRIENTE,
        amount: Number(sale.total ?? 0),
      },
    ];
  }

  return undefined;
}

function applyDiscountAndProfitToItems(
  items: ResolvedSaleItem[],
  discountBaseSubtotal: number,
  discountAmount: number
) {
  let appliedDiscount = 0;

  const lastDiscountableIndex = (() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (!isDeliverySaleItem(items[i])) return i;
    }

    return -1;
  })();

  return items.map((item, index) => {
    const isDeliveryItem = isDeliverySaleItem(item);
    const isLastDiscountable = index === lastDiscountableIndex;

    const proportionalDiscount =
      !isDeliveryItem && discountBaseSubtotal > 0
        ? isLastDiscountable
          ? round2(discountAmount - appliedDiscount)
          : round2(discountAmount * (item.subtotal / discountBaseSubtotal))
        : 0;

    appliedDiscount = round2(appliedDiscount + proportionalDiscount);

    const netSubtotal = round2(item.subtotal - proportionalDiscount);

    return {
      ...item,
      profit: round2(netSubtotal - item.costTotal),
    };
  });
}

function addStockLine(map: Map<string, StockLine>, line: StockLine) {
  const existing = map.get(line.productId);

  if (!existing) {
    map.set(line.productId, {
      productId: line.productId,
      quantity: line.quantity,
      quantityKg: line.quantityKg,
      reason: line.reason,
    });

    return;
  }

  existing.quantity += line.quantity;
  existing.quantityKg += line.quantityKg;
}

function buildStockLines(items: ResolvedSaleItem[]) {
  const stockMap = new Map<string, StockLine>();

  for (const item of items) {
    if (!shouldDiscountStock(item)) {
      continue;
    }

    const soldQty =
      item.saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : item.quantity;

    if (item.productType !== ProductType.COMPUESTO) {
      addStockLine(stockMap, {
        productId: item.productId,
        quantity: item.saleUnit === SaleUnit.UNIT ? item.quantity : 0,
        quantityKg: item.saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : 0,
        reason: `Venta de ${item.productName}`,
      });

      continue;
    }

    for (const component of item.components) {
      addStockLine(stockMap, {
        productId: component.productId,
        quantity: component.quantity ? component.quantity * soldQty : 0,
        quantityKg: component.quantityKg ? component.quantityKg * soldQty : 0,
        reason: `Componente de ${item.productName}`,
      });
    }
  }

  return Array.from(stockMap.values()).filter(
    (line) => line.quantity > 0 || line.quantityKg > 0
  );
}

/**
 * Compara las líneas de stock de la venta antes/después de editarla y devuelve
 * sólo el delta neto por producto, para no generar un ingreso + egreso completos
 * en cada edición sino un único movimiento por el cambio real.
 */
function diffStockLines(oldLines: StockLine[], newLines: StockLine[]) {
  const map = new Map<
    string,
    { productId: string; quantity: number; quantityKg: number; reason: string }
  >();

  for (const line of oldLines) {
    const entry = map.get(line.productId) ?? {
      productId: line.productId,
      quantity: 0,
      quantityKg: 0,
      reason: line.reason,
    };

    entry.quantity -= line.quantity;
    entry.quantityKg -= line.quantityKg;
    map.set(line.productId, entry);
  }

  for (const line of newLines) {
    const entry = map.get(line.productId) ?? {
      productId: line.productId,
      quantity: 0,
      quantityKg: 0,
      reason: line.reason,
    };

    entry.quantity += line.quantity;
    entry.quantityKg += line.quantityKg;
    entry.reason = line.reason;
    map.set(line.productId, entry);
  }

  const toDiscount: StockLine[] = [];
  const toRestore: StockLine[] = [];

  for (const entry of map.values()) {
    if (entry.quantity > 0 || entry.quantityKg > 0) {
      toDiscount.push({
        productId: entry.productId,
        quantity: Math.max(entry.quantity, 0),
        quantityKg: Math.max(entry.quantityKg, 0),
        reason: `Ajuste por modificación de venta (${entry.reason})`,
      });
    } else if (entry.quantity < 0 || entry.quantityKg < 0) {
      toRestore.push({
        productId: entry.productId,
        quantity: Math.max(-entry.quantity, 0),
        quantityKg: Math.max(-entry.quantityKg, 0),
        reason: `Ajuste por modificación de venta (${entry.reason})`,
      });
    }
  }

  return { toDiscount, toRestore };
}

async function validateStockAvailability(
  tx: any,
  stockLines: StockLine[],
  stockLocation: StockLocation,
  businessId: string
) {
  for (const line of stockLines) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, businessId },
      select: {
        id: true,
        name: true,
        saleUnit: true,
        stockLocal: true,
        stockDeposito: true,
        stockLocalKg: true,
        stockDepositoKg: true,
      },
    });

    if (!product) {
      throw new Error("Producto no encontrado para validar stock");
    }

    const fields = getStockFieldNames(stockLocation);
    const availableUnits = Number(product[fields.unit] ?? 0);
    const availableKg = Number(product[fields.kg] ?? 0);
    const locationLabel = getLocationLabel(stockLocation);

    if (line.quantity > 0 && availableUnits < line.quantity) {
      throw new Error(
        `Stock insuficiente en ${locationLabel} para ${product.name}. Necesitás ${line.quantity}, disponible ${availableUnits}`
      );
    }

    if (line.quantityKg > 0 && availableKg < line.quantityKg) {
      throw new Error(
        `Stock KG insuficiente en ${locationLabel} para ${product.name}. Necesitás ${line.quantityKg}, disponible ${availableKg}`
      );
    }
  }
}

async function discountStockLines(
  tx: any,
  stockLines: StockLine[],
  userId: string | undefined,
  saleId: string,
  stockLocation: StockLocation,
  pendingAlerts: string[],
  isClientMovement: boolean = false,
  businessId?: string
) {
  for (const line of stockLines) {
    const data: any = {};
    const fields = getStockFieldNames(stockLocation);

    if (line.quantity > 0) {
      data[fields.unit] = { decrement: line.quantity };
    }

    if (line.quantityKg > 0) {
      data[fields.kg] = { decrement: line.quantityKg };
    }

    const updatedProduct = await tx.product.update({
      where: { id: line.productId },
      data,
      select: {
        id: true,
      },
    });

    const movementData: any = {
      businessId,
      type: MovementType.SALE,
      from: stockLocation,
      to: null,
      quantity: line.quantity > 0 ? line.quantity : null,
      quantityKg: line.quantityKg > 0 ? line.quantityKg : null,
      reason: line.reason,
      reference: saleId,
      isClientMovement,
      product: {
        connect: {
          id: line.productId,
        },
      },
    };

    if (userId) {
      movementData.user = {
        connect: {
          id: userId,
        },
      };
    }

    await tx.stockMovement.create({
      data: movementData,
    });

    pendingAlerts.push(updatedProduct.id);
  }
}

async function restoreStockLines(
  tx: any,
  stockLines: StockLine[],
  userId: string | undefined,
  saleId: string,
  stockLocation: StockLocation,
  pendingAlerts: string[],
  isClientMovement: boolean = false,
  businessId?: string
) {
  for (const line of stockLines) {
    const data: any = {};
    const fields = getStockFieldNames(stockLocation);

    if (line.quantity > 0) {
      data[fields.unit] = {
        increment: line.quantity,
      };
    }

    if (line.quantityKg > 0) {
      data[fields.kg] = {
        increment: line.quantityKg,
      };
    }

    const updatedProduct = await tx.product.update({
      where: {
        id: line.productId,
      },
      data,
      select: {
        id: true,
      },
    });

    pendingAlerts.push(updatedProduct.id);

    const movementData: any = {
      businessId,
      type: MovementType.SALE_CANCEL,
      from: null,
      to: stockLocation,
      quantity: line.quantity > 0 ? line.quantity : null,
      quantityKg: line.quantityKg > 0 ? line.quantityKg : null,
      reason: "Cancelación de venta",
      reference: saleId,
      isClientMovement,
      product: {
        connect: {
          id: line.productId,
        },
      },
    };

    if (userId) {
      movementData.user = {
        connect: {
          id: userId,
        },
      };
    }

    await tx.stockMovement.create({
      data: movementData,
    });
  }
}

function queueStockAlerts(productIds: string[]) {
  const uniqueProductIds = [...new Set(productIds)];

  if (uniqueProductIds.length === 0) return;

  void Promise.all(
    uniqueProductIds.map(async (productId) => {
      try {
        await alertService.checkProductStock(productId);
      } catch (error) {
        console.error("Error revisando alerta de stock:", error);
      }
    })
  );
}

type PaymentCalcResult = {
  hasPayments: boolean;
  totalPaid: number;
  debtAmount: number;
  isAccountSale: boolean;
  paymentsToPersist: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];
};

function calculatePaymentState(params: {
  total: number;
  paymentMethod: PaymentMethod;
  payments?: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
    notes?: string;
  }[];
}): PaymentCalcResult {
  const hasPayments = Array.isArray(params.payments) && params.payments.length > 0;

  if (!hasPayments) {
    const isAccountSale = params.paymentMethod === PaymentMethod.CUENTA_CORRIENTE;

    return {
      hasPayments: false,
      totalPaid: isAccountSale ? 0 : params.total,
      debtAmount: isAccountSale ? params.total : 0,
      isAccountSale,
      paymentsToPersist: [],
    };
  }

  let totalPaid = 0;
  const paymentsToPersist: PaymentCalcResult["paymentsToPersist"] = [];
  let hasAccountPaymentLine = false;

  for (const payment of params.payments!) {
    if (!payment.method) {
      throw new Error("Cada pago necesita method");
    }

    const amount = Number(payment.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Cada pago necesita amount > 0");
    }

    if (payment.method === PaymentMethod.CUENTA_CORRIENTE) {
      hasAccountPaymentLine = true;
      continue;
    }

    totalPaid += amount;

    paymentsToPersist.push({
      method: payment.method,
      amount,
      reference: payment.reference,
      notes: payment.notes,
    });
  }

  totalPaid = round2(totalPaid);
  const debtAmount = round2(params.total - totalPaid);

  if (debtAmount < 0) {
    throw new Error(
      `La suma de pagos (${totalPaid}) no puede superar el total (${params.total})`
    );
  }

  return {
    hasPayments: paymentsToPersist.length > 0,
    totalPaid,
    debtAmount,
    isAccountSale: debtAmount > 0 || hasAccountPaymentLine,
    paymentsToPersist,
  };
}

async function createAccountDebtMovement(
  tx: any,
  data: {
    clientId: string;
    saleId: string;
    userId?: string | null;
    amount: number;
    description?: string;
  },
  businessId: string
) {
  const debtAmount = round2(data.amount);

  if (debtAmount <= 0) return null;

  const client = await tx.client.findFirst({
    where: { id: data.clientId, businessId },
    select: {
      id: true,
      currentBalance: true,
      isAccountEnabled: true,
      creditLimit: true,
    },
  });

  if (!client) throw new Error("Cliente no encontrado");

  if (!client.isAccountEnabled) {
    throw new Error("La cuenta corriente de este cliente está deshabilitada");
  }

  const previousBalance = round2(client.currentBalance);
  const newBalance = round2(previousBalance + debtAmount);

  if (
    client.creditLimit !== null &&
    client.creditLimit !== undefined &&
    client.creditLimit > 0 &&
    newBalance > client.creditLimit
  ) {
    throw new Error(
      `La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`
    );
  }

  await tx.client.update({
    where: { id: data.clientId },
    data: { currentBalance: newBalance },
  });

  return tx.accountMovement.create({
    data: {
      businessId,
      clientId: data.clientId,
      saleId: data.saleId,
      userId: data.userId ?? null,
      type: AccountMovementType.DEBT,
      amount: debtAmount,
      previousBalance,
      newBalance,
      paymentMethod: null,
      reference: data.saleId,
      description: data.description ?? "Deuda generada por venta en cuenta corriente",
    },
  });
}

async function reverseAccountDebtFromSale(tx: any, sale: any) {
  const debtAmount = round2(Number(sale.accountDebtAmount ?? 0));

  if (!sale.clientId || debtAmount <= 0) return null;

  const existingReverse = await tx.accountMovement.findFirst({
    where: {
      saleId: sale.id,
      businessId: sale.businessId,
      type: AccountMovementType.CREDIT_NOTE,
    },
    select: { id: true },
  });

  if (existingReverse) return null;

  const client = await tx.client.findFirst({
    where: { id: sale.clientId, businessId: sale.businessId },
    select: { id: true, currentBalance: true },
  });

  if (!client) throw new Error("Cliente no encontrado");

  const previousBalance = round2(client.currentBalance);
  const newBalance = round2(Math.max(previousBalance - debtAmount, 0));

  await tx.client.update({
    where: { id: sale.clientId },
    data: { currentBalance: newBalance },
  });

  await tx.sale.update({
    where: { id: sale.id },
    data: {
      accountDebtAmount: 0,
      isAccountSale: false,
    },
  });

  return tx.accountMovement.create({
    data: {
      businessId: sale.businessId,
      clientId: sale.clientId,
      saleId: sale.id,
      userId: sale.userId ?? null,
      type: AccountMovementType.CREDIT_NOTE,
      amount: debtAmount,
      previousBalance,
      newBalance,
      paymentMethod: null,
      reference: sale.id,
      description: "Reversión de deuda por cancelación de venta",
    },
  });
}

const DEFAULT_QUOTATION_HOURS = Number(process.env.DEFAULT_QUOTATION_HOURS ?? 36);

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function resolveQuotationHours(value?: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_QUOTATION_HOURS;
  }

  return parsed;
}

function buildSaleInclude() {
  return {
    payments: true,
    businessLocation: true,
    items: {
      include: {
        product: {
          include: {
            category: true,
          },
        },
        boxContents: {
          include: {
            product: true,
          },
        },
      },
    },
    user: true,
    client: true,
    invoiceAfip: {
      include: {
        creditNotes: true,
      },
    },
  };
}

function queueSalePdfGeneration(saleId: string) {
  setImmediate(() => {
    void (async () => {
      try {
        const sale = await prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            payments: true,
            businessLocation: true,
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
            user: true,
            client: true,
          },
        });

        if (!sale) return;

        const pdfPath = await generateInvoicePDF(sale);

        await prisma.invoice.upsert({
          where: {
            saleId: sale.id,
          },
          create: {
            saleId: sale.id,
            businessId: sale.businessId,
            pdfUrl: pdfPath,
          },
          update: {
            pdfUrl: pdfPath,
          },
        });

        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            pdfUrl: pdfPath,
          },
        });
      } catch (error) {
        console.error("Error generando PDF de venta en segundo plano:", error);
      }
    })();
  });
}

function normalizePositiveInt(value: unknown, fallback?: number) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const valueAsInt = Math.trunc(parsed);
  return valueAsInt > 0 ? valueAsInt : fallback;
}

function normalizeSaleStatusFilter(value?: string | SaleStatus) {
  if (!value) return undefined;

  const status = String(value).toUpperCase();
  return Object.values(SaleStatus).includes(status as SaleStatus)
    ? (status as SaleStatus)
    : undefined;
}

function buildSalesWhere(params: GetSalesParams = {}, includeStatus = true) {
  const where: any = {};

  if (params.businessId) {
    where.businessId = params.businessId;
  }

  const status = includeStatus ? normalizeSaleStatusFilter(params.status) : undefined;
  const search = String(params.search ?? "").trim();

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { client: { nombre: { contains: search, mode: "insensitive" } } },
      { client: { apellido: { contains: search, mode: "insensitive" } } },
      { client: { dni: { contains: search, mode: "insensitive" } } },
      { client: { gmail: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function getConfirmedMoneyWhere(baseWhere: any = {}) {
  return {
    AND: [
      baseWhere,
      { status: { not: SaleStatus.CANCELLED } },
      {
        OR: [
          { status: SaleStatus.COMPLETED },
          { isInvoiced: true },
          { invoiceStatus: InvoiceStatus.INVOICED },
        ],
      },
    ],
  };
}

async function buildSalesStats(params: GetSalesParams = {}) {
  const baseWhere = buildSalesWhere(params, false);
  const confirmedWhere = getConfirmedMoneyWhere(baseWhere);

  const [
    totalCount,
    pendingCount,
    completedCount,
    cancelledCount,
    confirmedTotal,
    debt,
  ] = await Promise.all([
    prisma.sale.count({ where: baseWhere }),
    prisma.sale.count({ where: { ...baseWhere, status: SaleStatus.PENDING } }),
    prisma.sale.count({ where: { ...baseWhere, status: SaleStatus.COMPLETED } }),
    prisma.sale.count({ where: { ...baseWhere, status: SaleStatus.CANCELLED } }),
    prisma.sale.aggregate({ where: confirmedWhere, _sum: { total: true } }),
    prisma.sale.aggregate({ where: confirmedWhere, _sum: { accountDebtAmount: true } }),
  ]);

  return {
    totalCount,
    pendingCount,
    completedCount,
    cancelledCount,
    confirmedTotal: round2(Number(confirmedTotal._sum.total ?? 0)),
    debt: round2(Number(debt._sum.accountDebtAmount ?? 0)),
  };
}

export const saleService = {
  async getAll(params: GetSalesParams = {}) {
    const page = normalizePositiveInt(params.page);
    const limit = normalizePositiveInt(params.limit);
    const where = buildSalesWhere(params);

    const mapSale = (sale: any) => ({
      ...sale,
      hasCreditNote: Boolean(sale.invoiceAfip?.creditNotes?.length),
    });

    // Compatibilidad: si no viene page/limit, devuelve todo como antes.
    if (!page || !limit) {
      const sales = await prisma.sale.findMany({
        where,
        include: buildSaleInclude(),
        orderBy: {
          createdAt: "desc",
        },
      });

      return sales.map(mapSale);
    }

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const [items, totalItems, stats] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: buildSaleInclude(),
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: safeLimit,
      }),
      prisma.sale.count({ where }),
      buildSalesStats(params),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));

    return {
      items: items.map(mapSale),
      meta: {
        page,
        limit: safeLimit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats,
    };
  },

  async getPending(businessId: string) {
    return prisma.sale.findMany({
      where: {
        businessId,
        status: SaleStatus.PENDING,
      },
      include: {
        payments: true,
        businessLocation: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            boxContents: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getById(id: string, businessId: string) {
    return prisma.sale.findFirst({
      where: {
        id,
        businessId,
      },
      include: buildSaleInclude(),
    });
  },

  async bulkUpdatePending(action: "COMPLETED" | "CANCELLED", businessId: string) {
    const pendingSales = await prisma.sale.findMany({
      where: {
        businessId,
        status: SaleStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    const updatedSales = [];

    for (const sale of pendingSales) {
      const updated = await this.updateStatus(sale.id, action as SaleStatus, businessId);
      updatedSales.push(updated);
    }

    return updatedSales;
  },

  async create(data: CreateSaleInput) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("La venta debe tener al menos un producto");
    }

    if (!data.businessId) {
      throw new Error("Falta businessId en la venta");
    }

    let client: ClientMini = null;

    if (data.clientId) {
      client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          businessId: data.businessId,
        },
        select: {
          category: true,
        },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }
    }

    if (data.businessLocationId) {
      const location = await prisma.businessLocation.findFirst({
        where: {
          id: data.businessLocationId,
          businessId: data.businessId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!location) {
        throw new Error("Sucursal/depósito no encontrado");
      }

      if (!location.isActive) {
        throw new Error("La sucursal/depósito seleccionado está inactivo");
      }
    }

    const itemsWithPrices = await resolveSaleItems(data.items, client, data.businessId);

    const subtotal = round2(
      itemsWithPrices.reduce((acc, item) => acc + item.subtotal, 0)
    );

    const deliveryCost = round2(Number(data.deliveryCost ?? 0));

    if (!Number.isFinite(deliveryCost) || deliveryCost < 0) {
      throw new Error("El costo de envío no puede ser negativo");
    }

    const deliveryLineSubtotal = round2(
      itemsWithPrices
        .filter(isDeliverySaleItem)
        .reduce((acc, item) => acc + item.subtotal, 0)
    );

    const discountBaseSubtotal = round2(subtotal - deliveryLineSubtotal);

    let discountAmount = 0;

    if (data.discountType && typeof data.discountValue === "number") {
      discountAmount =
        data.discountType === "PERCENTAGE"
          ? discountBaseSubtotal * (data.discountValue / 100)
          : data.discountValue;
    }

    discountAmount = round2(discountAmount);

    if ((data.deliveryMethod ?? DeliveryMethod.PICKUP) === DeliveryMethod.LOCAL_DELIVERY) {
      if (deliveryCost <= 0) {
        throw new Error("El costo de envío debe ser mayor a 0");
      }

      if (deliveryLineSubtotal <= 0) {
        throw new Error(
          `El envío debe venir cargado como item (${DELIVERY_SKU}) en la venta`
        );
      }

      if (Math.abs(deliveryLineSubtotal - deliveryCost) > 0.01) {
        throw new Error(
          `El item de envío (${round2(deliveryLineSubtotal)}) no coincide con deliveryCost (${deliveryCost})`
        );
      }
    }

    // El envío ya entra dentro de subtotal porque se manda como un item de venta.
    // Por eso NO se suma deliveryCost otra vez, para no duplicarlo.
    const total = round2(subtotal - discountAmount);

    const itemsWithProfit = applyDiscountAndProfitToItems(
      itemsWithPrices,
      discountBaseSubtotal,
      discountAmount
    );

    const grossProfit = round2(
      itemsWithProfit.reduce((acc, item) => acc + item.profit, 0)
    );

    if (total < 0) {
      throw new Error("El total no puede ser negativo");
    }

    const paymentState = calculatePaymentState({
      total,
      paymentMethod: data.paymentMethod,
      payments: data.payments,
    });

    if (paymentState.isAccountSale && !data.clientId) {
      throw new Error("Para vender en cuenta corriente necesitás seleccionar un cliente");
    }

    const stockLocation = normalizeStockLocation(data.stockLocation);
    const stockLines = buildStockLines(itemsWithProfit);

    const pendingAlerts: string[] = [];

    const saleStatus = data.status ?? SaleStatus.PENDING;

    const quotationExpiresAt =
      saleStatus === SaleStatus.PENDING
        ? addHours(new Date(), resolveQuotationHours(data.quotationHours))
        : null;

    const result = await prisma.$transaction(
      async (tx) => {
        await validateStockAvailability(tx, stockLines, stockLocation, data.businessId);

        const sale = await tx.sale.create({
          data: {
            businessId: data.businessId,
            userId: data.userId,
            clientId: data.clientId ?? null,
            businessLocationId: data.businessLocationId ?? null,

            subtotal,
            total,
            grossProfit,

            gmailSend: null,

            discountType: data.discountType ?? null,
            discountValue: data.discountValue ?? null,

            paymentMethod: data.paymentMethod,
            receiptType: data.receiptType,
            status: saleStatus,
            stockLocation,

            deliveryMethod: data.deliveryMethod ?? DeliveryMethod.PICKUP,
            deliveryStatus: data.deliveryStatus ?? DeliveryStatus.NONE,
            deliveryAddressSnapshot: data.deliveryAddressSnapshot ?? null,
            deliveryDistanceKm: data.deliveryDistanceKm ?? null,
            deliveryPricePerKm: data.deliveryPricePerKm ?? null,
            deliveryCost,

            transportName: data.transportName ?? null,
            transportCuit: data.transportCuit ?? null,

            packagesCount: data.packagesCount ?? null,
            declaredValue: data.declaredValue ?? null,

            quotationExpiresAt,
            quotationExpiredAt: null,

            isAccountSale: paymentState.isAccountSale,
            accountDebtAmount: paymentState.debtAmount,
            isWebSale: Boolean(data.isWebSale),

            items: {
              create: itemsWithProfit.map((item) =>
                buildSaleItemCreateData(item, data.businessId)
              ),
            },

            payments: paymentState.hasPayments
              ? {
                  create: paymentState.paymentsToPersist.map((payment) => ({
                    businessId: data.businessId,
                    method: payment.method,
                    amount: payment.amount,
                    reference: payment.reference ?? null,
                    notes: payment.notes ?? null,
                  })),
                }
              : undefined,
          },
          include: {
            payments: true,
            businessLocation: true,
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
            user: true,
            client: true,
          },
        });

        await discountStockLines(
          tx,
          stockLines,
          data.userId,
          sale.id,
          stockLocation,
          pendingAlerts,
          Boolean(data.isWebSale),
          data.businessId
        );

        if (paymentState.isAccountSale && paymentState.debtAmount > 0 && data.clientId) {
          await createAccountDebtMovement(
            tx,
            {
              clientId: data.clientId,
              saleId: sale.id,
              userId: data.userId ?? null,
              amount: paymentState.debtAmount,
            },
            data.businessId
          );
        }

        return sale;
      },
      {
        timeout: 20000,
        maxWait: 20000,
      }
    );

    queueStockAlerts(pendingAlerts);
    queueSalePdfGeneration(result.id);

    return {
      sale: result,
      invoice: null,
      pdfQueued: true,
    };
  },

  async updateItems(id: string, data: Partial<CreateSaleInput>, businessId: string) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("La venta debe tener al menos un producto");
    }

    const sale = await prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        payments: true,
        accountMovements: true,
        businessLocation: true,
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
        client: true,
        user: true,
        invoiceAfip: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("No se puede editar una venta cancelada");
    }

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error("Solo se puede editar una venta pendiente antes de confirmarla");
    }

    if (sale.isInvoiced || sale.invoiceStatus === "INVOICED" || sale.invoiceAfip) {
      throw new Error("No se puede editar una venta facturada. Emití una nota de crédito y generá una nueva venta");
    }

    const clientId = data.clientId !== undefined ? data.clientId : sale.clientId ?? undefined;
    let client: ClientMini = null;

    if (clientId) {
      client = await prisma.client.findFirst({
        where: { id: clientId, businessId },
        select: { category: true },
      });

      if (!client) {
        throw new Error("Cliente no encontrado");
      }
    }

    const businessLocationId =
      data.businessLocationId !== undefined
        ? data.businessLocationId
        : sale.businessLocationId ?? null;

    if (businessLocationId) {
      const location = await prisma.businessLocation.findFirst({
        where: { id: businessLocationId, businessId },
        select: { id: true, isActive: true },
      });

      if (!location) {
        throw new Error("Sucursal/depósito no encontrado");
      }

      if (!location.isActive) {
        throw new Error("La sucursal/depósito seleccionado está inactiva");
      }
    }

    const stockLocation = normalizeStockLocation(
      data.stockLocation ?? (sale as any).stockLocation ?? "LOCAL"
    );

    const itemsWithPrices = await resolveSaleItems(data.items, client, businessId);

    const subtotal = round2(
      itemsWithPrices.reduce((acc, item) => acc + item.subtotal, 0)
    );

    const deliveryMethod = data.deliveryMethod ?? sale.deliveryMethod ?? DeliveryMethod.PICKUP;
    const deliveryStatus = data.deliveryStatus ?? sale.deliveryStatus ?? DeliveryStatus.NONE;
    const deliveryCost = round2(Number(data.deliveryCost ?? sale.deliveryCost ?? 0));

    if (!Number.isFinite(deliveryCost) || deliveryCost < 0) {
      throw new Error("El costo de envío no puede ser negativo");
    }

    const deliveryLineSubtotal = round2(
      itemsWithPrices
        .filter(isDeliverySaleItem)
        .reduce((acc, item) => acc + item.subtotal, 0)
    );

    const discountType = data.discountType !== undefined ? data.discountType : sale.discountType ?? undefined;
    const discountValue = data.discountValue !== undefined ? data.discountValue : sale.discountValue ?? undefined;
    const discountBaseSubtotal = round2(subtotal - deliveryLineSubtotal);

    let discountAmount = 0;

    if (discountType && typeof discountValue === "number") {
      discountAmount =
        discountType === "PERCENTAGE"
          ? discountBaseSubtotal * (discountValue / 100)
          : discountValue;
    }

    discountAmount = round2(discountAmount);

    if (deliveryMethod === DeliveryMethod.LOCAL_DELIVERY) {
      if (deliveryCost <= 0) {
        throw new Error("El costo de envío debe ser mayor a 0");
      }

      if (deliveryLineSubtotal <= 0) {
        throw new Error(
          `El envío debe venir cargado como item (${DELIVERY_SKU}) en la venta`
        );
      }

      if (Math.abs(deliveryLineSubtotal - deliveryCost) > 0.01) {
        throw new Error(
          `El item de envío (${round2(deliveryLineSubtotal)}) no coincide con deliveryCost (${deliveryCost})`
        );
      }
    }

    const total = round2(subtotal - discountAmount);

    if (total < 0) {
      throw new Error("El total no puede ser negativo");
    }

    const itemsWithProfit = applyDiscountAndProfitToItems(
      itemsWithPrices,
      discountBaseSubtotal,
      discountAmount
    );

    const grossProfit = round2(
      itemsWithProfit.reduce((acc, item) => acc + item.profit, 0)
    );

    const paymentsForCalculation =
      data.payments !== undefined ? data.payments : getPaymentsFromExistingSale(sale);

    const paymentState = calculatePaymentState({
      total,
      paymentMethod: data.paymentMethod ?? sale.paymentMethod,
      payments: paymentsForCalculation,
    });

    if (paymentState.isAccountSale && !clientId) {
      throw new Error("Para vender en cuenta corriente necesitás seleccionar un cliente");
    }

    const oldDebt = round2(Number(sale.accountDebtAmount ?? 0));
    const newDebt = round2(paymentState.debtAmount);
    const debtDelta = round2(newDebt - oldDebt);

    if (debtDelta !== 0 && !clientId) {
      throw new Error("Para ajustar deuda necesitás seleccionar cliente");
    }

    const oldStockLocation = normalizeStockLocation(
      (sale as any).stockLocation ?? "LOCAL"
    );
    const sameStockLocation = oldStockLocation === stockLocation;

    const oldStockLines = buildStockLines(sale.items.map(saleItemToResolved));
    const newStockLines = buildStockLines(itemsWithProfit);

    // En vez de revertir TODO el stock viejo y descontar TODO el stock nuevo
    // (lo que generaba un ingreso + egreso completos en cada edición), sólo
    // movemos el delta neto por producto: si una venta pasa de 2 a 4
    // unidades, se genera un único egreso de 2 (no un ingreso de 2 + egreso de 4).
    // Si cambia el depósito/local de la venta no se puede compensar el delta
    // entre ubicaciones distintas, así que en ese caso sí se revierte/descuenta todo.
    const { toDiscount, toRestore } = sameStockLocation
      ? diffStockLines(oldStockLines, newStockLines)
      : { toDiscount: newStockLines, toRestore: oldStockLines };

    const isClientMovement = Boolean((sale as any).isWebSale);
    const pendingAlerts: string[] = [];

    const updated = await prisma.$transaction(
      async (tx) => {
        await restoreStockLines(
          tx,
          toRestore,
          sale.userId ?? undefined,
          sale.id,
          sameStockLocation ? stockLocation : oldStockLocation,
          pendingAlerts,
          isClientMovement,
          businessId
        );

        await validateStockAvailability(tx, toDiscount, stockLocation, businessId);

        await tx.boxContent.deleteMany({
          where: {
            saleItem: {
              saleId: sale.id,
              businessId,
            },
          },
        });

        await tx.saleItem.deleteMany({
          where: {
            saleId: sale.id,
            businessId,
          },
        });

        if (debtDelta !== 0 && clientId) {
          const currentClient = await tx.client.findFirst({
            where: { id: clientId, businessId },
            select: {
              id: true,
              currentBalance: true,
              isAccountEnabled: true,
              creditLimit: true,
            },
          });

          if (!currentClient) throw new Error("Cliente no encontrado");

          if (!currentClient.isAccountEnabled && debtDelta > 0) {
            throw new Error("La cuenta corriente de este cliente está deshabilitada");
          }

          const previousBalance = round2(currentClient.currentBalance);
          const newBalance = round2(Math.max(previousBalance + debtDelta, 0));

          if (
            debtDelta > 0 &&
            currentClient.creditLimit !== null &&
            currentClient.creditLimit !== undefined &&
            currentClient.creditLimit > 0 &&
            newBalance > currentClient.creditLimit
          ) {
            throw new Error(
              `La deuda supera el límite de crédito del cliente. Límite: ${currentClient.creditLimit}`
            );
          }

          await tx.client.update({
            where: { id: clientId },
            data: { currentBalance: newBalance },
          });

          await tx.accountMovement.create({
            data: {
              businessId,
              clientId,
              saleId: sale.id,
              userId: sale.userId ?? null,
              type:
                debtDelta > 0
                  ? AccountMovementType.ADJUSTMENT_POSITIVE
                  : AccountMovementType.ADJUSTMENT_NEGATIVE,
              amount: Math.abs(debtDelta),
              previousBalance,
              newBalance,
              paymentMethod: null,
              reference: sale.id,
              description:
                debtDelta > 0
                  ? "Aumento de deuda por edición de venta"
                  : "Reducción de deuda por edición de venta",
            },
          });
        }

        const editedSale = await tx.sale.update({
          where: { id: sale.id },
          data: {
            clientId: clientId ?? null,
            businessLocationId,
            subtotal,
            total,
            grossProfit,
            discountType: discountType ?? null,
            discountValue: discountValue ?? null,
            paymentMethod: data.paymentMethod ?? sale.paymentMethod,
            receiptType: data.receiptType ?? sale.receiptType,
            stockLocation,
            deliveryMethod,
            deliveryStatus,
            deliveryAddressSnapshot:
              data.deliveryAddressSnapshot !== undefined
                ? data.deliveryAddressSnapshot
                : sale.deliveryAddressSnapshot,
            deliveryDistanceKm:
              data.deliveryDistanceKm !== undefined
                ? data.deliveryDistanceKm
                : sale.deliveryDistanceKm,
            deliveryPricePerKm:
              data.deliveryPricePerKm !== undefined
                ? data.deliveryPricePerKm
                : sale.deliveryPricePerKm,
            deliveryCost,
            transportName:
              data.transportName !== undefined ? data.transportName : sale.transportName,
            transportCuit:
              data.transportCuit !== undefined ? data.transportCuit : sale.transportCuit,
            packagesCount:
              data.packagesCount !== undefined ? data.packagesCount : sale.packagesCount,
            declaredValue:
              data.declaredValue !== undefined ? data.declaredValue : sale.declaredValue,
            isAccountSale: paymentState.isAccountSale,
            accountDebtAmount: newDebt,
            items: {
              create: itemsWithProfit.map((item) =>
                buildSaleItemCreateData(item, businessId)
              ),
            },
            payments: {
              deleteMany: {},
              create: paymentState.paymentsToPersist.map((payment) => ({
                businessId,
                method: payment.method,
                amount: payment.amount,
                reference: payment.reference ?? null,
                notes: payment.notes ?? null,
              })),
            },
          },
          include: buildSaleInclude(),
        });

        await discountStockLines(
          tx,
          toDiscount,
          sale.userId ?? undefined,
          sale.id,
          stockLocation,
          pendingAlerts,
          isClientMovement,
          businessId
        );

        return editedSale;
      },
      {
        timeout: 30000,
        maxWait: 30000,
      }
    );

    queueStockAlerts(pendingAlerts);
    queueSalePdfGeneration(updated.id);

    if (updated.status === SaleStatus.COMPLETED) {
      await financeService.registerIncomeFromSale(id);
    }

    return updated;
  },

  async updateStatus(id: string, status: SaleStatus, businessId: string) {
    const sale = await prisma.sale.findFirst({
      where: {
        id,
        businessId,
      },
      include: {
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

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status === status) {
      return prisma.sale.findFirst({
        where: {
          id,
          businessId,
        },
        include: {
          payments: true,
          businessLocation: true,
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
          user: true,
          client: true,
        },
      });
    }

    if (sale.status === SaleStatus.CANCELLED && status !== SaleStatus.CANCELLED) {
      throw new Error("No se puede cambiar el estado de una venta cancelada");
    }

    const restoredStockLines: StockLine[] = [];
    const stockLocation = normalizeStockLocation((sale as any).stockLocation ?? "LOCAL");
    const pendingAlerts: string[] = [];

    if (status === SaleStatus.CANCELLED) {
      const resolvedItems: ResolvedSaleItem[] = sale.items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name ?? "Producto",
        productSku: item.product?.sku ?? null,
        productType: item.product?.type as ProductType,
        saleUnit: item.product?.saleUnit as SaleUnit,
        isService: Boolean((item.product as any)?.isService),
        quantity: item.quantity,
        quantityKg: item.quantityKg ?? null,
        price: item.price,
        priceType: (item as any).priceType ?? SaleItemPriceType.PRICE,
        subtotal: (item as any).subtotal ?? item.price * (item.quantityKg ?? item.quantity),
        purchasePriceSnapshot: (item as any).purchasePriceSnapshot ?? 0,
        ivaPorcentaje: (item as any).ivaPorcentajeSnapshot ?? 21,
        costTotal:
          ((item as any).purchasePriceSnapshot ?? 0) *
          (item.quantityKg ?? item.quantity),
        profit: (item as any).profit ?? 0,
        components:
          item.boxContents?.map((box) => ({
            productId: box.productId,
            quantity: box.quantity ?? null,
            quantityKg: (box as any).quantityKg ?? null,
          })) ?? [],
      }));

      restoredStockLines.push(...buildStockLines(resolvedItems));
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        if (status === SaleStatus.CANCELLED) {
          await restoreStockLines(
            tx,
            restoredStockLines,
            sale.userId ?? undefined,
            sale.id,
            stockLocation,
            pendingAlerts,
            undefined,
            businessId
          );

          await reverseAccountDebtFromSale(tx, sale);
        }

        return tx.sale.update({
          where: {
            id,
          },
          data: {
            status,
            ...(status === SaleStatus.CANCELLED
              ? { quotationExpiredAt: sale.quotationExpiredAt ?? new Date() }
              : {}),
            ...(status === SaleStatus.COMPLETED
              ? { quotationExpiredAt: null }
              : {}),
          },
          include: {
            payments: true,
            businessLocation: true,
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
            user: true,
            client: true,
          },
        });
      },
      {
        timeout: 20000,
        maxWait: 20000,
      }
    );

    queueStockAlerts(pendingAlerts);

    if (status === SaleStatus.COMPLETED) {
      await financeService.registerIncomeFromSale(id);

      await productStatsService.createStatsFromSale(
        sale.items
          .filter((item) => !item.product?.isService)
          .map((item) => {
            const saleUnit = item.product?.saleUnit as SaleUnit;

            return {
              productId: item.productId,
              quantity: saleUnit === SaleUnit.KG ? 0 : item.quantity,
              quantityKg: saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : undefined,
            };
          }),
        sale.businessId
      );
    }

    return updated;
  },

  async generarNotaPedido(saleId: string, businessId: string) {
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      include: {
        payments: true,
        businessLocation: true,
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
        client: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    const products = sale.items.map((item) => {
      const saleUnit = item.product?.saleUnit as SaleUnit;
      const qty = saleUnit === SaleUnit.KG ? item.quantityKg ?? 0 : item.quantity;

      return {
        name:
          (item as any).productNameSnapshot ??
          item.product?.name ??
          "Producto",
        quantity: qty,
        price: item.price,
      };
    });

    const metodoPago = sale.payments?.length ? "MIXTO" : sale.paymentMethod;

    await generarTicketPedidoPDF({
      businessId,
      saleId: sale.id,
      products,
      total: sale.total,
      metodoPago,
      nombreCliente: sale.client
        ? `${sale.client.nombre} ${sale.client.apellido}`
        : "A CONSUMIDOR FINAL",
    });

    return {
      ok: true,
    };
  },

  async generarCotizacion(saleId: string, businessId: string) {
    let sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      include: {
        payments: true,
        businessLocation: true,
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
        user: true,
        client: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status !== SaleStatus.PENDING) {
      throw new Error("Solo se puede descargar cotización de una venta pendiente");
    }

    if (!sale.quotationExpiresAt) {
      sale = await prisma.sale.update({
        where: {
          id: sale.id,
        },
        data: {
          quotationExpiresAt: addHours(new Date(), DEFAULT_QUOTATION_HOURS),
        },
        include: {
          payments: true,
          businessLocation: true,
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
          user: true,
          client: true,
        },
      });
    }

    const pdfBuffer = await generarCotizacionPDF(sale);

    return {
      filename: `cotizacion-${sale.id}.pdf`,
      buffer: pdfBuffer,
    };
  },

  async generarComprobanteVenta(saleId: string, businessId: string) {
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: true,
        client: true,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new Error(
        "Solo se puede generar el comprobante de una venta confirmada"
      );
    }

    if (sale.isInvoiced) {
      throw new Error(
        "Esta venta ya fue facturada, descargue la factura correspondiente"
      );
    }

    const pdfBuffer = await generarComprobanteVentaPDF(sale);

    return {
      filename: `comprobante-${sale.id}.pdf`,
      buffer: pdfBuffer,
    };
  },

  async expirePendingQuotations(limit = 100) {
    const now = new Date();

    const expiredSales = await prisma.sale.findMany({
      where: {
        status: SaleStatus.PENDING,
        quotationExpiresAt: {
          lte: now,
        },
        quotationExpiredAt: null,
      },
      select: {
        id: true,
        businessId: true,
        quotationExpiresAt: true,
      },
      take: limit,
      orderBy: {
        quotationExpiresAt: "asc",
      },
    });

    const results = [];

    for (const sale of expiredSales) {
      try {
        const updated = await this.updateStatus(
          sale.id,
          SaleStatus.CANCELLED,
          sale.businessId
        );

        results.push({
          id: sale.id,
          ok: true,
          status: updated?.status ?? SaleStatus.CANCELLED,
        });
      } catch (error: any) {
        results.push({
          id: sale.id,
          ok: false,
          error: error?.message ?? "Error desconocido",
        });
      }
    }

    return {
      checkedAt: now,
      expiredCount: expiredSales.length,
      results,
    };
  },

  async updatePaymentMethod(id: string, method: PaymentMethod, businessId: string) {
    const sale = await prisma.sale.findFirst({
      where: {
        id,
        businessId,
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada");
    }

    return prisma.sale.update({
      where: {
        id,
      },
      data: {
        paymentMethod: method,
      },
      include: {
        payments: true,
        businessLocation: true,
        items: true,
        user: true,
        client: true,
      },
    });
  },

  async updatePayments(
    id: string,
    payments: {
      method: PaymentMethod;
      amount: number;
      reference?: string;
      notes?: string;
    }[],
    setAsPrimary: boolean,
    businessId: string
  ) {
    const sale = await prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        payments: true,
        accountMovements: true,
      },
    });

    if (!sale) throw new Error("Venta no encontrada");

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("No se pueden modificar pagos de una venta cancelada");
    }

    const paymentState = calculatePaymentState({
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      payments,
    });

    if (paymentState.isAccountSale && !sale.clientId) {
      throw new Error("Para dejar saldo en cuenta corriente la venta debe tener cliente");
    }

    const oldDebt = round2(Number(sale.accountDebtAmount ?? 0));
    const newDebt = round2(paymentState.debtAmount);
    const debtDelta = round2(newDebt - oldDebt);
    const primary = payments[0]?.method ?? sale.paymentMethod;

    const updatedSale = await prisma.$transaction(async (tx) => {
      if (debtDelta !== 0 && sale.clientId) {
        const client = await tx.client.findFirst({
          where: { id: sale.clientId, businessId },
          select: {
            id: true,
            currentBalance: true,
            isAccountEnabled: true,
            creditLimit: true,
          },
        });

        if (!client) throw new Error("Cliente no encontrado");

        if (!client.isAccountEnabled && debtDelta > 0) {
          throw new Error("La cuenta corriente de este cliente está deshabilitada");
        }

        const previousBalance = round2(client.currentBalance);
        const newBalance = round2(Math.max(previousBalance + debtDelta, 0));

        if (
          debtDelta > 0 &&
          client.creditLimit !== null &&
          client.creditLimit !== undefined &&
          client.creditLimit > 0 &&
          newBalance > client.creditLimit
        ) {
          throw new Error(
            `La deuda supera el límite de crédito del cliente. Límite: ${client.creditLimit}`
          );
        }

        await tx.client.update({
          where: { id: sale.clientId },
          data: { currentBalance: newBalance },
        });

        await tx.accountMovement.create({
          data: {
            businessId,
            clientId: sale.clientId,
            saleId: sale.id,
            userId: sale.userId ?? null,
            type:
              debtDelta > 0
                ? AccountMovementType.ADJUSTMENT_POSITIVE
                : AccountMovementType.ADJUSTMENT_NEGATIVE,
            amount: Math.abs(debtDelta),
            previousBalance,
            newBalance,
            paymentMethod: null,
            reference: sale.id,
            description:
              debtDelta > 0
                ? "Aumento de deuda por actualización de pagos"
                : "Reducción de deuda por actualización de pagos",
          },
        });
      }

      return tx.sale.update({
        where: { id },
        data: {
          isAccountSale: paymentState.isAccountSale,
          accountDebtAmount: newDebt,
          payments: {
            deleteMany: {},
            create: paymentState.paymentsToPersist.map((payment) => ({
              businessId,
              method: payment.method,
              amount: payment.amount,
              reference: payment.reference ?? null,
              notes: payment.notes ?? null,
            })),
          },
          ...(setAsPrimary ? { paymentMethod: primary } : {}),
        },
        include: {
          payments: true,
          businessLocation: true,
          items: true,
          user: true,
          client: true,
          accountMovements: true,
        },
      });
    });

    if (updatedSale.status === SaleStatus.COMPLETED) {
      await financeService.registerIncomeFromSale(id);
    }

    return updatedSale;
  },
};