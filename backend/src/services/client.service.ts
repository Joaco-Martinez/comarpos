import prisma from "../prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { CategoryClient, Role } from "@prisma/client";
import { sendPasswordResetEmail } from "../utils/mailer";

type ClientCategory = "Price" | "Cliente" | "Mayorista";

const DEFAULT_CLIENT_PASSWORD =
  process.env.CLIENT_DEFAULT_PASSWORD || "ComarPOS123";

function normalizeCategory(value?: string | null): CategoryClient {
  if (value === "Mayorista") return CategoryClient.Mayorista;

  // Si llega "Cliente" desde algún frontend viejo, ahora lo tratamos como minorista.
  return CategoryClient.Price;
}

function cleanEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function cleanString(value?: string | null) {
  const text = String(value || "").trim();
  return text || null;
}

type ClientAddressData = {
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function buildAddressData(data: ClientAddressData) {
  const cleanData: any = {};

  if (data.addressStreet !== undefined) {
    cleanData.addressStreet = cleanString(data.addressStreet);
  }

  if (data.addressNumber !== undefined) {
    cleanData.addressNumber = cleanString(data.addressNumber);
  }

  if (data.addressFloor !== undefined) {
    cleanData.addressFloor = cleanString(data.addressFloor);
  }

  if (data.addressApartment !== undefined) {
    cleanData.addressApartment = cleanString(data.addressApartment);
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

  return cleanData;
}

const clientUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
};

export const clientService = {
  async createClient(
    data: {
      nombre: string;
      apellido: string;
      dni: string;
      category?: ClientCategory;
      telefono?: string | null;
      gmail?: string | null;
      creditLimit?: number | null;
      isAccountEnabled?: boolean;

      addressStreet?: string | null;
      addressNumber?: string | null;
      addressFloor?: string | null;
      addressApartment?: string | null;
      addressCity?: string | null;
      addressProvince?: string | null;
      addressPostalCode?: string | null;
      addressNotes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
    businessId: string
  ) {
    if (!businessId) throw new Error("No se pudo determinar el negocio (subdominio).");

    const nombre = String(data.nombre || "").trim();
    const apellido = String(data.apellido || "").trim();
    const dni = String(data.dni || "").trim();
    const gmail = cleanEmail(data.gmail);

    if (!nombre) throw new Error("El nombre es obligatorio");
    if (!apellido) throw new Error("El apellido es obligatorio");
    if (!dni) throw new Error("El DNI/CUIT es obligatorio");
    if (!gmail) {
      throw new Error(
        "El email es obligatorio para crear la cuenta de acceso del cliente"
      );
    }

    const category = normalizeCategory(data.category);
    const addressData = buildAddressData(data);

    return prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: gmail },
      });

      if (existingUser) {
        throw new Error("Ya existe un usuario con ese email");
      }

      const existingClientByDni = await tx.client.findUnique({
        where: { businessId_dni: { businessId, dni } },
      });

      if (existingClientByDni) {
        throw new Error("Ya existe un cliente con ese DNI/CUIT");
      }

      const existingClientByEmail = await tx.client.findUnique({
        where: { businessId_gmail: { businessId, gmail } },
      });

      if (existingClientByEmail) {
        throw new Error("Ya existe un cliente con ese email");
      }

      const hashedPassword = await bcrypt.hash(DEFAULT_CLIENT_PASSWORD, 10);

      const user = await tx.user.create({
        data: {
          email: gmail,
          password: hashedPassword,
          name: `${nombre} ${apellido}`.trim(),
          role: Role.CLIENTE,
          isActive: true,
          mustChangePassword: true,
          businessId,
        },
      });

      return tx.client.create({
        data: {
          businessId,
          nombre,
          apellido,
          dni,
          category,
          telefono: data.telefono ?? null,
          gmail,
          creditLimit: data.creditLimit ?? null,
          isAccountEnabled: data.isAccountEnabled ?? false,
          userId: user.id,
          ...addressData,
        },
        include: {
          user: {
            select: clientUserSelect,
          },
          _count: {
            select: {
              sales: true,
              accountMovements: true,
            },
          },
        },
      });
    });
  },

  async registerStoreClient(
    data: {
      nombre: string;
      apellido: string;
      dni: string;
      telefono?: string | null;
      gmail: string;
      password: string;

      addressStreet?: string | null;
      addressNumber?: string | null;
      addressFloor?: string | null;
      addressApartment?: string | null;
      addressCity?: string | null;
      addressProvince?: string | null;
      addressPostalCode?: string | null;
      addressNotes?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
    businessId: string
  ) {
    if (!businessId) throw new Error("No se pudo determinar el negocio (subdominio).");

    const nombre = String(data.nombre || "").trim();
    const apellido = String(data.apellido || "").trim();
    const dni = String(data.dni || "").trim();
    const gmail = cleanEmail(data.gmail);

    if (!nombre) throw new Error("El nombre es obligatorio");
    if (!apellido) throw new Error("El apellido es obligatorio");
    if (!dni) throw new Error("El DNI/CUIT es obligatorio");
    if (!gmail) throw new Error("El email es obligatorio");

    if (!data.password || data.password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const addressData = buildAddressData(data);

    return prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: gmail },
      });

      if (existingUser) {
        throw new Error("Ya existe un usuario con ese email");
      }

      const existingClientByDni = await tx.client.findUnique({
        where: { businessId_dni: { businessId, dni } },
      });

      if (existingClientByDni) {
        throw new Error("Ya existe un cliente con ese DNI/CUIT");
      }

      const existingClientByEmail = await tx.client.findUnique({
        where: { businessId_gmail: { businessId, gmail } },
      });

      if (existingClientByEmail) {
        throw new Error("Ya existe un cliente con ese email");
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = await tx.user.create({
        data: {
          email: gmail,
          password: hashedPassword,
          name: `${nombre} ${apellido}`.trim(),
          role: Role.CLIENTE,
          isActive: true,
          mustChangePassword: false,
          businessId,
        },
      });

      return tx.client.create({
        data: {
          businessId,
          nombre,
          apellido,
          dni,
          telefono: data.telefono ?? null,
          gmail,
          category: CategoryClient.Price,
          creditLimit: null,
          isAccountEnabled: false,
          userId: user.id,
          ...addressData,
        },
        include: {
          user: {
            select: clientUserSelect,
          },
          _count: {
            select: {
              sales: true,
              accountMovements: true,
            },
          },
        },
      });
    });
  },

  async requestPasswordReset(emailValue?: string | null) {
    const email = cleanEmail(emailValue);

    if (!email) return { ok: true };

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        client: true,
      },
    });

    if (!user) return { ok: true };
    if (user.role !== Role.CLIENTE) return { ok: true };
    if (user.isActive === false) return { ok: true };

    const rawToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expires,
      },
    });

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    return { ok: true };
  },

  async resetPassword(tokenValue?: string | null, passwordValue?: string | null) {
    const token = String(tokenValue || "").trim();
    const password = String(passwordValue || "");

    if (!token) {
      throw new Error("El token es obligatorio");
    }

    if (!password || password.length < 6) {
      throw new Error("La contraseña debe tener al menos 6 caracteres");
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(),
        },
        role: Role.CLIENTE,
        isActive: true,
      },
    });

    if (!user) {
      throw new Error("El enlace es inválido o ya venció");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { ok: true };
  },

  async getClients(businessId: string) {
    return prisma.client.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: clientUserSelect,
        },
        _count: {
          select: {
            sales: true,
            accountMovements: true,
          },
        },
      },
    });
  },

  async getClientById(id: string, businessId: string) {
    return prisma.client.findFirst({
      where: { id, businessId },
      include: {
        user: {
          select: clientUserSelect,
        },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            payments: true,
            businessLocation: true,
            items: {
              include: { product: true },
            },
          },
        },
        accountMovements: {
          orderBy: { date: "desc" },
          include: {
            sale: {
              select: {
                id: true,
                total: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
  },

  async updateClient(
    id: string,
    businessId: string,
    data: Partial<{
      nombre: string;
      apellido: string;
      dni: string;
      telefono: string | null;
      gmail: string | null;
      category: ClientCategory;
      creditLimit: number | null;
      isAccountEnabled: boolean;

      addressStreet: string | null;
      addressNumber: string | null;
      addressFloor: string | null;
      addressApartment: string | null;
      addressCity: string | null;
      addressProvince: string | null;
      addressPostalCode: string | null;
      addressNotes: string | null;
      latitude: number | null;
      longitude: number | null;

      createUser: boolean;
      password: string;
      unlinkUser: boolean;
      resetToDefaultPassword: boolean;
    }>
  ) {
    const existing = await prisma.client.findFirst({
      where: { id, businessId },
      include: { user: true },
    });

    if (!existing) throw new Error("Cliente no encontrado");

    const cleanData: any = {};

    if (data.nombre !== undefined) cleanData.nombre = String(data.nombre).trim();
    if (data.apellido !== undefined) cleanData.apellido = String(data.apellido).trim();
    if (data.dni !== undefined) cleanData.dni = String(data.dni).trim();
    if (data.telefono !== undefined) cleanData.telefono = cleanString(data.telefono);
    if (data.gmail !== undefined) cleanData.gmail = cleanEmail(data.gmail);
    if (data.category !== undefined) cleanData.category = normalizeCategory(data.category);
    if (data.creditLimit !== undefined) cleanData.creditLimit = data.creditLimit;
    if (data.isAccountEnabled !== undefined) cleanData.isAccountEnabled = data.isAccountEnabled;

    Object.assign(cleanData, buildAddressData(data));

    return prisma.$transaction(async (tx) => {
      if (data.unlinkUser === true && existing.userId) {
        cleanData.userId = null;
      }

      if (data.createUser === true && !existing.userId) {
        const email = cleanEmail(data.gmail ?? existing.gmail);

        if (!email) {
          throw new Error("Para crear login, el email es obligatorio");
        }

        const existingUser = await tx.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new Error("Ya existe un usuario con ese email");
        }

        const nombre = cleanData.nombre ?? existing.nombre;
        const apellido = cleanData.apellido ?? existing.apellido;
        const hashedPassword = await bcrypt.hash(DEFAULT_CLIENT_PASSWORD, 10);

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name: `${nombre} ${apellido}`.trim(),
            role: Role.CLIENTE,
            isActive: true,
            mustChangePassword: true,
          },
        });

        cleanData.userId = user.id;
        cleanData.gmail = email;
      }

      if (existing.userId && cleanData.gmail) {
        const emailAlreadyUsed = await tx.user.findFirst({
          where: {
            email: cleanData.gmail,
            id: { not: existing.userId },
          },
        });

        if (emailAlreadyUsed) {
          throw new Error("Ya existe un usuario con ese email");
        }

        await tx.user.update({
          where: { id: existing.userId },
          data: {
            email: cleanData.gmail,
            name: `${cleanData.nombre ?? existing.nombre} ${
              cleanData.apellido ?? existing.apellido
            }`.trim(),
          },
        });
      }

      const userId = cleanData.userId ?? existing.userId;

      if (userId && (data.password || data.resetToDefaultPassword)) {
        const newPassword = data.resetToDefaultPassword
          ? DEFAULT_CLIENT_PASSWORD
          : String(data.password);

        if (!data.resetToDefaultPassword && newPassword.trim().length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await tx.user.update({
          where: { id: userId },
          data: {
            password: hashedPassword,
            mustChangePassword: true,
          },
        });
      }

      return tx.client.update({
        where: { id },
        data: cleanData,
        include: {
          user: {
            select: clientUserSelect,
          },
          _count: {
            select: {
              sales: true,
              accountMovements: true,
            },
          },
        },
      });
    });
  },

  async deleteClient(id: string, businessId: string) {
    const client = await prisma.client.findFirst({
      where: { id, businessId },
      select: {
        id: true,
        currentBalance: true,
        userId: true,
        _count: {
          select: {
            sales: true,
            accountMovements: true,
          },
        },
      },
    });

    if (!client) throw new Error("Cliente no encontrado");

    if (client.currentBalance > 0) {
      throw new Error("No se puede eliminar un cliente con saldo deudor");
    }

    if (client._count.sales > 0 || client._count.accountMovements > 0) {
      throw new Error(
        "No se puede eliminar un cliente con historial de ventas o cuenta corriente"
      );
    }

    return prisma.client.delete({ where: { id } });
  },
};
