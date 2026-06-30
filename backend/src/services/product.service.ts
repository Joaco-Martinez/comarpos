import prisma from "../prisma";
import {
  Prisma,
  ProductType,
  Location,
  MovementType,
  Product,
  SaleUnit,
} from "@prisma/client";
import type { Express } from "express";
import cloudinary from "../config/cloudinary";
import fs from "fs";
import alertService from "./alert.service";

function normalizeSku(raw: string): string {
  return raw.trim().replace(/['"]/g, "").replace(/\s+/g, "");
}

function toNumberOrNull(v: any) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNumberOrZero(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isValidPositiveNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isTrue(value: any) {
  return value === true || value === "true";
}

function safeDeleteLocalFile(path?: string) {
  if (path && fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

type ProductComponentInput = {
  componentId?: string;
  productId?: string;
  quantity?: number | string;
  quantityKg?: number | string;
};

type GetProductsOptions = {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  sort?: string;
};

const DEFAULT_IVA_PORCENTAJE = 21;

type StockMovementVisualType = "INGRESS" | "EGRESS" | "TRANSFER";

type GetStockMovementsFilters = {
  productId?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  movement?: StockMovementVisualType | "ALL";
  origin?: "CLIENT" | "INTERNAL" | "ALL";
  page?: number;
  limit?: number;
};

const STOCK_MOVEMENT_VISUAL_META: Record<
  StockMovementVisualType,
  {
    group: StockMovementVisualType;
    label: string;
    color: "green" | "red" | "blue";
    hex: string;
    description: string;
  }
> = {
  INGRESS: {
    group: "INGRESS",
    label: "Ingreso de stock",
    color: "green",
    hex: "#16a34a",
    description: "Stock que entra al sistema o vuelve por una cancelación",
  },
  EGRESS: {
    group: "EGRESS",
    label: "Salida de stock",
    color: "red",
    hex: "#dc2626",
    description: "Stock que sale por venta o ajuste negativo",
  },
  TRANSFER: {
    group: "TRANSFER",
    label: "Movimiento entre depósitos",
    color: "blue",
    hex: "#2563eb",
    description: "Stock movido entre Mayorista y Minorista",
  },
};

const stockMovementInclude = {
  product: {
    include: {
      category: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.StockMovementInclude;

function cleanString(value?: string | null) {
  const v = String(value ?? "").trim();
  return v.length ? v : undefined;
}

function normalizePositiveInteger(value: any, fallback: number, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function getStockMovementVisualMeta(movement: {
  type: MovementType;
  from?: Location | null;
  to?: Location | null;
}) {
  if (movement.type === MovementType.TRANSFER) {
    return STOCK_MOVEMENT_VISUAL_META.TRANSFER;
  }

  if (
    movement.type === MovementType.INGRESS ||
    movement.type === MovementType.SALE_CANCEL
  ) {
    return STOCK_MOVEMENT_VISUAL_META.INGRESS;
  }

  if (movement.type === MovementType.SALE) {
    return STOCK_MOVEMENT_VISUAL_META.EGRESS;
  }

  // Fallback para ADJUSTMENT u otros movimientos viejos:
  // si tiene origen y no destino, salió; si tiene destino y no origen, entró.
  if (movement.from && !movement.to) return STOCK_MOVEMENT_VISUAL_META.EGRESS;
  if (!movement.from && movement.to) return STOCK_MOVEMENT_VISUAL_META.INGRESS;
  if (movement.from && movement.to) return STOCK_MOVEMENT_VISUAL_META.TRANSFER;

  return STOCK_MOVEMENT_VISUAL_META.EGRESS;
}

function getMovementTypeWhere(
  movement?: StockMovementVisualType | "ALL",
): Prisma.StockMovementWhereInput | undefined {
  if (!movement || movement === "ALL") return undefined;

  if (movement === "TRANSFER") {
    return {
      OR: [
        { type: MovementType.TRANSFER },
        {
          AND: [{ from: { not: null } }, { to: { not: null } }],
        },
      ],
    };
  }

  if (movement === "INGRESS") {
    return {
      OR: [
        { type: MovementType.INGRESS },
        { type: MovementType.SALE_CANCEL },
        {
          AND: [{ from: null }, { to: { not: null } }],
        },
      ],
    };
  }

  return {
    OR: [
      { type: MovementType.SALE },
      {
        AND: [{ from: { not: null } }, { to: null }],
      },
    ],
  };
}

function buildStockMovementWhere(
  businessId: string,
  filters?: GetStockMovementsFilters,
) {
  const and: Prisma.StockMovementWhereInput[] = [{ businessId }];

  if (filters?.productId) and.push({ productId: filters.productId });
  if (filters?.userId) and.push({ userId: filters.userId });

  if (filters?.origin === "CLIENT") and.push({ isClientMovement: true });
  if (filters?.origin === "INTERNAL") and.push({ isClientMovement: false });

  const createdAt: Prisma.DateTimeFilter = {};
  if (filters?.fromDate) createdAt.gte = filters.fromDate;
  if (filters?.toDate) createdAt.lte = filters.toDate;
  if (Object.keys(createdAt).length > 0) and.push({ createdAt });

  const movementWhere = getMovementTypeWhere(filters?.movement);
  if (movementWhere) and.push(movementWhere);

  const search = cleanString(filters?.search);

  if (search) {
    and.push({
      OR: [
        { reason: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        {
          product: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                {
                  category: {
                    is: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              ],
            },
          },
        },
        {
          user: {
            is: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

function formatStockMovementForView<T extends Record<string, any>>(
  movement: T,
) {
  const meta = getStockMovementVisualMeta({
    type: movement.type,
    from: movement.from,
    to: movement.to,
  });

  const quantity = movement.quantity ?? null;
  const quantityKg = movement.quantityKg ?? null;

  return {
    ...movement,
    movementGroup: meta.group,
    movementLabel: meta.label,
    movementColor: meta.color,
    movementHex: meta.hex,
    movementDescription: meta.description,
    quantityLabel:
      quantityKg !== null && quantityKg !== undefined
        ? `${quantityKg} kg`
        : quantity !== null && quantity !== undefined
          ? String(quantity)
          : "—",
  };
}

type CreateProductInput = {
  name: string;
  description?: string | null;

  type?: ProductType;
  price?: number | string;
  wholesalePrice?: number | string;
  clientPrice?: number | string;
  purchasePrice?: number | string;
  isService?: boolean | string;
  ivaPorcentaje?: number | string;

  categoryId?: string;
  category?: string;

  saleUnit?: SaleUnit | "UNIT" | "KG";
  pricePerKg?: number | string;
  clientPricePerKg?: number | string;
  wholesalePricePerKg?: number | string;
  stockLocalKg?: number | string;
  stockDepositoKg?: number | string;
  minStockKg?: number | string;
  minStockDepositoKg?: number | string;

  sku: string;

  minStock?: number | string;
  minStockDeposito?: number | string;
  stockLocal?: number | string;
  stockDeposito?: number | string;

  file?: Express.Multer.File;

  components?: ProductComponentInput[];
  boxContents?: { productId: string; quantity: number; quantityKg?: number }[];
};

function normalizeComponents(
  data: CreateProductInput | any,
): ProductComponentInput[] {
  if (Array.isArray(data.components)) return data.components;

  if (Array.isArray(data.boxContents)) {
    return data.boxContents.map((item: any) => ({
      componentId: item.productId,
      quantity: item.quantity,
      quantityKg: item.quantityKg,
    }));
  }

  return [];
}

async function validateCategory(categoryId?: string | null, businessId?: string) {
  if (!categoryId) return;

  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, ...(businessId ? { businessId } : {}) },
    select: { id: true, isActive: true },
  });

  if (!category) {
    throw new Error("La categoría seleccionada no existe");
  }

  if (!category.isActive) {
    throw new Error("La categoría seleccionada está inactiva");
  }
}

async function validateComponents(
  compositeId: string | null,
  components: ProductComponentInput[],
  businessId: string,
) {
  const normalized = components.map((c) => {
    const componentId = c.componentId ?? c.productId;

    return {
      componentId,
      quantity: toNumberOrNull(c.quantity),
      quantityKg: toNumberOrNull(c.quantityKg),
    };
  });

  const seen = new Set<string>();

  for (const c of normalized) {
    if (!c.componentId) {
      throw new Error("Cada componente debe tener componentId");
    }

    if (compositeId && c.componentId === compositeId) {
      throw new Error("Un producto no puede ser componente de sí mismo");
    }

    if (seen.has(c.componentId)) {
      throw new Error(
        "No podés repetir el mismo componente dentro de una promo",
      );
    }

    seen.add(c.componentId);

    const hasUnitQty = c.quantity !== null && c.quantity > 0;
    const hasKgQty = c.quantityKg !== null && c.quantityKg > 0;

    if (!hasUnitQty && !hasKgQty) {
      throw new Error(
        "Cada componente debe tener quantity o quantityKg mayor a 0",
      );
    }

    const componentProduct = await prisma.product.findFirst({
      where: { id: c.componentId, businessId },
      select: {
        id: true,
        name: true,
        type: true,
        saleUnit: true,
        isActive: true,
      },
    });

    if (!componentProduct) {
      throw new Error(`Componente ${c.componentId} no encontrado`);
    }

    if (!componentProduct.isActive) {
      throw new Error(`El componente "${componentProduct.name}" está inactivo`);
    }

    if (componentProduct.type === ProductType.COMPUESTO) {
      throw new Error(
        `El componente "${componentProduct.name}" es COMPUESTO. Por ahora no se permiten promos dentro de promos`,
      );
    }

    if (componentProduct.saleUnit === SaleUnit.UNIT && hasKgQty) {
      throw new Error(
        `El componente "${componentProduct.name}" se vende por unidad, no por KG`,
      );
    }

    if (componentProduct.saleUnit === SaleUnit.KG && hasUnitQty) {
      throw new Error(
        `El componente "${componentProduct.name}" se vende por KG, no por unidad`,
      );
    }
  }

  return normalized;
}

function validatePricesBySaleUnit(data: CreateProductInput | any) {
  if (isTrue(data.isService)) {
    return;
  }

  const saleUnit: SaleUnit = (data.saleUnit as SaleUnit) ?? SaleUnit.UNIT;
  const type: ProductType = (data.type as ProductType) ?? ProductType.SIMPLE;

  if (saleUnit === SaleUnit.KG) {
    const pricePerKg = toNumberOrNull(data.pricePerKg);
    const clientPricePerKg = toNumberOrNull(data.clientPricePerKg);
    const wholesalePricePerKg = toNumberOrNull(data.wholesalePricePerKg);

    if (pricePerKg === null) {
      throw new Error("Si saleUnit es KG, pricePerKg es requerido");
    }

    if (clientPricePerKg === null) {
      throw new Error("Si saleUnit es KG, clientPricePerKg es requerido");
    }

    if (wholesalePricePerKg === null) {
      throw new Error("Si saleUnit es KG, wholesalePricePerKg es requerido");
    }

    if (!isValidPositiveNumber(pricePerKg)) {
      throw new Error("Si saleUnit es KG, pricePerKg debe ser mayor a 0");
    }

    if (!isValidPositiveNumber(clientPricePerKg)) {
      throw new Error("Si saleUnit es KG, clientPricePerKg debe ser mayor a 0");
    }

    if (!isValidPositiveNumber(wholesalePricePerKg)) {
      throw new Error(
        "Si saleUnit es KG, wholesalePricePerKg debe ser mayor a 0",
      );
    }
  }

  if (saleUnit === SaleUnit.UNIT) {
    const price = toNumberOrNull(data.price);
    const clientPrice = toNumberOrNull(data.clientPrice);
    const wholesalePrice = toNumberOrNull(data.wholesalePrice);

    if (price === null) {
      throw new Error("Si saleUnit es UNIT, price es requerido");
    }

    if (clientPrice === null) {
      throw new Error("Si saleUnit es UNIT, clientPrice es requerido");
    }

    if (wholesalePrice === null) {
      throw new Error("Si saleUnit es UNIT, wholesalePrice es requerido");
    }

    if (!isValidPositiveNumber(price)) {
      throw new Error("Si saleUnit es UNIT, price debe ser mayor a 0");
    }

    if (!isValidPositiveNumber(clientPrice)) {
      throw new Error("Si saleUnit es UNIT, clientPrice debe ser mayor a 0");
    }

    if (!isValidPositiveNumber(wholesalePrice)) {
      throw new Error("Si saleUnit es UNIT, wholesalePrice debe ser mayor a 0");
    }
  }

  if (type === ProductType.COMPUESTO && saleUnit === SaleUnit.KG) {
    throw new Error(
      "Por ahora los productos COMPUESTOS deben venderse por UNIT",
    );
  }
}

const productInclude = {
  category: true,
  components: {
    include: {
      component: {
        include: {
          category: true,
        },
      },
    },
  },
  usedIn: {
    include: {
      composite: true,
    },
  },
};

export const productService = {
  async getAll(businessId: string, options?: GetProductsOptions) {
    const page = Number(options?.page);
    const limit = Number(options?.limit);

    const hasPagination =
      Number.isFinite(page) && Number.isFinite(limit) && page > 0 && limit > 0;

    const search = options?.search?.trim();
    const categoryId = options?.categoryId?.trim();
    const sort = options?.sort ?? "default";

    const where: any = {
      businessId,
      isActive: true,
    };

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          sku: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    let orderBy: any = {
      createdAt: "desc",
    };

    if (sort === "name-asc") {
      orderBy = {
        name: "asc",
      };
    }

    if (sort === "name-desc") {
      orderBy = {
        name: "desc",
      };
    }

    if (sort === "category-asc") {
      orderBy = [
        {
          category: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ];
    }

    if (sort === "category-desc") {
      orderBy = [
        {
          category: {
            name: "desc",
          },
        },
        {
          name: "asc",
        },
      ];
    }

    if (!hasPagination) {
      return prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
      });
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip,
        take: safeLimit,
      }),

      prisma.product.count({
        where,
      }),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  },

  async getBySku(rawSku: string, businessId: string) {
    const sku = normalizeSku(rawSku);

    return prisma.product.findUnique({
      where: { businessId_sku: { businessId, sku } },
      include: productInclude,
    });
  },

  async getById(id: string, businessId: string) {
    return prisma.product.findFirst({
      where: { id, businessId },
      include: productInclude,
    });
  },

  async create(data: CreateProductInput, businessId: string) {
    if (!data.name || !data.name.trim()) {
      return {
        statusCode: 400,
        message: "El nombre del producto es requerido",
      };
    }

    if (!data.sku || !data.sku.trim()) {
      return { statusCode: 400, message: "El SKU es requerido" };
    }

    const sku = normalizeSku(data.sku);

    if (!sku) {
      return { statusCode: 400, message: "El SKU no puede quedar vacío" };
    }

    const type: ProductType = (data.type as ProductType) ?? ProductType.SIMPLE;
    const saleUnit: SaleUnit = (data.saleUnit as SaleUnit) ?? SaleUnit.UNIT;

    let imageUrl: string | undefined;
    let imageId: string | undefined;

    try {
      await validateCategory(data.categoryId, businessId);

      validatePricesBySaleUnit({
        ...data,
        type,
        saleUnit,
      });

      const rawComponents = normalizeComponents(data);

      if (type === ProductType.COMPUESTO && rawComponents.length === 0) {
        safeDeleteLocalFile(data.file?.path);

        return {
          statusCode: 400,
          message: "Un producto COMPUESTO debe tener al menos un componente",
        };
      }

      if (type === ProductType.SIMPLE && rawComponents.length > 0) {
        safeDeleteLocalFile(data.file?.path);

        return {
          statusCode: 400,
          message: "Un producto SIMPLE no puede tener componentes",
        };
      }

      const components = await validateComponents(null, rawComponents, businessId);

      if (data.file) {
        const result = await cloudinary.uploader.upload(data.file.path, {
          folder: "comarpos/products",
          resource_type: "image",
        });

        imageUrl = result.secure_url;
        imageId = result.public_id;

        safeDeleteLocalFile(data.file.path);
      }

      const base = {
        businessId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        type,
        categoryId: data.categoryId || null,
        saleUnit,
        sku,
        isService: isTrue(data.isService),
        minStock: toNumberOrNull(data.minStock),
        minStockDeposito: toNumberOrNull(data.minStockDeposito),
        minStockKg: toNumberOrNull(data.minStockKg),
        minStockDepositoKg: toNumberOrNull(data.minStockDepositoKg),
        purchasePrice: toNumberOrZero(data.purchasePrice),
        ivaPorcentaje:
          data.ivaPorcentaje !== undefined && data.ivaPorcentaje !== null && data.ivaPorcentaje !== ""
            ? Number(data.ivaPorcentaje)
            : DEFAULT_IVA_PORCENTAJE,
        imageUrl,
        imageId,
      };

      const unitData =
        saleUnit === SaleUnit.UNIT
          ? {
              price: toNumberOrZero(data.price),
              clientPrice: toNumberOrZero(data.clientPrice),
              wholesalePrice: toNumberOrZero(data.wholesalePrice),
              stockLocal: toNumberOrZero(data.stockLocal),
              stockDeposito: toNumberOrZero(data.stockDeposito),

              pricePerKg: null,
              clientPricePerKg: null,
              wholesalePricePerKg: null,
              stockLocalKg: 0,
              stockDepositoKg: 0,
            }
          : {
              pricePerKg: toNumberOrZero(data.pricePerKg),
              clientPricePerKg: toNumberOrZero(data.clientPricePerKg),
              wholesalePricePerKg: toNumberOrZero(data.wholesalePricePerKg),
              stockLocalKg: toNumberOrZero(data.stockLocalKg),
              stockDepositoKg: toNumberOrZero(data.stockDepositoKg),

              price: 0,
              clientPrice: 0,
              wholesalePrice: 0,
              stockLocal: 0,
              stockDeposito: 0,
            };

      const created = await prisma.product.create({
        data: {
          ...base,
          ...unitData,
          ...(type === ProductType.COMPUESTO
            ? {
                components: {
                  create: components.map((component) => ({
                    businessId,
                    componentId: component.componentId!,
                    quantity: component.quantity,
                    quantityKg: component.quantityKg,
                  })),
                },
              }
            : {}),
        },
        include: productInclude,
      });

      await alertService.checkProductStock(created.id);

      return created;
    } catch (err: any) {
      safeDeleteLocalFile(data.file?.path);

      if (imageId) {
        await cloudinary.uploader.destroy(imageId).catch(() => undefined);
      }

      if (err?.code === "P2002" && err?.meta?.target?.includes("sku")) {
        return {
          statusCode: 409,
          message: "Ya existe un producto con ese SKU",
        };
      }

      return {
        statusCode: 400,
        message: err?.message ?? "Error al crear producto",
      };
    }
  },

  async updateImage(productId: string, file: Express.Multer.File) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      safeDeleteLocalFile(file?.path);
      throw new Error("Producto no encontrado");
    }

    let newImageId: string | undefined;

    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "comarpos/products",
        resource_type: "image",
      });

      newImageId = result.public_id;

      safeDeleteLocalFile(file.path);

      if (product.imageId) {
        await cloudinary.uploader
          .destroy(product.imageId)
          .catch(() => undefined);
      }

      return prisma.product.update({
        where: { id: productId },
        data: {
          imageUrl: result.secure_url,
          imageId: result.public_id,
        },
        include: productInclude,
      });
    } catch (err) {
      safeDeleteLocalFile(file?.path);

      if (newImageId) {
        await cloudinary.uploader.destroy(newImageId).catch(() => undefined);
      }

      throw err;
    }
  },

  async update(id: string, data: Partial<Product> & any, businessId: string) {
    const existing = await prisma.product.findFirst({
      where: { id, businessId },
      include: {
        components: true,
      },
    });

    if (!existing) {
      throw new Error("Producto no encontrado");
    }

    if (data.sku !== undefined) {
      const normalized = normalizeSku(String(data.sku));
      if (!normalized) throw new Error("El SKU no puede quedar vacío");
      data.sku = normalized;
    }

    if (
      data.categoryId !== undefined &&
      data.categoryId !== null &&
      data.categoryId !== ""
    ) {
      await validateCategory(data.categoryId, businessId);
    }

    const nextType = (data.type as ProductType | undefined) ?? existing.type;
    const nextSaleUnit =
      (data.saleUnit as SaleUnit | undefined) ?? existing.saleUnit;

    if (nextType === ProductType.COMPUESTO && nextSaleUnit === SaleUnit.KG) {
      throw new Error(
        "Por ahora los productos COMPUESTOS deben venderse por UNIT",
      );
    }

    const prismaData: any = {};

    const setIfDefined = (key: string, value: any) => {
      if (value !== undefined) prismaData[key] = value;
    };

    setIfDefined(
      "name",
      data.name !== undefined ? String(data.name).trim() : undefined,
    );

    setIfDefined(
      "description",
      data.description !== undefined
        ? String(data.description).trim() || null
        : undefined,
    );

    setIfDefined("type", data.type);
    setIfDefined("categoryId", data.categoryId === "" ? null : data.categoryId);
    setIfDefined("sku", data.sku);
    setIfDefined("imageUrl", data.imageUrl);
    setIfDefined("imageId", data.imageId);
    setIfDefined("isActive", data.isActive);
    setIfDefined(
      "isService",
      data.isService !== undefined ? isTrue(data.isService) : undefined,
    );
    setIfDefined("saleUnit", data.saleUnit);

    setIfDefined(
      "price",
      data.price !== undefined ? Number(data.price) : undefined,
    );

    setIfDefined(
      "clientPrice",
      data.clientPrice !== undefined ? Number(data.clientPrice) : undefined,
    );

    setIfDefined(
      "wholesalePrice",
      data.wholesalePrice !== undefined
        ? Number(data.wholesalePrice)
        : undefined,
    );

    setIfDefined(
      "purchasePrice",
      data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined,
    );

    setIfDefined(
      "ivaPorcentaje",
      data.ivaPorcentaje !== undefined ? Number(data.ivaPorcentaje) : undefined,
    );

    setIfDefined(
      "stockLocal",
      data.stockLocal !== undefined ? Number(data.stockLocal) : undefined,
    );

    setIfDefined(
      "stockDeposito",
      data.stockDeposito !== undefined ? Number(data.stockDeposito) : undefined,
    );

    setIfDefined(
      "minStock",
      data.minStock !== undefined ? Number(data.minStock) : undefined,
    );

    setIfDefined(
      "minStockDeposito",
      data.minStockDeposito !== undefined
        ? Number(data.minStockDeposito)
        : undefined,
    );

    setIfDefined(
      "pricePerKg",
      data.pricePerKg !== undefined ? Number(data.pricePerKg) : undefined,
    );

    setIfDefined(
      "clientPricePerKg",
      data.clientPricePerKg !== undefined
        ? Number(data.clientPricePerKg)
        : undefined,
    );

    setIfDefined(
      "wholesalePricePerKg",
      data.wholesalePricePerKg !== undefined
        ? Number(data.wholesalePricePerKg)
        : undefined,
    );

    setIfDefined(
      "stockLocalKg",
      data.stockLocalKg !== undefined ? Number(data.stockLocalKg) : undefined,
    );

    setIfDefined(
      "stockDepositoKg",
      data.stockDepositoKg !== undefined
        ? Number(data.stockDepositoKg)
        : undefined,
    );

    setIfDefined(
      "minStockKg",
      data.minStockKg !== undefined ? Number(data.minStockKg) : undefined,
    );

    setIfDefined(
      "minStockDepositoKg",
      data.minStockDepositoKg !== undefined
        ? Number(data.minStockDepositoKg)
        : undefined,
    );

    if (data.saleUnit === SaleUnit.UNIT) {
      prismaData.pricePerKg = null;
      prismaData.clientPricePerKg = null;
      prismaData.wholesalePricePerKg = null;
      prismaData.stockLocalKg = 0;
      prismaData.stockDepositoKg = 0;
    }

    if (data.saleUnit === SaleUnit.KG) {
      prismaData.price = 0;
      prismaData.clientPrice = 0;
      prismaData.wholesalePrice = 0;
      prismaData.stockLocal = 0;
      prismaData.stockDeposito = 0;
    }

    try {
      const updated = await prisma.product.update({
        where: { id },
        data: prismaData,
        include: productInclude,
      });

      await alertService.checkProductStock(updated.id);

      return updated;
    } catch (err: any) {
      if (err?.code === "P2002" && err?.meta?.target?.includes("sku")) {
        throw new Error("Ya existe un producto con ese SKU");
      }

      throw err;
    }
  },

  async updateComponents(
    productId: string,
    components: ProductComponentInput[],
    businessId: string,
  ) {
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true,
        type: true,
        name: true,
        saleUnit: true,
      },
    });

    if (!product) throw new Error("Producto no encontrado");

    if (product.type !== ProductType.COMPUESTO) {
      throw new Error(`El producto "${product.name}" no es de tipo COMPUESTO`);
    }

    const normalizedComponents = await validateComponents(
      productId,
      components,
      businessId,
    );

    await prisma.$transaction([
      prisma.productComponent.deleteMany({
        where: { compositeId: productId },
      }),
      prisma.productComponent.createMany({
        data: normalizedComponents.map((component) => ({
          businessId,
          compositeId: productId,
          componentId: component.componentId!,
          quantity: component.quantity,
          quantityKg: component.quantityKg,
        })),
      }),
    ]);

    return prisma.product.findFirst({
      where: { id: productId, businessId },
      include: productInclude,
    });
  },

  async delete(id: string, businessId: string) {
    const existing = await prisma.product.findFirst({
      where: { id, businessId },
      select: { id: true },
    });

    if (!existing) throw new Error("Producto no encontrado");

    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async transferStock(
    productId: string,
    from: Location,
    quantity: number,
    userId: string,
    businessId: string,
  ) {
    if (!userId)
      throw new Error("Falta userId en la operación de transferencia");

    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Cantidad inválida");
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    });

    if (!product) throw new Error("Producto no encontrado");

    if (product.saleUnit !== SaleUnit.UNIT) {
      throw new Error("Este producto no se maneja por unidades");
    }

    if (product.type === ProductType.COMPUESTO) {
      throw new Error(
        "No se transfiere stock directo de productos compuestos. Transferí sus componentes",
      );
    }

    const to = from === Location.DEPOSITO ? Location.LOCAL : Location.DEPOSITO;

    if (from === Location.DEPOSITO && product.stockDeposito < qty) {
      throw new Error("Stock insuficiente en depósito");
    }

    if (from === Location.LOCAL && product.stockLocal < qty) {
      throw new Error("Stock insuficiente en local");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const productUpdated = await tx.product.update({
        where: { id: productId },
        data:
          from === Location.DEPOSITO
            ? {
                stockDeposito: { decrement: qty },
                stockLocal: { increment: qty },
              }
            : {
                stockLocal: { decrement: qty },
                stockDeposito: { increment: qty },
              },
      });

      await tx.stockMovement.create({
        data: {
          business: { connect: { id: businessId } },
          type: MovementType.TRANSFER,
          from,
          to,
          quantity: qty,
          product: { connect: { id: productId } },
          user: { connect: { id: userId } },
        },
      });

      return productUpdated;
    });

    await alertService.checkProductStock(updated.id);

    return updated;
  },

  async transferStockKg(
    productId: string,
    from: Location,
    quantityKg: number,
    userId: string,
    businessId: string,
  ) {
    if (!userId)
      throw new Error("Falta userId en la operación de transferencia");

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    });

    if (!product) throw new Error("Producto no encontrado");

    if (product.saleUnit !== SaleUnit.KG) {
      throw new Error("Este producto no es por KG");
    }

    if (product.type === ProductType.COMPUESTO) {
      throw new Error(
        "No se transfiere stock directo de productos compuestos. Transferí sus componentes",
      );
    }

    const qty = Number(quantityKg);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Cantidad KG inválida");
    }

    const to = from === Location.DEPOSITO ? Location.LOCAL : Location.DEPOSITO;

    if (from === Location.DEPOSITO && (product.stockDepositoKg ?? 0) < qty) {
      throw new Error("Stock insuficiente en depósito KG");
    }

    if (from === Location.LOCAL && (product.stockLocalKg ?? 0) < qty) {
      throw new Error("Stock insuficiente en local KG");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const productUpdated = await tx.product.update({
        where: { id: productId },
        data:
          from === Location.DEPOSITO
            ? {
                stockDepositoKg: { decrement: qty },
                stockLocalKg: { increment: qty },
              }
            : {
                stockLocalKg: { decrement: qty },
                stockDepositoKg: { increment: qty },
              },
      });

      await tx.stockMovement.create({
        data: {
          business: { connect: { id: businessId } },
          type: MovementType.TRANSFER,
          from,
          to,
          quantityKg: qty,
          product: { connect: { id: productId } },
          user: { connect: { id: userId } },
        },
      });

      return productUpdated;
    });

    await alertService.checkProductStock(updated.id);

    return updated;
  },

  async addStockKg(
    productId: string,
    to: Location,
    quantityKg: number,
    userId: string,
    businessId: string,
  ) {
    if (!userId) throw new Error("Falta userId en la operación de ingreso");

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    });

    if (!product) throw new Error("Producto no encontrado");

    if (product.saleUnit !== SaleUnit.KG) {
      throw new Error("Este producto no es por KG");
    }

    if (product.type === ProductType.COMPUESTO) {
      throw new Error(
        "No se agrega stock directo a productos compuestos. Agregá stock a sus componentes",
      );
    }

    const qty = Number(quantityKg);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Cantidad KG inválida");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const productUpdated = await tx.product.update({
        where: { id: productId },
        data: {
          stockLocalKg: to === Location.LOCAL ? { increment: qty } : undefined,
          stockDepositoKg:
            to === Location.DEPOSITO ? { increment: qty } : undefined,
        },
      });

      await tx.stockMovement.create({
        data: {
          businessId,
          productId,
          userId,
          type: MovementType.INGRESS,
          from: null,
          to,
          quantityKg: qty,
        },
      });

      return productUpdated;
    });

    await alertService.checkProductStock(updated.id);

    return updated;
  },

  async addStock(
    productId: string,
    to: Location,
    quantity: number,
    userId: string,
    businessId: string,
  ) {
    if (!userId) throw new Error("Falta userId en la operación de ingreso");

    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Cantidad inválida");
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, businessId },
    });

    if (!product) throw new Error("Producto no encontrado");

    if (product.saleUnit !== SaleUnit.UNIT) {
      throw new Error("Este producto no se maneja por unidades");
    }

    if (product.type === ProductType.COMPUESTO) {
      throw new Error(
        "No se agrega stock directo a productos compuestos. Agregá stock a sus componentes",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const productUpdated = await tx.product.update({
        where: { id: productId },
        data: {
          stockLocal: to === Location.LOCAL ? { increment: qty } : undefined,
          stockDeposito:
            to === Location.DEPOSITO ? { increment: qty } : undefined,
        },
      });

      await tx.stockMovement.create({
        data: {
          businessId,
          productId,
          userId,
          type: MovementType.INGRESS,
          from: null,
          to,
          quantity: qty,
        },
      });

      return productUpdated;
    });

    await alertService.checkProductStock(updated.id);

    return updated;
  },

  async getMovements(businessId: string, filters?: GetStockMovementsFilters) {
    const where = buildStockMovementWhere(businessId, filters);

    const hasPagination =
      filters?.page !== undefined || filters?.limit !== undefined;

    if (!hasPagination) {
      const movements = await prisma.stockMovement.findMany({
        where,
        include: stockMovementInclude,
        orderBy: {
          createdAt: "desc",
        },
        take: 250,
      });

      return movements.map(formatStockMovementForView);
    }

    const page = normalizePositiveInteger(filters?.page, 1, 100000);
    const limit = normalizePositiveInteger(filters?.limit, 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: stockMovementInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return {
      data: items.map(formatStockMovementForView),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  async searchMovements(businessId: string, filters?: GetStockMovementsFilters) {
    return this.getMovements(businessId, {
      ...filters,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 20,
    });
  },

  async getMovementsOverview(
    businessId: string,
    filters?: Omit<GetStockMovementsFilters, "movement" | "page"> & {
      limit?: number;
    },
  ) {
    const limit = normalizePositiveInteger(filters?.limit, 5, 30);

    const baseFilters = {
      productId: filters?.productId,
      userId: filters?.userId,
      fromDate: filters?.fromDate,
      toDate: filters?.toDate,
      search: filters?.search,
      origin: filters?.origin,
    };

    const ingressWhere = buildStockMovementWhere(businessId, {
      ...baseFilters,
      movement: "INGRESS",
    });

    const egressWhere = buildStockMovementWhere(businessId, {
      ...baseFilters,
      movement: "EGRESS",
    });

    const transferWhere = buildStockMovementWhere(businessId, {
      ...baseFilters,
      movement: "TRANSFER",
    });

    const [
      ingressItems,
      egressItems,
      transferItems,
      ingressTotal,
      egressTotal,
      transferTotal,
    ] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where: ingressWhere,
        include: stockMovementInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.stockMovement.findMany({
        where: egressWhere,
        include: stockMovementInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.stockMovement.findMany({
        where: transferWhere,
        include: stockMovementInclude,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.stockMovement.count({ where: ingressWhere }),
      prisma.stockMovement.count({ where: egressWhere }),
      prisma.stockMovement.count({ where: transferWhere }),
    ]);

    return {
      limit,
      summary: {
        ingress: {
          ...STOCK_MOVEMENT_VISUAL_META.INGRESS,
          total: ingressTotal,
        },
        egress: {
          ...STOCK_MOVEMENT_VISUAL_META.EGRESS,
          total: egressTotal,
        },
        transfer: {
          ...STOCK_MOVEMENT_VISUAL_META.TRANSFER,
          total: transferTotal,
        },
      },
      ingress: {
        ...STOCK_MOVEMENT_VISUAL_META.INGRESS,
        total: ingressTotal,
        items: ingressItems.map(formatStockMovementForView),
      },
      egress: {
        ...STOCK_MOVEMENT_VISUAL_META.EGRESS,
        total: egressTotal,
        items: egressItems.map(formatStockMovementForView),
      },
      transfer: {
        ...STOCK_MOVEMENT_VISUAL_META.TRANSFER,
        total: transferTotal,
        items: transferItems.map(formatStockMovementForView),
      },
    };
  },
};
