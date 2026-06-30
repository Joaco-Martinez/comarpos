import prisma from "../prisma";

function cleanString(value?: string | null) {
  const text = String(value || "").trim();
  return text || null;
}

const supplierCounts = {
  _count: {
    select: {
      purchases: true,
      purchaseOrders: true,
      accountMovements: true,
    },
  },
};

export const supplierService = {
  async listSuppliers(businessId: string, includeInactive = false) {
    return prisma.supplier.findMany({
      where: {
        businessId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
      include: supplierCounts,
    });
  },

  async getSupplier(businessId: string, id: string) {
    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId },
      include: supplierCounts,
    });

    if (!supplier) throw new Error("Proveedor no encontrado");
    return supplier;
  },

  async createSupplier(
    businessId: string,
    data: {
      name: string;
      cuit?: string | null;
      contacto?: string | null;
      telefono?: string | null;
      email?: string | null;
      condicionPago?: string | null;
      notes?: string | null;
    }
  ) {
    const name = String(data.name || "").trim();
    if (!name) throw new Error("El nombre del proveedor es obligatorio");

    const cuit = cleanString(data.cuit);

    if (cuit) {
      const existing = await prisma.supplier.findFirst({
        where: { businessId, cuit },
      });
      if (existing) throw new Error("Ya existe un proveedor con ese CUIT");
    }

    return prisma.supplier.create({
      data: {
        businessId,
        name,
        cuit,
        contacto: cleanString(data.contacto),
        telefono: cleanString(data.telefono),
        email: cleanString(data.email),
        condicionPago: cleanString(data.condicionPago),
        notes: cleanString(data.notes),
        isActive: true,
      },
    });
  },

  async updateSupplier(
    businessId: string,
    id: string,
    data: Partial<{
      name: string;
      cuit: string | null;
      contacto: string | null;
      telefono: string | null;
      email: string | null;
      condicionPago: string | null;
      notes: string | null;
      isActive: boolean;
    }>
  ) {
    const existing = await prisma.supplier.findFirst({ where: { id, businessId } });
    if (!existing) throw new Error("Proveedor no encontrado");

    const cleanData: any = {};

    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new Error("El nombre del proveedor es obligatorio");
      cleanData.name = name;
    }

    if (data.cuit !== undefined) {
      const cuit = cleanString(data.cuit);

      if (cuit) {
        const duplicate = await prisma.supplier.findFirst({
          where: { businessId, cuit, id: { not: id } },
        });
        if (duplicate) throw new Error("Ya existe un proveedor con ese CUIT");
      }

      cleanData.cuit = cuit;
    }

    if (data.contacto !== undefined) cleanData.contacto = cleanString(data.contacto);
    if (data.telefono !== undefined) cleanData.telefono = cleanString(data.telefono);
    if (data.email !== undefined) cleanData.email = cleanString(data.email);
    if (data.condicionPago !== undefined) cleanData.condicionPago = cleanString(data.condicionPago);
    if (data.notes !== undefined) cleanData.notes = cleanString(data.notes);
    if (data.isActive !== undefined) cleanData.isActive = data.isActive;

    return prisma.supplier.update({
      where: { id },
      data: cleanData,
      include: supplierCounts,
    });
  },

  async deactivateSupplier(businessId: string, id: string) {
    const existing = await prisma.supplier.findFirst({ where: { id, businessId } });
    if (!existing) throw new Error("Proveedor no encontrado");

    return prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
