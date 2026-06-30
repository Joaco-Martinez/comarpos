const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  productsCount: number;
};

export type CatalogProduct = {
  id: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  type: "SIMPLE" | "COMPUESTO";
  saleUnit: "UNIT" | "KG";
  imageUrl?: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  price: number;
  priceList: "PUBLIC" | "CLIENT" | "WHOLESALE";
  publicPrice: number;
  clientPrice: number;
  wholesalePrice: number;
  currency: "ARS";
  availableQuantity: number;
  availableKg: number;
  stockLabel: string;
  canSell: boolean;
};

export type CheckoutItem = {
  productId: string;
  quantity?: number;
  quantityKg?: number;
};

export type CartValidationItem = {
  productId: string;
  name?: string | null;
  saleUnit?: "UNIT" | "KG" | null;
  requested: number;
  available: number;
  ok: boolean;
  message?: string | null;
  stockLabel?: string | null;
  product?: CatalogProduct | null;
};

export type CartValidationResult = {
  ok: boolean;
  customer: {
    category: "Price" | "Cliente" | "Mayorista";
    clientId: string | null;
  };
  items: CartValidationItem[];
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;

  let debugBody: unknown = null;

  try {
    debugBody =
      typeof options.body === "string" ? JSON.parse(options.body) : null;
  } catch {
    debugBody = options.body ?? null;
  }

  console.log("[SHOP API] Request:", {
    url,
    method: options.method || "GET",
    body: debugBody,
  });

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);

  console.log("[SHOP API] Response:", {
    url,
    status: res.status,
    ok: res.ok,
    data: json,
  });

  if (!res.ok) {
    console.error("[SHOP API] Error:", {
      url,
      status: res.status,
      error: json,
    });

    throw new Error(json?.message || json?.error || "Error de solicitud");
  }

  return json?.content ?? json;
}

export const shopApi = {
  getCategories() {
    return request<CatalogCategory[]>("/catalog/categories");
  },

  getProducts(params?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const query = new URLSearchParams();

    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.sort) query.set("sort", params.sort);

    const qs = query.toString();

    return request<{
      customer: {
        category: "Price" | "Cliente" | "Mayorista";
        isLoggedIn: boolean;
        clientId: string | null;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        totalPages?: number;
      };
      products: CatalogProduct[];
    }>(`/catalog/products${qs ? `?${qs}` : ""}`);
  },

  validateCart(payload: { items: CheckoutItem[] }) {
    return request<CartValidationResult>("/catalog/validate-cart", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  checkoutWhatsapp(payload: {
    items: CheckoutItem[];
    paymentMethod?: string;
    customerNotes?: string;
  }) {
    return request<{
      saleId: string;
      status: "PENDING" | "COMPLETED" | "CANCELLED";
      total: number;
      whatsappUrl: string | null;
      whatsappMessage: string;
      missingWhatsappConfig: boolean;
      whatsappApi?: unknown;
    }>("/catalog/checkout-whatsapp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  register(payload: {
    email: string;
    password: string;
    nombre: string;
    apellido?: string;
    dni: string;
    telefono?: string;
  }) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request("/auth/me");
  },
};

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}