import prisma from "../prisma";
import {
  CategoryClient,
  PaymentMethod,
  ProductType,
  ReceiptType,
  Role,
  SaleStatus,
  SaleUnit,
  Location,
} from "@prisma/client";
import { saleService } from "./sale.service";
import { whatsappService } from "./whatsapp.service";

type CatalogFilters = {
  userId?: string;
  categorySlug?: string;
  search?: string;
  limit?: number;
  page?: number;
};

type CheckoutItemInput = {
  productId: string;
  quantity?: number;
  quantityKg?: number;
};

type CheckoutInput = {
  userId: string;
  businessId: string;
  items: CheckoutItemInput[];
  paymentMethod?: PaymentMethod;
  customerNotes?: string;
};

type CustomerContext = {
  userId?: string;
  clientId?: string;
  category: CategoryClient;
  customerName?: string;
  dni?: string;
  phone?: string | null;
  email?: string | null;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function cleanLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 60;
  return Math.min(Math.max(Math.trunc(limit), 1), 120);
}

function cleanPage(page?: number) {
  if (!page || !Number.isFinite(page)) return 1;
  return Math.max(Math.trunc(page), 1);
}

function normalizeSearch(search?: string) {
  const value = String(search || "").trim();
  return value.length ? value : undefined;
}

function normalizeCategory(value?: string | null): CategoryClient {
  if (value === CategoryClient.Mayorista || value === "Mayorista") {
    return CategoryClient.Mayorista;
  }

  // Compatibilidad: Cliente/Price/Minorista se tratan como minorista.
  return CategoryClient.Price;
}

function getStockLocationByCategory(category: CategoryClient): Location {
  return category === CategoryClient.Mayorista
    ? Location.LOCAL
    : Location.DEPOSITO;
}

function getLocationLabelByCategory(category: CategoryClient) {
  return category === CategoryClient.Mayorista
    ? "local mayorista"
    : "depósito minorista";
}

function getUnitStockByLocation(product: any, location: Location) {
  return Number(
    location === Location.LOCAL
      ? product.stockLocal || 0
      : product.stockDeposito || 0,
  );
}

function getKgStockByLocation(product: any, location: Location) {
  return Number(
    location === Location.LOCAL
      ? product.stockLocalKg || 0
      : product.stockDepositoKg || 0,
  );
}

function getProductStock(product: any, category: CategoryClient) {
  const stockLocation = getStockLocationByCategory(category);
  const locationLabel = getLocationLabelByCategory(category);

  if (product.type === ProductType.COMPUESTO) {
    if (!Array.isArray(product.components) || product.components.length === 0) {
      return {
        availableQuantity: 0,
        availableKg: 0,
        stockLabel: "Sin componentes configurados",
        canSell: false,
      };
    }

    const maxByComponents = product.components.map((component: any) => {
      const componentProduct = component.component;
      const unitQty = Number(component.quantity || 0);
      const kgQty = Number(component.quantityKg || 0);

      if (!componentProduct) return 0;

      if (unitQty > 0) {
        return Math.floor(
          getUnitStockByLocation(componentProduct, stockLocation) / unitQty,
        );
      }

      if (kgQty > 0) {
        return Math.floor(
          getKgStockByLocation(componentProduct, stockLocation) / kgQty,
        );
      }

      return 0;
    });

    const available = Math.max(0, Math.min(...maxByComponents));
    const isKg = product.saleUnit === SaleUnit.KG;

    return {
      availableQuantity: isKg ? 0 : available,
      availableKg: isKg ? available : 0,
      stockLabel:
        available > 0
          ? `${isKg ? round2(available) + " kg" : available} disponibles en ${locationLabel}`
          : `Sin stock en ${locationLabel}`,
      canSell: available > 0,
    };
  }

  if (product.saleUnit === SaleUnit.KG) {
    const availableKg = getKgStockByLocation(product, stockLocation);

    return {
      availableQuantity: 0,
      availableKg,
      stockLabel:
        availableKg > 0
          ? `${round2(availableKg)} kg disponibles en ${locationLabel}`
          : `Sin stock en ${locationLabel}`,
      canSell: availableKg > 0,
    };
  }

  const availableQuantity = getUnitStockByLocation(product, stockLocation);

  return {
    availableQuantity,
    availableKg: 0,
    stockLabel:
      availableQuantity > 0
        ? `${availableQuantity} disponibles en ${locationLabel}`
        : `Sin stock en ${locationLabel}`,
    canSell: availableQuantity > 0,
  };
}

