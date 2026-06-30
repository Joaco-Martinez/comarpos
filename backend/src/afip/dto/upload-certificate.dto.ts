export type UploadCertificateDto = {
  certificatePem: string;
  privateKeyPem: string;
  certAlias?: string;
  certExpiresAt?: string;
};
