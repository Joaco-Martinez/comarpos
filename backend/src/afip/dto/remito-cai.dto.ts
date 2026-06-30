export type RemitoCaiDto = {
  id?: string;
  mode?: "DIGITAL_FULL" | "PREPRINTED_FORM";
  pointOfSale: number;
  cai: string;
  expiresAt: string;
  rangeFrom?: number;
  rangeTo?: number;
  nextNumber?: number;
  enabled?: boolean;
};