function getRequestedQuantityForProduct(product: any, item: CheckoutItemInput) {
  if (product.saleUnit === SaleUnit.KG) {
    return Number(item.quantityKg ?? item.quantity ?? 0);
  }

  return Number(item.quantity ?? item.quantityKg ?? 0);
}

function getAvailableQuantityForProduct(
  product: any,
  stock: ReturnType<typeof getProductStock>,
) {
  if (product.saleUnit === SaleUnit.KG) {
    return Number(stock.availableKg || 0);
  }

  return Number(stock.availableQuantity || 0);
}

function formatStockAmountForProduct(product: any, value: number) {
  if (product.saleUnit === SaleUnit.KG) {
    return `${round2(value)} kg`;
  }

  const units = Math.trunc(value);
  return `${units} unidad${units === 1 ? "" : "es"}`;
}

function resolvePrice(product: any, category: CategoryClient) {
  const isKg = product.saleUnit === SaleUnit.KG;

  const publicPriceRaw = isKg ? product.pricePerKg : product.price;
  const wholesalePriceRaw = isKg
    ? product.wholesalePricePerKg
    : product.wholesalePrice;

  const publicPrice = Number(publicPriceRaw);
  const safePublicPrice = Number.isFinite(publicPrice) ? publicPrice : 0;

  const wholesalePrice = Number(wholesalePriceRaw ?? safePublicPrice);
  const safeWholesalePrice = Number.isFinite(wholesalePrice)
    ? wholesalePrice
    : safePublicPrice;

  let price = safePublicPrice;
  let priceList: "PUBLIC" | "WHOLESALE" = "PUBLIC";

  if (category === CategoryClient.Mayorista) {
    price = safeWholesalePrice;
    priceList = "WHOLESALE";
  }

  return {
    price: round2(Number.isFinite(price) ? price : 0),
    priceList,
    publicPrice: round2(safePublicPrice),
    clientPrice: round2(safePublicPrice),
    wholesalePrice: round2(safeWholesalePrice),
    currency: "ARS",
  };
}

