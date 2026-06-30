export type PointOfSaleDto = {
  id?: string;
  number: number;
  description?: string;
  enabled?: boolean;
  isDefault?: boolean;
  enabledCbteTypes?: number[];
};
