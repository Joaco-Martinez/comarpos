import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { BusinessPlan, BusinessStatus, Role } from "@prisma/client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const superAdminService = {
  // Listado global de negocios: intencionalmente sin filtro de businessId,
  // es la vista de plataforma completa (solo accesible por SUPER_ADMIN).
  async listBusinesses() {
    return prisma.business.findMany({ orderBy: { createdAt: "desc" } });
  },

  async getBusiness(id: string) {
    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) throw new Error("Negocio no encontrado");
    return business;
  },

  async createBusiness(data: {
    name: string;
    subdomain: string;
    cuit?: string;
    rubro?: string;
    plan?: BusinessPlan;
    slug?: string;
  }) {
    const name = String(data.name || "").trim();
    const subdomain = String(data.subdomain || "").trim().toLowerCase();

    if (!name) throw new Error("El nombre del negocio es obligatorio.");
    if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain)) {
      throw new Error("El subdominio es obligatorio y solo puede tener letras, números y guiones.");
    }

    const slug = data.slug ? slugify(data.slug) : slugify(name);

    const existingSubdomain = await prisma.business.findUnique({ where: { subdomain } });
    if (existingSubdomain) throw new Error("Ya existe un negocio con ese subdominio.");

    const existingSlug = await prisma.business.findUnique({ where: { slug } });
    if (existingSlug) throw new Error("Ya existe un negocio con ese slug.");

    return prisma.business.create({
      data: {
        name,
        slug,
        subdomain,
        cuit: data.cuit?.trim() || null,
        rubro: data.rubro?.trim() || null,
        plan: data.plan || BusinessPlan.BASICO,
        status: BusinessStatus.TRIAL,
        fechaAlta: new Date(),
      },
    });
  },

  async updateBusiness(
    id: string,
    data: {
      name?: string;
      cuit?: string | null;
      rubro?: string | null;
      plan?: BusinessPlan;
      modulosActivos?: string[];
    }
  ) {
    const existing = await prisma.business.findUnique({ where: { id } });
    if (!existing) throw new Error("Negocio no encontrado");

    return prisma.business.update({
      where: { id },
      data: {
        name: data.name?.trim() || undefined,
        cuit: data.cuit !== undefined ? data.cuit : undefined,
        rubro: data.rubro !== undefined ? data.rubro : undefined,
        plan: data.plan || undefined,
        modulosActivos: data.modulosActivos || undefined,
      },
    });
  },

  async setStatus(id: string, status: BusinessStatus) {
    const existing = await prisma.business.findUnique({ where: { id } });
    if (!existing) throw new Error("Negocio no encontrado");

    return prisma.business.update({ where: { id }, data: { status } });
  },

  async suspend(id: string) {
    return this.setStatus(id, BusinessStatus.SUSPENDED);
  },

  async activate(id: string) {
    return this.setStatus(id, BusinessStatus.ACTIVE);
  },

  // Marca el pago del mes: empuja próximoVencimiento un mes desde hoy (o
  // desde el vencimiento actual si todavía no venció). Reemplaza, por
  // ahora, una pasarela de pago real: es un proceso manual del super-admin.
  async markPaymentReceived(id: string) {
    const business = await prisma.business.findUnique({ where: { id } });
    if (!business) throw new Error("Negocio no encontrado");

    const base =
      business.proximoVencimiento && business.proximoVencimiento > new Date()
        ? business.proximoVencimiento
        : new Date();

    const proximoVencimiento = new Date(base);
    proximoVencimiento.setMonth(proximoVencimiento.getMonth() + 1);

    return prisma.business.update({
      where: { id },
      data: {
        proximoVencimiento,
        status: business.status === BusinessStatus.SUSPENDED ? BusinessStatus.ACTIVE : business.status,
      },
    });
  },

  // Usuarios SUPER_ADMIN son globales (businessId null), intencionalmente
  // fuera del filtro de tenant.
  async listSuperAdmins() {
    return prisma.user.findMany({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });
  },

  async createSuperAdmin(data: { email: string; password: string; name: string }) {
    const email = String(data.email || "").trim().toLowerCase();
    const password = String(data.password || "");
    const name = String(data.name || "").trim();

    if (!email) throw new Error("El email es obligatorio.");
    if (!password || password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    if (!name) throw new Error("El nombre es obligatorio.");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Ya existe un usuario con ese email.");

    const hashedPassword = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: Role.SUPER_ADMIN,
        businessId: null,
        isActive: true,
      },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });
  },

  async deactivateSuperAdmin(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== Role.SUPER_ADMIN) throw new Error("Usuario SUPER_ADMIN no encontrado.");

    return prisma.user.update({ where: { id }, data: { isActive: false } });
  },
};
