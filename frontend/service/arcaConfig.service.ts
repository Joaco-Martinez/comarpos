import api from "@/lib/api";

export type ArcaEnvironment = "HOMOLOGACION" | "PRODUCCION";

export type ArcaConfigStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ERROR"
  | "INCOMPLETE"
  | "CERT_EXPIRED";

export type RemitoMode = "DIGITAL_FULL" | "PREPRINTED_FORM";

export type ArcaPointOfSale = {
  id: string;
  arcaConfigId?: string;
  number: number;
  description?: string | null;
  enabled: boolean;
  isDefault: boolean;
  enabledCbteTypes: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type RemitoCaiConfig = {
  id: string;
  arcaConfigId: string;
  mode: RemitoMode;
  pointOfSale: number;
  cai: string;
  expiresAt: string;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  nextNumber?: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ArcaAuditLog = {
  id: string;
  arcaConfigId?: string | null;
  userId?: string | null;
  action: string;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
};

export type ArcaConfig = {
  id: string;
  scope?: string;
  businessName: string;
  cuit: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  iibb?: string | null;
  activityStart?: string | null;
  environment: ArcaEnvironment;
  status: ArcaConfigStatus;
  defaultPointOfSale?: number | null;
  defaultCurrencyId: string;
  defaultConcept: number;
  certAlias?: string | null;
  certExpiresAt?: string | null;
  csrGeneratedAt?: string | null;
  lastTokenAt?: string | null;
  lastCheckAt?: string | null;
  lastError?: string | null;
  lastSuccessAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pointsOfSale?: ArcaPointOfSale[];
  remitoCais?: RemitoCaiConfig[];
};

export type UpsertArcaConfigPayload = {
  businessName: string;
  cuit: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  iibb?: string | null;
  activityStart?: string | null;
  environment: ArcaEnvironment;
  defaultPointOfSale?: number | string | null;
  defaultCurrencyId?: string | null;
  defaultConcept?: number | string | null;
};

export type GenerateCsrPayload = UpsertArcaConfigPayload & {
  certAlias?: string | null;
};

export type PointOfSalePayload = {
  id?: string;
  number?: number | string;
  pointOfSale?: number | string;
  description?: string | null;
  enabled?: boolean;
  isDefault?: boolean;
  enabledCbteTypes?: number[];
};

export type RemitoCaiPayload = {
  id?: string;
  mode?: RemitoMode;
  pointOfSale?: number | string;
  cai?: string;
  expiresAt?: string;
  rangeFrom?: number | string | null;
  rangeTo?: number | string | null;
  nextNumber?: number | string | null;
  enabled?: boolean;
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getContent<T>(data: unknown): T {
  if (!isRecord(data)) return data as T;

  if ("content" in data) return data.content as T;
  if ("data" in data) return data.data as T;

  return data as T;
}

export const arcaConfigApi = {
  async get() {
    const { data } = await api.get("/arca-config/config");
    return getContent<ArcaConfig | null>(data);
  },

  async list() {
    const { data } = await api.get("/arca-config/all");
    return getContent<ArcaConfig[]>(data);
  },

  async upsert(payload: UpsertArcaConfigPayload) {
    const { data } = await api.put("/arca-config/config", payload);
    return getContent<ArcaConfig>(data);
  },

  async generateCsr(payload: GenerateCsrPayload) {
    const { data } = await api.post("/arca-config/generate-csr", payload);
    return getContent<ArcaConfig>(data);
  },

  async downloadCsr(id?: string) {
    const url = id
      ? `/arca-config/${id}/download-csr`
      : "/arca-config/download-csr";

    const response = await api.get(url, {
      responseType: "blob",
    });

    const blob = new Blob([response.data], {
      type: "application/pkcs10",
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = blobUrl;
    link.download = `pedido-arca-${id || Date.now()}.csr`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(blobUrl);
  },

  async uploadCertificate(file: File, certExpiresAt?: string) {
    const formData = new FormData();
    formData.append("cert", file);

    if (certExpiresAt) {
      formData.append("certExpiresAt", certExpiresAt);
    }

    const { data } = await api.post("/arca-config/upload-cert", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return getContent<ArcaConfig>(data);
  },

  async uploadCertificates(params: {
    certFile?: File | null;
    keyFile?: File | null;
    certExpiresAt?: string;
  }) {
    const formData = new FormData();

    if (params.certFile) {
      formData.append("cert", params.certFile);
    }

    if (params.keyFile) {
      formData.append("key", params.keyFile);
    }

    if (params.certExpiresAt) {
      formData.append("certExpiresAt", params.certExpiresAt);
    }

    const { data } = await api.post("/arca-config/certificados", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return getContent<ArcaConfig>(data);
  },

  async deleteCertificates() {
    const { data } = await api.delete("/arca-config/certificados");
    return getContent<ArcaConfig>(data);
  },

  async activate(id?: string) {
    const url = id ? `/arca-config/${id}/activate` : "/arca-config/activate";
    const { data } = await api.patch(url);
    return getContent<ArcaConfig>(data);
  },

  async testWsaa() {
    const { data } = await api.post("/arca-config/test/wsaa");
    return data;
  },

  async testWsfeDummy() {
    const { data } = await api.post("/arca-config/test/wsfe-dummy");
    return data;
  },

  async test(id: string) {
    const { data } = await api.post(`/arca-config/${id}/test`);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/arca-config/${id}`);
    return data;
  },

  async listPointsOfSale() {
    const { data } = await api.get("/arca-config/puntos-venta");
    return getContent<ArcaPointOfSale[]>(data);
  },

  async upsertPointOfSale(payload: PointOfSalePayload) {
    const { data } = await api.post("/arca-config/puntos-venta", payload);
    return getContent<ArcaPointOfSale>(data);
  },

  async deletePointOfSale(id: string) {
    const { data } = await api.delete(`/arca-config/puntos-venta/${id}`);
    return getContent<ArcaPointOfSale>(data);
  },

  async listRemitoCais() {
    const { data } = await api.get("/arca-config/remitos-cai");
    return getContent<RemitoCaiConfig[]>(data);
  },

  async upsertRemitoCai(payload: RemitoCaiPayload) {
    if (payload.id) {
      const { data } = await api.put(
        `/arca-config/remitos-cai/${payload.id}`,
        payload
      );

      return getContent<RemitoCaiConfig>(data);
    }

    const { data } = await api.post("/arca-config/remitos-cai", payload);
    return getContent<RemitoCaiConfig>(data);
  },

  async deleteRemitoCai(id: string) {
    const { data } = await api.delete(`/arca-config/remitos-cai/${id}`);
    return getContent<RemitoCaiConfig>(data);
  },

  async listAuditLogs() {
    const { data } = await api.get("/arca-config/auditoria");
    return getContent<ArcaAuditLog[]>(data);
  },
};