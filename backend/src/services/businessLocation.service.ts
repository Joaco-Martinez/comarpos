import prisma from "../prisma";
import { BusinessLocationType } from "@prisma/client";

function cleanString(value?: string | null) {
  const text = String(value || "").trim();
  return text || null;
}

type BusinessLocationInput = {
  name?: string;
  type?: BusinessLocationType;

  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  isDefault?: boolean;
  isActive?: boolean;
};

function buildLocationData(data: BusinessLocationInput) {
  const cleanData: any = {};

  if (data.name !== undefined) {
    cleanData.name = String(data.name || "").trim();
  }

  if (data.type !== undefined) {
    cleanData.type = data.type;
  }

  if (data.addressStreet !== undefined) {
    cleanData.addressStreet = cleanString(data.addressStreet);
  }

  if (data.addressNumber !== undefined) {
    cleanData.addressNumber = cleanString(data.addressNumber);
  }

  if (data.addressCity !== undefined) {
    cleanData.addressCity = cleanString(data.addressCity);
  }

  if (data.addressProvince !== undefined) {
    cleanData.addressProvince = cleanString(data.addressProvince);
  }

  if (data.addressPostalCode !== undefined) {
    cleanData.addressPostalCode = cleanString(data.addressPostalCode);
  }

  if (data.addressNotes !== undefined) {
    cleanData.addressNotes = cleanString(data.addressNotes);
  }

  if (data.latitude !== undefined) {
    cleanData.latitude = data.latitude ?? null;
  }

  if (data.longitude !== undefined) {
    cleanData.longitude = data.longitude ?? null;
  }

  if (data.isDefault !== undefined) {
    cleanData.isDefault = data.isDefault;
  }

  if (data.isActive !== undefined) {
    cleanData.isActive = data.isActive;
  }

  return cleanData;
}

function validateCoordinates(latitude?: number | null, longitude?: number | null) {
  if (latitude !== undefined && latitude !== null) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("La latitud debe estar entre -90 y 90");
    }
  }

  if (longitude !== undefined && longitude !== null) {
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("La longitud debe estar entre -180 y 180");
    }
  }
}

export const businessLocationService = {
  async create(data: BusinessLocationInput) {
    const name = String(data.name || "").trim();

    if (!name) {
      throw new Error("El nombre de la sucursal/depósito es obligatorio");
    }

    validateCoordinates(data.latitude, data.longitude);

    const cleanData = buildLocationData({
      ...data,
      name,
      type: data.type ?? BusinessLocationType.BRANCH,
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
    });

    return prisma.$transaction(async (tx) => {
      if (cleanData.isDefault === true) {
        await tx.businessLocation.updateMany({
          where: {
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      const existingCount = await tx.businessLocation.count();

      return tx.businessLocation.create({
        data: {
          ...cleanData,
          isDefault: existingCount === 0 ? true : cleanData.isDefault,
        },
      });
    });
  },

  async getAll(options?: { onlyActive?: boolean }) {
    return prisma.businessLocation.findMany({
      where:
        options?.onlyActive === true
          ? {
              isActive: true,
            }
          : undefined,
      orderBy: [
        {
          isDefault: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  },

  async getById(id: string) {
    return prisma.businessLocation.findUnique({
      where: {
        id,
      },
    });
  },

  async update(id: string, data: BusinessLocationInput) {
    const existing = await prisma.businessLocation.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new Error("Sucursal/depósito no encontrado");
    }

    validateCoordinates(data.latitude, data.longitude);

    const cleanData = buildLocationData(data);

    if (cleanData.name !== undefined && !cleanData.name) {
      throw new Error("El nombre de la sucursal/depósito es obligatorio");
    }

    return prisma.$transaction(async (tx) => {
      if (cleanData.isDefault === true) {
        await tx.businessLocation.updateMany({
          where: {
            isDefault: true,
            id: {
              not: id,
            },
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.businessLocation.update({
        where: {
          id,
        },
        data: cleanData,
      });
    });
  },

  async setDefault(id: string) {
    const existing = await prisma.businessLocation.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new Error("Sucursal/depósito no encontrado");
    }

    if (!existing.isActive) {
      throw new Error("No podés marcar como predeterminada una ubicación inactiva");
    }

    return prisma.$transaction(async (tx) => {
      await tx.businessLocation.updateMany({
        where: {
          isDefault: true,
          id: {
            not: id,
          },
        },
        data: {
          isDefault: false,
        },
      });

      return tx.businessLocation.update({
        where: {
          id,
        },
        data: {
          isDefault: true,
        },
      });
    });
  },

  async remove(id: string) {
    const existing = await prisma.businessLocation.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            sales: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Sucursal/depósito no encontrado");
    }

    if (existing._count.sales > 0) {
      return prisma.businessLocation.update({
        where: {
          id,
        },
        data: {
          isActive: false,
          isDefault: false,
        },
      });
    }

    return prisma.businessLocation.delete({
      where: {
        id,
      },
    });
  },
};