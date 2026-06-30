export type UpdateArcaConfigDto = {
  businessName?: string;
  cuit?: string;
  ivaCondition?: string;
  fiscalAddress?: string;
  iibb?: string;
  activityStart?: string;
  environment?: "HOMOLOGACION" | "PRODUCCION";
  defaultPointOfSale?: number;
  defaultCurrencyId?: string;
  defaultConcept?: number;
  isActive?: boolean;
};
