import prisma from "../prisma";
import {
  RemitoMode,
  RemitoStatus,
  SaleStatus,
  SaleUnit,
} from "@prisma/client";
import {
  RemitoPDFData,
  generateRemitoPDFBuffer,
} from "./remitoPdf.service";
import { startOfDayAR, endOfDayAR } from "../utils/dateAR";

type CreateRemitoFromSaleInput = {
  saleId: string;
  businessId: string;
  userId?: string;

  placeOfIssue?: string | null;
  saleCondition?: string | null;

  transportName?: string | null;
  transportCuit?: string | null;

  packagesCount?: number | null;
  declaredValue?: number | null;
  observations?: string | null;
};

function buildFullNumber(pointOfSale: number, number: number) {
  return `${String(pointOfSale).padStart(4, "0")}-${String(number).padStart(
    8,
    "0"
  )}`;
}

function buildAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").trim() || null;
}

function buildClientFullName(client?: {
  nombre?: string | null;
  apellido?: string | null;
} | null) {
  if (!client) return "CONSUMIDOR FINAL";

  const fullName = [client.nombre, client.apellido].filter(Boolean).join(" ");
  return fullName || "CONSUMIDOR FINAL";
}

function getClientAddress(client?: any | null) {
  if (!client) return null;

  return buildAddress([
    client.addressStreet,
    client.addressNumber,
    client.addressFloor ? `Piso ${client.addressFloor}` : null,
    client.addressApartment ? `Dpto ${client.addressApartment}` : null,
  ]);
}

function getClientLocality(client?: any | null) {
  if (!client) return null;

  return [client.addressCity, client.addressProvince]
    .filter(Boolean)
    .join(" - ");
}

function getBusinessLocationAddress(location?: any | null) {
  if (!location) return null;

  return buildAddress([
    location.addressStreet,
    location.addressNumber,
    location.addressCity,
    location.addressProvince,
  ]);
}

function getClientIvaCondition(client?: any | null) {
  if (!client) return "CONSUMIDOR FINAL";

  if (client.category === "Mayorista") return "IVA RESPONSABLE INSCRIPTO";
  if (client.category === "Cliente") return "CONSUMIDOR FINAL";

  return "CONSUMIDOR FINAL";
}

function normalizeOptionalString(value?: string | null) {
  const clean = String(value ?? "").trim();
  return clean.length ? clean : null;
}

function assertCanCreateRemito(sale: {
  status: SaleStatus;
  isInvoiced: boolean;
}) {
  const isAccepted = sale.status === SaleStatus.COMPLETED;
  const isInvoiced = sale.isInvoiced === true;

  if (!isAccepted && !isInvoiced) {
    throw new Error(
      "No se puede emitir remito: la venta debe estar facturada o aceptada."
    );
  }
}

function mapRemitoToPdfData(remito: any): RemitoPDFData {
  return {
    remito: {
      pointOfSale: remito.pointOfSale,
      number: remito.number,
      issueDate: remito.issueDate,
      placeOfIssue: remito.placeOfIssue,

      cai: remito.cai,
      caiExpiresAt: remito.caiExpiresAt,

      sellerName: remito.sellerName,
      saleCondition: remito.saleCondition,
      transportName: remito.transportName,
      packages: remito.packagesCount,
      declaredValue: remito.declaredValue,

      copyLabel: "ORIGINAL",
    },
    business: {
      businessName: remito.businessName || process.env.BUSINESS_NAME || "ComarPOS",
      fantasyName: remito.businessName || process.env.BUSINESS_NAME || "ComarPOS",
      cuit: remito.businessCuit || "",
      ivaCondition: remito.businessIvaCondition || "IVA RESPONSABLE INSCRIPTO",
      grossIncomeNumber: remito.businessIibb || "",
      activityStartDate: remito.businessActivityStart || null,
      fiscalAddress: remito.businessFiscalAddress || "",
      businessAddress: remito.businessAddress || "",
      locality: remito.placeOfIssue || "",
      province: "",
      phone: remito.businessPhone || "",
      email: remito.businessEmail || "",
      logoPath: null,
    },
    client: {
      name: remito.clientName || "CONSUMIDOR FINAL",
      address: remito.clientAddress || "",
      locality: remito.clientLocality || "",
      ivaCondition: remito.clientIvaCondition || "CONSUMIDOR FINAL",
      cuitOrDni: remito.clientCuit || remito.clientDni || "",
    },
    items: remito.items.map((item: any) => ({
      code: item.code || "",
      quantity: Number(item.quantity ?? 0),
      quantityKg: item.quantityKg,
      description: item.description,
    })),
  };
}

