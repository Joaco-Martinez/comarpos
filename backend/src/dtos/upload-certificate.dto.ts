export type UploadCertificateDto = {
  certificatePem: string;
  certAlias?: string;
  certExpiresAt?: string;
};

// Compatibilidad si querés seguir soportando carga manual legacy:
export type UploadCertificateWithPrivateKeyDto = UploadCertificateDto & {
  privateKeyPem?: string;
};
