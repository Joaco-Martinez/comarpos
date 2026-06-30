import forge from "node-forge";
import prisma from "../prisma";
import { arcaCryptoService } from "./arcaCrypto.service";

type ArcaEnvironment = "HOMOLOGACION" | "PRODUCCION";
type RemitoMode = "DIGITAL_FULL" | "PREPRINTED_FORM";

type UpdateArcaConfigInput = {
  businessName?: string;
  cuit?: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  iibb?: string | null;
  activityStart?: string | Date | null;
  activityStartDate?: string | Date | null;
  environment?: ArcaEnvironment;
  status?: "ACTIVE" | "INACTIVE" | "ERROR" | "INCOMPLETE" | "CERT_EXPIRED";
  pointOfSale?: number | string | null;
  defaultPointOfSale?: number | string | null;
  defaultCurrencyId?: string | null;
  defaultConcept?: number | string | null;
  certPem?: string | null;
  keyPem?: string | null;
  certExpiresAt?: string | Date | null;
};

type GenerateCsrInput = UpdateArcaConfigInput & {
  certAlias?: string | null;
};

type PointOfSaleInput = {
  id?: string;
  number?: number | string;
  pointOfSale?: number | string;
  description?: string | null;
  enabled?: boolean;
  isDefault?: boolean;
  enabledCbteTypes?: number[] | string | null;
};

type RemitoCaiInput = {
  id?: string;
  mode?: RemitoMode;
  pointOfSale?: number | string;
  cai?: string;
  expiresAt?: string | Date;
  rangeFrom?: number | string | null;
  rangeTo?: number | string | null;
  nextNumber?: number | string | null;
  enabled?: boolean;
};

function normalizeCuit(cuit?: string | null) {
  return String(cuit || "").replace(/\D/g, "");
}

function toNullableDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNullableNumber(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanObject<T extends Record<string, any>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function decryptRequired(value: string | null, fieldName: string) {
  if (!value) throw new Error(`Falta configurar ${fieldName} en ARCA.`);
  return arcaCryptoService.decrypt(value);
}

function parseEnabledCbteTypes(value: PointOfSaleInput["enabledCbteTypes"]) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isFinite(n));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((n) => Number.isFinite(n));
      }
    } catch {
      return value
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n));
    }
  }

  return [];
}

function assertValidCuit(cuit: string) {
  if (!/^\d{11}$/.test(cuit)) {
    throw new Error("El CUIT debe tener 11 dígitos, sin guiones.");
  }
}

function getCertExpiration(certPem: string) {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return cert.validity.notAfter;
  } catch {
    throw new Error("El certificado .crt no es válido.");
  }
}

function validatePrivateKey(keyPem: string) {
  try {
    forge.pki.privateKeyFromPem(keyPem);
  } catch {
    throw new Error("La clave privada .key no es válida.");
  }
}

function buildCsrSubject(params: {
  businessName: string;
  cuit: string;
  certAlias?: string | null;
}) {
  return [
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: params.businessName },
    { name: "commonName", value: params.certAlias || "COMARPOS" },
    { name: "serialNumber", value: `CUIT ${params.cuit}` },
  ];
}