export const remitoService = {
  async createFromSale(input: CreateRemitoFromSaleInput) {
    const sale = await prisma.sale.findFirst({
      where: { id: input.saleId, businessId: input.businessId },
      include: {
        client: true,
        user: true,
        businessLocation: true,
        invoiceAfip: true,
        remitos: {
          where: {
            status: {
              not: RemitoStatus.CANCELLED,
            },
          },
          select: {
            id: true,
            fullNumber: true,
            status: true,
          },
        },
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

    assertCanCreateRemito(sale);

    if (sale.remitos.length > 0) {
      throw new Error(
        `Esta venta ya tiene un remito emitido: ${sale.remitos[0].fullNumber}`
      );
    }

    if (!sale.items.length) {
      throw new Error("La venta no tiene productos para remitir");
    }

    const now = new Date();

    const createdRemito = await prisma.$transaction(async (tx) => {
      const arcaConfig = await tx.arcaConfig.findFirst({
        where: {
          businessId: input.businessId,
          isActive: true,
        },
        include: {
          remitoCais: {
            where: {
              enabled: true,
              expiresAt: {
                gte: now,
              },
            },
            orderBy: {
              expiresAt: "asc",
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (!arcaConfig) {
        throw new Error(
          "No hay configuración ARCA activa. Cargá primero los datos fiscales del negocio."
        );
      }

      const remitoCai = arcaConfig.remitoCais[0];

      if (!remitoCai) {
        throw new Error(
          "No hay CAI activo para remitos. Cargá CAI, vencimiento y numeración en configuración ARCA."
        );
      }

      const pointOfSale =
        remitoCai.pointOfSale || arcaConfig.defaultPointOfSale || 1;

      const nextNumber = remitoCai.nextNumber || remitoCai.rangeFrom || 1;

      if (remitoCai.rangeTo && nextNumber > remitoCai.rangeTo) {
        throw new Error(
          `El CAI de remitos agotó la numeración permitida. Último permitido: ${remitoCai.rangeTo}`
        );
      }

      const fullNumber = buildFullNumber(pointOfSale, nextNumber);

      const businessAddress =
        getBusinessLocationAddress(sale.businessLocation) ||
        arcaConfig.fiscalAddress ||
        null;

      const clientName = buildClientFullName(sale.client);

      const clientAddress =
        sale.deliveryAddressSnapshot || getClientAddress(sale.client);

      const remito = await tx.remito.create({
        data: {
          businessId: input.businessId,
          saleId: sale.id,
          clientId: sale.clientId,
          userId: input.userId || sale.userId || null,
          businessLocationId: sale.businessLocationId,

          arcaConfigId: arcaConfig.id,
          remitoCaiConfigId: remitoCai.id,

          status: RemitoStatus.ISSUED,
          mode: remitoCai.mode || RemitoMode.DIGITAL_FULL,

          pointOfSale,
          number: nextNumber,
          fullNumber,
          code: "91",

          issueDate: now,
          placeOfIssue:
            normalizeOptionalString(input.placeOfIssue) ||
            sale.businessLocation?.addressCity ||
            "VILLA GENERAL BELGRANO",

          cai: remitoCai.cai,
          caiExpiresAt: remitoCai.expiresAt,
          caiRangeFrom: remitoCai.rangeFrom,
          caiRangeTo: remitoCai.rangeTo,

          businessName: arcaConfig.businessName || "ComarPOS",
          businessCuit: arcaConfig.cuit,
          businessIvaCondition:
            arcaConfig.ivaCondition || "IVA RESPONSABLE INSCRIPTO",
          businessIibb: arcaConfig.iibb,
          businessActivityStart: arcaConfig.activityStart,
          businessFiscalAddress: arcaConfig.fiscalAddress,
          businessAddress,
          businessEmail: process.env.BUSINESS_EMAIL || null,
          businessPhone: process.env.BUSINESS_PHONE || null,

          clientName,
          clientDni: sale.client?.dni || null,
          clientCuit: null,
          clientIvaCondition: getClientIvaCondition(sale.client),
          clientAddress,
          clientLocality: getClientLocality(sale.client),

          sellerName: sale.user?.name || null,
          saleCondition:
            normalizeOptionalString(input.saleCondition) ||
            String(sale.paymentMethod || ""),
          transportName:
            normalizeOptionalString(input.transportName) ||
            sale.transportName ||
            null,
          transportCuit:
            normalizeOptionalString(input.transportCuit) ||
            sale.transportCuit ||
            null,
          packagesCount:
            input.packagesCount !== undefined
              ? input.packagesCount
              : sale.packagesCount,
          declaredValue:
            input.declaredValue !== undefined
              ? input.declaredValue
              : sale.declaredValue || sale.total,
          observations: normalizeOptionalString(input.observations),

          items: {
            create: sale.items.map((item) => {
              const product = item.product;

              return {
                productId: item.productId,
                code: item.productSkuSnapshot || product?.sku || null,
                description:
                  item.productNameSnapshot || product?.name || "Producto",
                quantity:
                  product?.saleUnit === SaleUnit.KG ? null : item.quantity,
                quantityKg:
                  product?.saleUnit === SaleUnit.KG ? item.quantityKg : null,
                saleUnit: product?.saleUnit || SaleUnit.UNIT,
              };
            }),
          },
        },
        include: {
          items: true,
        },
      });

      await tx.remitoCaiConfig.update({
        where: { id: remitoCai.id },
        data: {
          nextNumber: nextNumber + 1,
        },
      });

      return remito;
    });

    const remitoFinal = await prisma.remito.findFirst({
      where: { id: createdRemito.id, businessId: input.businessId },
      include: {
        sale: true,
        client: true,
        user: true,
        businessLocation: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return remitoFinal;
  },

  async getPdfBuffer(id: string, businessId: string) {
  const remito = await prisma.remito.findFirst({
    where: { id, businessId },
    include: {
      items: true,
    },
  });

  if (!remito) {
    throw new Error("Remito no encontrado");
  }

  if (remito.status === RemitoStatus.CANCELLED) {
    throw new Error("No se puede descargar un remito cancelado");
  }

  const buffer = await generateRemitoPDFBuffer(mapRemitoToPdfData(remito));

  return {
    buffer,
    filename: `remito_${remito.fullNumber.replace("-", "_")}.pdf`,
  };
},

  async getAll(businessId: string, params?: {
    status?: RemitoStatus;
    clientId?: string;
    saleId?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = { businessId };

    if (params?.status) where.status = params.status;
    if (params?.clientId) where.clientId = params.clientId;
    if (params?.saleId) where.saleId = params.saleId;

    if (params?.from || params?.to) {
      where.issueDate = {};

      if (params.from) {
        where.issueDate.gte = startOfDayAR(params.from);
      }

      if (params.to) {
        where.issueDate.lte = endOfDayAR(params.to);
      }
    }

    return prisma.remito.findMany({
      where,
      orderBy: {
        issueDate: "desc",
      },
      include: {
        sale: true,
        client: true,
        user: true,
        businessLocation: true,
        items: true,
      },
    });
  },

  async getById(id: string, businessId: string) {
    const remito = await prisma.remito.findFirst({
      where: { id, businessId },
      include: {
        sale: true,
        client: true,
        user: true,
        businessLocation: true,
        arcaConfig: true,
        remitoCaiConfig: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!remito) {
      throw new Error("Remito no encontrado");
    }

    return remito;
  },


async regeneratePdf(id: string, businessId: string) {
  const remito = await prisma.remito.findFirst({
    where: { id, businessId },
    include: {
      sale: true,
      client: true,
      user: true,
      businessLocation: true,
      items: true,
    },
  });

  if (!remito) {
    throw new Error("Remito no encontrado");
  }

  if (remito.status === RemitoStatus.CANCELLED) {
    throw new Error("No se puede regenerar el PDF de un remito cancelado");
  }

  return remito;
},

  async markAsDelivered(id: string, businessId: string) {
    const remito = await prisma.remito.findFirst({
      where: { id, businessId },
    });

    if (!remito) {
      throw new Error("Remito no encontrado");
    }

    if (remito.status === RemitoStatus.CANCELLED) {
      throw new Error("No se puede entregar un remito cancelado");
    }

    return prisma.remito.update({
      where: { id: remito.id },
      data: {
        status: RemitoStatus.DELIVERED,
      },
      include: {
        sale: true,
        client: true,
        user: true,
        businessLocation: true,
        items: true,
      },
    });
  },

  async cancel(id: string, businessId: string) {
    const remito = await prisma.remito.findFirst({
      where: { id, businessId },
    });

    if (!remito) {
      throw new Error("Remito no encontrado");
    }

    if (remito.status === RemitoStatus.CANCELLED) {
      throw new Error("El remito ya está cancelado");
    }

    return prisma.remito.update({
      where: { id: remito.id },
      data: {
        status: RemitoStatus.CANCELLED,
      },
      include: {
        sale: true,
        client: true,
        user: true,
        businessLocation: true,
        items: true,
      },
    });
  },
};