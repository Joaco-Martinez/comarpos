import type { Client, Product, ProductCategory } from '@/types';
import { formatDateTimeAR } from '@/lib/dateAR';

export const fmtMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number.isFinite(Number(n)) ? Number(n) : 0);
export const fmtDate = (value?: string | null) => formatDateTimeAR(value);
export const num = (value: unknown, fallback = 0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
export const normalizeArray = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== 'object') return [];

  const record = response as Record<string, unknown>;

  for (const key of [
    'content',
    'data',
    'items',
    'results',
    'rows',
    'clients',
    'products',
    'movements',
    'sales',
    'locations',
    'businessLocations',
  ]) {
    const value = record[key];

    if (Array.isArray(value)) return value as T[];

    const nested = normalizeArray<T>(value);
    if (nested.length) return nested;
  }

  return [];
};
export const clientName = (client?: Client | null) => client ? `${client.nombre ?? ''} ${client.apellido ?? ''}`.trim() || 'Cliente sin nombre' : 'Consumidor final';
export const categoryName = (product: Product) => {
  const cat = product.category;
  if (typeof cat === 'string') return cat;
  if (cat && typeof cat === 'object') return (cat as ProductCategory).name ?? 'Sin categoría';
  return 'Sin categoría';
};
export const productPrice = (product: Product, priceType: 'price' | 'clientPrice' | 'wholesalePrice' = 'price') => {
  if (product.saleUnit === 'KG') {
    if (priceType === 'wholesalePrice') return num(product.wholesalePricePerKg, num(product.clientPricePerKg, num(product.pricePerKg)));
    if (priceType === 'clientPrice') return num(product.clientPricePerKg, num(product.pricePerKg));
    return num(product.pricePerKg);
  }
  return num(product[priceType], num(product.price));
};
export const productStock = (product: Product) => product.saleUnit === 'KG' ? num(product.stockLocalKg) : num(product.stockLocal);
export const productMinStock = (product: Product) => product.saleUnit === 'KG' ? num(product.minStockKg) : num(product.minStock);
