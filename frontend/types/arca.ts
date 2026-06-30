export type ArcaEnvironment = 'HOMOLOGACION' | 'PRODUCCION';
export type ArcaConfigStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

export type ArcaPointOfSale = {
  id: string;
  arcaConfigId: string;
  number: number;
  description?: string | null;
  enabled: boolean;
  isDefault: boolean;
  enabledCbteTypes: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type AfipToken = {
  id: string;
  arcaConfigId: string;
  service: string;
  expiration: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ArcaConfig = {
  id: string;
  scope: string;
  businessName: string;
  cuit: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  activityStart?: string | null;
  environment: ArcaEnvironment;
  status: ArcaConfigStatus;
  isActive: boolean;
  certEncrypted?: string | null;
  keyEncrypted?: string | null;
  certExpiresAt?: string | null;
  lastTokenAt?: string | null;
  lastCheckAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
  pointsOfSale?: ArcaPointOfSale[];
  tokens?: AfipToken[];
};

export type ArcaConfigPayload = {
  businessName: string;
  cuit: string;
  ivaCondition?: string | null;
  fiscalAddress?: string | null;
  activityStart?: string | null;
  environment: ArcaEnvironment;
  pointOfSale?: number | string | null;
};

export type ArcaCertificatePayload = {
  certPem: string;
  keyPem: string;
  certExpiresAt?: string | null;
};

export type ArcaPointOfSalePayload = {
  number: number;
  description?: string;
  enabled?: boolean;
  isDefault?: boolean;
  enabledCbteTypes?: number[];
};

export type ArcaApiResponse<T> = {
  ok: boolean;
  content?: T;
  data?: T;
  message?: string;
  error?: string;
};
