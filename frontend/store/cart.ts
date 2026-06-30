"use client";

import { create } from "zustand";
import type { CatalogProduct } from "@/lib/shop";

type CartItem = {
  product: CatalogProduct;
  quantity: number;
  quantityKg?: number;
};

type CartActionResult = {
  ok: boolean;
  message?: string;
};

type CartState = {
  items: CartItem[];
  add: (product: CatalogProduct, amount?: number) => CartActionResult;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getAvailableStock(product: CatalogProduct) {
  if (product.saleUnit === "KG") {
    return Number(product.availableKg || 0);
  }

  return Number(product.availableQuantity || 0);
}

function formatStockAmount(product: CatalogProduct, value: number) {
  if (product.saleUnit === "KG") {
    return `${round2(value).toLocaleString("es-AR")} kg`;
  }

  const units = Math.trunc(value);
  return `${units.toLocaleString("es-AR")} unidad${units === 1 ? "" : "es"}`;
}

function normalizeQuantity(product: CatalogProduct, value: number) {
  const min = product.saleUnit === "KG" ? 0.1 : 1;
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) return min;

  if (product.saleUnit === "KG") {
    return Math.max(min, round2(parsed));
  }

  return Math.max(min, Math.trunc(parsed));
}

function validateStock(
  product: CatalogProduct,
  currentQuantity: number,
  amountToAdd: number,
): CartActionResult {
  const available = getAvailableStock(product);
  const nextQuantity = round2(currentQuantity + amountToAdd);

  if (!product.canSell || available <= 0) {
    return {
      ok: false,
      message: `${product.name} no tiene stock disponible.`,
    };
  }

  if (nextQuantity > available) {
    return {
      ok: false,
      message: `De ${product.name} solo hay ${formatStockAmount(
        product,
        available,
      )} disponibles.`,
    };
  }

  return { ok: true };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  add(product, amount = 1) {
    const safeAmount = normalizeQuantity(product, amount);
    const existing = get().items.find((item) => item.product.id === product.id);
    const currentQuantity = existing?.quantity ?? 0;

    const validation = validateStock(product, currentQuantity, safeAmount);

    if (!validation.ok) {
      return validation;
    }

    set((state) => {
      const current = state.items.find(
        (item) => item.product.id === product.id,
      );

      if (current) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id
              ? {
                  ...item,
                  product,
                  quantity: round2(item.quantity + safeAmount),
                }
              : item,
          ),
        };
      }

      return {
        items: [
          ...state.items,
          {
            product,
            quantity: safeAmount,
            quantityKg: product.saleUnit === "KG" ? safeAmount : undefined,
          },
        ],
      };
    });

    return { ok: true };
  },

  remove(productId) {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  setQuantity(productId, quantity) {
    set((state) => ({
      items: state.items.map((item) => {
        if (item.product.id !== productId) return item;

        const available = getAvailableStock(item.product);
        let safeQuantity = normalizeQuantity(item.product, quantity);

        if (available > 0 && safeQuantity > available) {
          safeQuantity = available;
        }

        return {
          ...item,
          quantity: round2(safeQuantity),
          quantityKg:
            item.product.saleUnit === "KG" ? round2(safeQuantity) : undefined,
        };
      }),
    }));
  },

  clear() {
    set({ items: [] });
  },

  total() {
    return get().items.reduce(
      (acc, item) => acc + item.product.price * item.quantity,
      0,
    );
  },

  count() {
    return get().items.reduce((acc, item) => acc + item.quantity, 0);
  },
}));