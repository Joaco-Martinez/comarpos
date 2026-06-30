import api from '@/lib/api';

export type RemitoStatus = 'DRAFT' | 'ISSUED' | 'DELIVERED' | 'CANCELLED';
export type RemitoMode = 'DIGITAL_FULL' | 'PREPRINTED_FORM';

export type RemitoItem = {
  id: string;
  remitoId: string;
  productId?: string | null;
  code?: string | null;
  description: string;
  quantity?: number | null;
  quantityKg?: number | null;
  saleUnit?: 'UNIT' | 'KG';
  createdAt: string;
};

export type Remito = {
  id: string;
  saleId?: string | null;
  clientId?: string | null;
  userId?: string | null;

  status: RemitoStatus;
  mode: RemitoMode;

  pointOfSale: number;
  number: number;
  fullNumber: string;
  code: string;

  issueDate: string;
  placeOfIssue?: string | null;

  cai?: string | null;
  caiExpiresAt?: string | null;

  businessName?: string | null;
  businessCuit?: string | null;
  businessIvaCondition?: string | null;
  businessIibb?: string | null;
  businessActivityStart?: string | null;
  businessFiscalAddress?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;

  clientName?: string | null;
  clientDni?: string | null;
  clientCuit?: string | null;
  clientIvaCondition?: string | null;
  clientAddress?: string | null;
  clientLocality?: string | null;

  sellerName?: string | null;
  saleCondition?: string | null;
  transportName?: string | null;
  transportCuit?: string | null;
  packagesCount?: number | null;
  declaredValue?: number | null;
  observations?: string | null;

  pdfUrl?: string | null;

  createdAt: string;
  updatedAt: string;

  items?: RemitoItem[];
};

export type CreateRemitoFromSalePayload = {
  placeOfIssue?: string | null;
  saleCondition?: string | null;
  transportName?: string | null;
  transportCuit?: string | null;
  packagesCount?: number | null;
  declaredValue?: number | null;
  observations?: string | null;
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

export const remitoApi = {
  async createFromSale(saleId: string, payload?: CreateRemitoFromSalePayload) {
    const { data } = await api.post(`/remitos/from-sale/${saleId}`, payload ?? {});
    return getContent<Remito>(data);
  },

  async list(params?: {
    status?: RemitoStatus;
    clientId?: string;
    saleId?: string;
    from?: string;
    to?: string;
  }) {
    const { data } = await api.get('/remitos', { params });
    return getContent<Remito[]>(data);
  },

  async getById(id: string) {
    const { data } = await api.get(`/remitos/${id}`);
    return getContent<Remito>(data);
  },

  async regeneratePdf(id: string) {
    const { data } = await api.post(`/remitos/${id}/regenerate-pdf`);
    return getContent<Remito>(data);
  },

  async downloadPdf(id: string) {
  const response = await api.get(`/remitos/${id}/pdf`, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: "application/pdf",
  });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `remito-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
},

  async markAsDelivered(id: string) {
    const { data } = await api.patch(`/remitos/${id}/delivered`);
    return getContent<Remito>(data);
  },

  async cancel(id: string) {
    const { data } = await api.patch(`/remitos/${id}/cancel`);
    return getContent<Remito>(data);
  },

  async getBySaleId(saleId: string) {
    const remitos = await this.list({ saleId });
    return remitos;
  },
};