async function getLatestConfig(businessId?: string) {
  if (businessId) {
    return prisma.arcaConfig.findUnique({
      where: { businessId },
      include: {
        pointsOfSale: true,
        tokens: true,
        remitoCais: true,
      },
    });
  }

  return prisma.arcaConfig.findFirst({
    include: {
      pointsOfSale: true,
      tokens: true,
      remitoCais: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export const arcaConfigService = {
  async list(businessId: string) {
    const config = await getLatestConfig(businessId);
    return config ? [config] : [];
  },

  async getConfig(businessId?: string) {
    return getLatestConfig(businessId);
  },

  async getActive(businessId?: string) {
    const config = await prisma.arcaConfig.findFirst({
      where: { isActive: true, ...(businessId ? { businessId } : {}) },
      include: { pointsOfSale: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) throw new Error("No hay configuración ARCA activa.");
    return config;
  },

  async getActiveDecrypted(businessId?: string) {
    const config = await prisma.arcaConfig.findFirst({
      where: { isActive: true, ...(businessId ? { businessId } : {}) },
      include: { pointsOfSale: true },
      orderBy: { createdAt: "desc" },
    });

    if (!config) throw new Error("No hay configuración ARCA activa.");

    return {
      ...config,
      certPem: decryptRequired(config.certEncrypted, "el certificado"),
      keyPem: decryptRequired(config.keyEncrypted, "la private key"),
    };
  },

  async create(businessId: string, data: UpdateArcaConfigInput) {
    const config = await this.upsertConfig(businessId, data);

    if (data.certPem && data.keyPem) {
      return this.uploadCertificates(businessId, {
        certPem: data.certPem,
        keyPem: data.keyPem,
        certExpiresAt: data.certExpiresAt,
      });
    }

    return config;
  },

  async upsertConfig(businessId: string, data: UpdateArcaConfigInput) {
    const existing = await prisma.arcaConfig.findUnique({ where: { businessId } });

    const cuit = data.cuit ? normalizeCuit(data.cuit) : undefined;
    const activityStartValue = data.activityStart ?? data.activityStartDate;
    const defaultPointOfSale = toNullableNumber(data.defaultPointOfSale ?? data.pointOfSale);
    const defaultConcept = toNullableNumber(data.defaultConcept);

    if (cuit !== undefined && cuit !== "") assertValidCuit(cuit);

    const payload = cleanObject({
      businessName: data.businessName,
      cuit,
      ivaCondition: data.ivaCondition ?? undefined,
      fiscalAddress: data.fiscalAddress ?? undefined,
      iibb: data.iibb ?? undefined,
      activityStart:
        activityStartValue !== undefined ? toNullableDate(activityStartValue) : undefined,
      environment: data.environment,
      defaultPointOfSale: defaultPointOfSale ?? undefined,
      defaultCurrencyId: data.defaultCurrencyId ?? undefined,
      defaultConcept: defaultConcept ?? undefined,
      status: data.status ?? "INACTIVE",
    });

    let config;

    if (existing) {
      config = await prisma.arcaConfig.update({
        where: { id: existing.id },
        data: payload,
        include: { pointsOfSale: true, tokens: true, remitoCais: true },
      });
    } else {
      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) throw new Error("Negocio no encontrado.");

      const businessName = data.businessName || business.name;
      if (!businessName) {
        throw new Error("Falta la razón social (businessName) para crear la configuración ARCA.");
      }

      config = await prisma.arcaConfig.create({
        data: {
          businessId,
          scope: businessId,
          businessName,
          cuit: cuit || "",
          ivaCondition: data.ivaCondition || null,
          fiscalAddress: data.fiscalAddress || null,
          iibb: data.iibb || null,
          activityStart: toNullableDate(activityStartValue),
          environment: data.environment || "HOMOLOGACION",
          defaultPointOfSale,
          defaultCurrencyId: data.defaultCurrencyId || "PES",
          defaultConcept: defaultConcept || 1,
          status: data.status || "INACTIVE",
          isActive: false,
        },
        include: { pointsOfSale: true, tokens: true, remitoCais: true },
      });
    }

    if (defaultPointOfSale && defaultPointOfSale > 0) {
      await this.upsertPointOfSale(businessId, {
        number: defaultPointOfSale,
        description: "Punto de venta principal",
        enabled: true,
        isDefault: true,
      });
    }

    return prisma.arcaConfig.findUnique({
      where: { id: config.id },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async generateCsr(businessId: string, data: GenerateCsrInput) {
    const cuit = normalizeCuit(data.cuit);
    assertValidCuit(cuit);

    if (!data.businessName?.trim()) {
      throw new Error("La razón social es obligatoria para generar el CSR.");
    }

    const point = toNullableNumber(data.defaultPointOfSale ?? data.pointOfSale);
    if (!point || point <= 0) {
      throw new Error("El punto de venta es obligatorio para configurar ARCA.");
    }

    const config = await this.upsertConfig(businessId, {
      ...data,
      cuit,
      defaultPointOfSale: point,
      status: "INCOMPLETE",
    });

    if (!config) {
      throw new Error("No se pudo crear la configuración ARCA.");
    }

    const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keyPair.publicKey;
    csr.setSubject(
      buildCsrSubject({
        businessName: data.businessName.trim(),
        cuit,
        certAlias: data.certAlias || "COMARPOS",
      })
    );
    csr.sign(keyPair.privateKey, forge.md.sha256.create());

    if (!csr.verify()) {
      throw new Error("No se pudo generar correctamente el pedido CSR.");
    }

    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    const csrPem = forge.pki.certificationRequestToPem(csr);

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: config.id } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        keyEncrypted: arcaCryptoService.encrypt(privateKeyPem),
        csrEncrypted: arcaCryptoService.encrypt(csrPem),
        csrGeneratedAt: new Date(),
        certEncrypted: null,
        certExpiresAt: null,
        certAlias: data.certAlias || "COMARPOS",
        status: "INCOMPLETE",
        isActive: false,
        lastError: null,
        lastTokenAt: null,
        lastCheckAt: null,
        lastSuccessAt: null,
      },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async downloadCsr(businessId: string) {
    const config = await prisma.arcaConfig.findUnique({ where: { businessId } });

    if (!config) throw new Error("No hay configuración ARCA creada.");
    if (!config.csrEncrypted) {
      throw new Error("Todavía no se generó el pedido CSR.");
    }

    return {
      filename: `pedido-arca-${config.cuit || "sin-cuit"}.csr`,
      content: arcaCryptoService.decrypt(config.csrEncrypted),
    };
  },

  async uploadCertificate(businessId: string, params: {
    certPem: string;
    certExpiresAt?: string | Date | null;
  }) {
    const config = await this.getConfig(businessId);
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");
    if (!config.keyEncrypted) {
      throw new Error("Primero generá el pedido CSR desde el sistema.");
    }

    const certExpiresAt = params.certExpiresAt
      ? toNullableDate(params.certExpiresAt)
      : getCertExpiration(params.certPem);

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: config.id } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        certEncrypted: arcaCryptoService.encrypt(params.certPem),
        certExpiresAt,
        status: "INCOMPLETE",
        isActive: false,
        lastError: null,
        lastTokenAt: null,
      },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async uploadCertificates(businessId: string, params: {
    certPem: string;
    keyPem?: string;
    certExpiresAt?: string | Date | null;
  }) {
    const config = await this.getConfig(businessId);
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    const certExpiresAt = params.certExpiresAt
      ? toNullableDate(params.certExpiresAt)
      : getCertExpiration(params.certPem);

    const data: any = {
      certEncrypted: arcaCryptoService.encrypt(params.certPem),
      certExpiresAt,
      status: "INCOMPLETE",
      isActive: false,
      lastError: null,
      lastTokenAt: null,
    };

    if (params.keyPem) {
      validatePrivateKey(params.keyPem);
      data.keyEncrypted = arcaCryptoService.encrypt(params.keyPem);
    } else if (!config.keyEncrypted) {
      throw new Error("Falta la private key. Usá primero 'Generar CSR' o subí la .key.");
    }

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: config.id } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data,
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async deleteCertificates(businessId: string) {
    const config = await this.getConfig(businessId);
    if (!config) throw new Error("No hay configuración ARCA creada.");

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: config.id } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: {
        certEncrypted: null,
        keyEncrypted: null,
        csrEncrypted: null,
        csrGeneratedAt: null,
        certExpiresAt: null,
        lastTokenAt: null,
        status: "INCOMPLETE",
        isActive: false,
      },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async activate(businessId: string, configId?: string) {
    const config = configId
      ? await prisma.arcaConfig.findFirst({ where: { id: configId, businessId } })
      : await prisma.arcaConfig.findUnique({ where: { businessId } });

    if (!config) throw new Error("No hay configuración ARCA para activar.");
    if (!config.cuit) throw new Error("Falta configurar el CUIT.");
    if (!config.certEncrypted) throw new Error("Falta cargar el certificado .crt que devuelve ARCA.");
    if (!config.keyEncrypted) throw new Error("Falta la private key. Generá el CSR desde el sistema.");

    const pointsCount = await prisma.arcaPointOfSale.count({
      where: { arcaConfigId: config.id, enabled: true },
    });

    if (pointsCount === 0) throw new Error("Falta configurar al menos un punto de venta.");

    await prisma.arcaConfig.updateMany({ where: { businessId }, data: { isActive: false } });

    return prisma.arcaConfig.update({
      where: { id: config.id },
      data: { isActive: true, status: "ACTIVE", lastError: null },
      include: { pointsOfSale: true, tokens: true, remitoCais: true },
    });
  },

  async remove(businessId: string, id: string) {
    const config = await prisma.arcaConfig.findFirst({ where: { id, businessId } });
    if (!config) throw new Error("Configuración ARCA no encontrada.");

    await prisma.afipToken.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaPointOfSale.deleteMany({ where: { arcaConfigId: id } });
    await prisma.remitoCaiConfig.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaAuditLog.deleteMany({ where: { arcaConfigId: id } });
    await prisma.arcaConfig.delete({ where: { id } });

    return { ok: true };
  },

  async listPointsOfSale(businessId: string) {
    const config = await this.getConfig(businessId);
    if (!config) return [];

    return prisma.arcaPointOfSale.findMany({
      where: { arcaConfigId: config.id },
      orderBy: [{ isDefault: "desc" }, { number: "asc" }],
    });
  },

  async upsertPointOfSale(businessId: string, data: PointOfSaleInput) {
    const config = await this.getConfig(businessId);
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    const number = toNullableNumber(data.number ?? data.pointOfSale);
    if (!number || number <= 0) throw new Error("El punto de venta debe ser un número válido.");

    const isDefault = data.isDefault ?? true;

    if (isDefault) {
      await prisma.arcaPointOfSale.updateMany({
        where: { arcaConfigId: config.id },
        data: { isDefault: false },
      });

      await prisma.arcaConfig.update({
        where: { id: config.id },
        data: { defaultPointOfSale: number },
      });
    }

    return prisma.arcaPointOfSale.upsert({
      where: {
        arcaConfigId_number: {
          arcaConfigId: config.id,
          number,
        },
      },
      update: {
        description: data.description ?? undefined,
        enabled: data.enabled ?? undefined,
        isDefault,
        enabledCbteTypes:
          data.enabledCbteTypes !== undefined
            ? parseEnabledCbteTypes(data.enabledCbteTypes)
            : undefined,
      },
      create: {
        arcaConfigId: config.id,
        number,
        description: data.description || "Punto de venta ARCA",
        enabled: data.enabled ?? true,
        isDefault,
        enabledCbteTypes: parseEnabledCbteTypes(data.enabledCbteTypes),
      },
    });
  },

  async deletePointOfSale(businessId: string, id: string) {
    const point = await prisma.arcaPointOfSale.findFirst({
      where: { id, arcaConfig: { businessId } },
    });
    if (!point) throw new Error("Punto de venta no encontrado.");

    return prisma.arcaPointOfSale.delete({ where: { id } });
  },

  async listRemitoCais(businessId: string) {
    const config = await this.getConfig(businessId);
    if (!config) return [];

    return prisma.remitoCaiConfig.findMany({
      where: { arcaConfigId: config.id },
      orderBy: [{ enabled: "desc" }, { expiresAt: "asc" }],
    });
  },

  async upsertRemitoCai(businessId: string, data: RemitoCaiInput) {
    const config = await this.getConfig(businessId);
    if (!config) throw new Error("Primero tenés que crear la configuración ARCA.");

    const pointOfSale = toNullableNumber(data.pointOfSale);
    if (!pointOfSale) throw new Error("El punto de venta de remito es obligatorio.");
    if (!data.cai) throw new Error("El CAI es obligatorio.");
    if (!data.expiresAt) throw new Error("El vencimiento del CAI es obligatorio.");

    const payload = {
      arcaConfigId: config.id,
      mode: data.mode || "PREPRINTED_FORM",
      pointOfSale,
      cai: String(data.cai),
      expiresAt: toNullableDate(data.expiresAt) || new Date(),
      rangeFrom: toNullableNumber(data.rangeFrom),
      rangeTo: toNullableNumber(data.rangeTo),
      nextNumber: toNullableNumber(data.nextNumber),
      enabled: data.enabled ?? true,
    };

    if (data.id) {
      const existingRemitoCai = await prisma.remitoCaiConfig.findFirst({
        where: { id: data.id, arcaConfigId: config.id },
      });
      if (!existingRemitoCai) throw new Error("CAI de remito no encontrado.");

      return prisma.remitoCaiConfig.update({
        where: { id: data.id },
        data: payload,
      });
    }

    return prisma.remitoCaiConfig.create({ data: payload });
  },

  async deleteRemitoCai(businessId: string, id: string) {
    const remitoCai = await prisma.remitoCaiConfig.findFirst({
      where: { id, arcaConfig: { businessId } },
    });
    if (!remitoCai) throw new Error("CAI de remito no encontrado.");

    return prisma.remitoCaiConfig.delete({ where: { id } });
  },

  async listAuditLogs(businessId: string) {
    const config = await this.getConfig(businessId);
    return prisma.arcaAuditLog.findMany({
      where: config ? { arcaConfigId: config.id } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async audit(action: any, configId?: string | null, userId?: string | null, detail?: string, ip?: string) {
    return prisma.arcaAuditLog.create({
      data: {
        action,
        arcaConfigId: configId || null,
        userId: userId || null,
        detail: detail || null,
        ip: ip || null,
      },
    });
  },

  async markError(configId: string, message: string) {
    return prisma.arcaConfig.update({
      where: { id: configId },
      data: { status: "ERROR", lastError: message, lastCheckAt: new Date() },
    });
  },

  async markChecked(configId: string) {
    return prisma.arcaConfig.update({
      where: { id: configId },
      data: { lastCheckAt: new Date(), lastSuccessAt: new Date(), lastError: null },
    });
  },
};
