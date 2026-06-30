import prisma from "../prisma";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function generateUniqueSlug(businessId: string, name: string, currentId?: string) {
  const baseSlug = slugify(name);

  if (!baseSlug) {
    throw new Error("No se pudo generar un slug válido para la categoría");
  }

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.productCategory.findUnique({
      where: { businessId_slug: { businessId, slug } },
      select: { id: true },
    });

    if (!existing || existing.id === currentId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export const categoryService = {
  async getAll(businessId: string, options?: { includeInactive?: boolean }) {
    return prisma.productCategory.findMany({
      where: options?.includeInactive
        ? { businessId }
        : { businessId, isActive: true },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  },

  async getById(id: string, businessId: string) {
    return prisma.productCategory.findFirst({
      where: { id, businessId },
      include: {
        products: {
          where: {
            isActive: true,
          },
          orderBy: {
            name: "asc",
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  },

  async getBySlug(slug: string, businessId: string) {
    return prisma.productCategory.findUnique({
      where: { businessId_slug: { businessId, slug } },
      include: {
        products: {
          where: {
            isActive: true,
          },
          orderBy: {
            name: "asc",
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  },

  async create(
    businessId: string,
    data: {
      name: string;
      description?: string | null;
      isActive?: boolean;
    }
  ) {
    if (!data.name || !data.name.trim()) {
      return {
        statusCode: 400,
        message: "El nombre de la categoría es requerido",
      };
    }

    const name = data.name.trim();
    const slug = await generateUniqueSlug(businessId, name);

    try {
      return await prisma.productCategory.create({
        data: {
          businessId,
          name,
          slug,
          description: data.description?.trim() || null,
          isActive: data.isActive ?? true,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return {
          statusCode: 409,
          message: "Ya existe una categoría con ese nombre o slug",
        };
      }

      throw err;
    }
  },

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.productCategory.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: "Categoría no encontrada",
      };
    }

    const prismaData: any = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        return {
          statusCode: 400,
          message: "El nombre de la categoría no puede estar vacío",
        };
      }

      prismaData.name = data.name.trim();
      prismaData.slug = await generateUniqueSlug(businessId, data.name.trim(), id);
    }

    if (data.description !== undefined) {
      prismaData.description = data.description?.trim() || null;
    }

    if (data.isActive !== undefined) {
      prismaData.isActive = data.isActive;
    }

    try {
      return await prisma.productCategory.update({
        where: { id },
        data: prismaData,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return {
          statusCode: 409,
          message: "Ya existe una categoría con ese nombre o slug",
        };
      }

      throw err;
    }
  },

  async delete(id: string, businessId: string) {
    const existing = await prisma.productCategory.findFirst({
      where: { id, businessId },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: "Categoría no encontrada",
      };
    }

    if (existing._count.products > 0) {
      return prisma.productCategory.update({
        where: { id },
        data: {
          isActive: false,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
    }

    return prisma.productCategory.delete({
      where: { id },
    });
  },

  async restore(id: string, businessId: string) {
    const existing = await prisma.productCategory.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return {
        statusCode: 404,
        message: "Categoría no encontrada",
      };
    }

    return prisma.productCategory.update({
      where: { id },
      data: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  },
};