function mapProduct(product: any, customer: CustomerContext) {
  const stock = getProductStock(product, customer.category);
  const pricing = resolvePrice(product, customer.category);

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    type: product.type,
    saleUnit: product.saleUnit,
    imageUrl: product.imageUrl,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
        }
      : null,
    price: pricing.price,
    priceList: pricing.priceList,
    publicPrice: pricing.publicPrice,
    clientPrice: pricing.clientPrice,
    wholesalePrice: pricing.wholesalePrice,
    currency: pricing.currency,
    availableQuantity: stock.availableQuantity,
    availableKg: stock.availableKg,
    stockLabel: stock.stockLabel,
    canSell: stock.canSell,
    components:
      product.type === ProductType.COMPUESTO
        ? product.components.map((component: any) => ({
            id: component.id,
            productId: component.componentId,
            name: component.component?.name ?? "Componente",
            quantity: component.quantity,
            quantityKg: component.quantityKg,
            saleUnit: component.component?.saleUnit,
          }))
        : [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function normalizeWhatsappNumber(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function buildWhatsappUrl(message: string) {
  const phone = normalizeWhatsappNumber(
    process.env.STORE_WHATSAPP_NUMBER ||
      process.env.WHATSAPP_PHONE ||
      process.env.BUSINESS_WHATSAPP_NUMBER ||
      process.env.BUSINESS_WHATSAPP,
  );

  if (!phone) return null;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildWhatsappMessage(params: {
  sale: any;
  customer: CustomerContext;
  customerNotes?: string;
}) {
  const { sale, customer, customerNotes } = params;

  const lines = sale.items.map((item: any) => {
    const productName =
      item.product?.name || item.productNameSnapshot || "Producto";
    const saleUnit = item.product?.saleUnit || "UNIT";
    const qty =
      saleUnit === SaleUnit.KG
        ? `${round2(Number(item.quantityKg || 0))} kg`
        : `x${item.quantity}`;

    return `- ${productName} ${qty} — ${formatMoney(Number(item.subtotal || 0))}`;
  });

  const customerLines = [
    customer.customerName ? `Mi nombre: ${customer.customerName}` : null,
    customer.dni ? `DNI/CUIT: ${customer.dni}` : null,
    customer.phone ? `Teléfono: ${customer.phone}` : null,
    customer.email ? `Email: ${customer.email}` : null,
  ].filter(Boolean);

  return [
    "Hola! Quiero hacer este pedido:",
    "",
    `Pedido #${sale.id}`,
    ...lines,
    "",
    `Total: ${formatMoney(Number(sale.total || 0))}`,
    "",
    ...customerLines,
    customerNotes ? "" : null,
    customerNotes ? `Notas: ${customerNotes}` : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

export const catalogService = {
  async getCustomerContext(userId?: string): Promise<CustomerContext> {
    if (!userId) {
      return { category: CategoryClient.Price };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user || user.isActive === false) {
      return { category: CategoryClient.Price };
    }

    if (user.role !== Role.CLIENTE || !user.client) {
      return {
        userId: user.id,
        category: CategoryClient.Price,
        customerName: user.name,
        email: user.email,
      };
    }

    return {
      userId: user.id,
      clientId: user.client.id,
      category: normalizeCategory(user.client.category),
      customerName:
        [user.client.nombre, user.client.apellido]
          .filter(Boolean)
          .join(" ")
          .trim() || user.name,
      dni: user.client.dni,
      phone: user.client.telefono,
      email: user.client.gmail || user.email,
    };
  },

  async getCategories() {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            products: { where: { isActive: true } },
          },
        },
      },
    });

    return categories.map((category: any) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      productsCount: category._count.products,
    }));
  },

  async getProducts(filters: CatalogFilters) {
    const customer = await this.getCustomerContext(filters.userId);
    const limit = cleanLimit(filters.limit);
    const page = cleanPage(filters.page);
    const search = normalizeSearch(filters.search);

    const where: any = { isActive: true };

    if (filters.categorySlug) {
      where.category = {
        slug: filters.categorySlug,
        isActive: true,
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    const products: any[] = await prisma.product.findMany({
      where,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: {
        category: true,
        components: { include: { component: true } },
      },
    });

    const mappedProducts = products
      .map((product: any) => mapProduct(product, customer))
      .sort((a, b) => {
        if (a.canSell !== b.canSell) return a.canSell ? -1 : 1;

        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "es-AR",
          {
            numeric: true,
            sensitivity: "base",
          },
        );
      });

    const total = mappedProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const paginatedProducts = mappedProducts.slice(
      (safePage - 1) * limit,
      safePage * limit,
    );

    return {
      customer: {
        category: customer.category,
        isLoggedIn: !!customer.userId,
        clientId: customer.clientId ?? null,
      },
      pagination: {
        page: safePage,
        limit,
        total,
        pages: totalPages,
        totalPages,
      },
      products: paginatedProducts,
    };
  },

  async validateCart(data: CheckoutInput) {
    if (!data.userId) {
      throw new Error("Para validar el carrito tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(data.userId);

    if (!customer.clientId) {
      throw new Error(
        "Solo los usuarios cliente pueden validar carritos desde la tienda",
      );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      return {
        ok: true,
        customer: {
          category: customer.category,
          clientId: customer.clientId ?? null,
        },
        items: [],
      };
    }

    const normalizedItems = data.items.map((item) => ({
      productId: String(item.productId || ""),
      quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
      quantityKg:
        item.quantityKg !== undefined ? Number(item.quantityKg) : undefined,
    }));

    for (const item of normalizedItems) {
      if (!item.productId) {
        throw new Error("Hay un producto inválido en el carrito");
      }
    }

    const productIds = [
      ...new Set(normalizedItems.map((item) => item.productId)),
    ];

    const products: any[] = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        isActive: true,
      },
      include: {
        category: true,
        components: {
          include: {
            component: true,
          },
        },
      },
    });

    const productMap = new Map<string, any>(
      products.map((product: any) => [product.id, product]),
    );

    const validatedItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        return {
          productId: item.productId,
          name: "Producto no disponible",
          saleUnit: null,
          requested: 0,
          available: 0,
          ok: false,
          message: "Este producto ya no está disponible en la tienda.",
          stockLabel: "Producto no disponible",
          product: null,
        };
      }

      const stock = getProductStock(product, customer.category);
      const pricing = resolvePrice(product, customer.category);
      const requested = getRequestedQuantityForProduct(product, item);
      const available = getAvailableQuantityForProduct(product, stock);

      let ok = true;
      let message = "";

      if (!Number.isFinite(requested) || requested <= 0) {
        ok = false;
        message = `La cantidad de ${product.name} no es válida.`;
      } else if (pricing.price <= 0) {
        ok = false;
        message = `${product.name} no tiene precio configurado para tu lista.`;
      } else if (!stock.canSell || available <= 0) {
        ok = false;
        message = `${product.name} no tiene stock disponible en ${getLocationLabelByCategory(
          customer.category,
        )}.`;
      } else if (requested > available) {
        ok = false;
        message = `De ${product.name} solo hay ${formatStockAmountForProduct(
          product,
          available,
        )} disponible${available === 1 && product.saleUnit !== SaleUnit.KG ? "" : "s"}.`;
      }

      return {
        productId: product.id,
        name: product.name,
        saleUnit: product.saleUnit,
        requested: round2(requested),
        available: round2(available),
        ok,
        message,
        stockLabel: stock.stockLabel,
        product: mapProduct(product, customer),
      };
    });

    return {
      ok: validatedItems.every((item) => item.ok),
      customer: {
        category: customer.category,
        clientId: customer.clientId ?? null,
      },
      items: validatedItems,
    };
  },

  async checkoutWhatsapp(data: CheckoutInput) {
    if (!data.userId) {
      throw new Error("Para finalizar el pedido tenés que iniciar sesión");
    }

    const customer = await this.getCustomerContext(data.userId);

    if (!customer.clientId) {
      throw new Error(
        "Solo los usuarios cliente pueden finalizar pedidos desde la tienda",
      );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("El carrito está vacío");
    }

    const normalizedItems = data.items.map((item) => ({
      productId: String(item.productId || ""),
      quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
      quantityKg:
        item.quantityKg !== undefined ? Number(item.quantityKg) : undefined,
    }));

    for (const item of normalizedItems) {
      if (!item.productId) {
        throw new Error("Hay un producto inválido en el carrito");
      }
    }

    const cartValidation = await this.validateCart({
      userId: data.userId,
      businessId: data.businessId,
      items: normalizedItems,
    });

    if (!cartValidation.ok) {
      const firstInvalidItem = cartValidation.items.find((item) => !item.ok);

      throw new Error(
        firstInvalidItem?.message ||
          "Hay productos sin stock suficiente en el carrito",
      );
    }

    // Mayorista descuenta LOCAL. Minorista/Price descuenta DEPÓSITO.
    const stockLocation = getStockLocationByCategory(customer.category);

    const saleResult = await saleService.create({
      userId: data.userId,
      businessId: data.businessId,
      clientId: customer.clientId,
      paymentMethod: data.paymentMethod || PaymentMethod.TRANSFERENCIA,
      receiptType: ReceiptType.TICKET,
      status: SaleStatus.PENDING,
      stockLocation,
      isWebSale: true,
      items: normalizedItems,
    });

    const sale = (saleResult as any).sale;

    const whatsappMessage = buildWhatsappMessage({
      sale,
      customer,
      customerNotes: data.customerNotes,
    });

    const whatsappUrl = buildWhatsappUrl(whatsappMessage);

    const whatsappApi = await whatsappService.sendTextMessage({
      to: customer.phone || "",
      message: whatsappMessage,
    });

    return {
      saleId: sale.id,
      status: sale.status,
      total: sale.total,
      whatsappMessage,
      whatsappUrl,
      missingWhatsappConfig: Boolean(whatsappApi.missingConfig) && !whatsappUrl,
      whatsappApi,
      sale,
    };
  },
};