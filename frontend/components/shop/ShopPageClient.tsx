/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ShoppingCart,
  UserRound,
  Package,
  Lock,
  MapPin,
  ChevronDown,
  Store,
  ArrowUpDown,
} from "lucide-react";
import {
  CatalogCategory,
  CatalogProduct,
  formatMoney,
  shopApi,
} from "@/lib/shop";
import { useCartStore } from "@/store/cart";
import Image from "next/image";
import toast from "react-hot-toast";

const HIDDEN_PRODUCT_SKUS = ["ENVIO-FLETE2"];
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type ShopAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  client?: {
    id: string;
    nombre?: string | null;
    apellido?: string | null;
    category?: string | null;
  } | null;
};

type CatalogProductsResult = {
  products?: CatalogProduct[];
  data?: CatalogProduct[];
  customer?: {
    category?: string | null;
  } | null;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

type CatalogSortMode =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "category-asc"
  | "category-desc";

const SHOP_PRODUCTS_PAGE_SIZE = 28;

async function getCurrentUser(): Promise<ShopAuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.content ?? data?.user ?? data ?? null;
  } catch {
    return null;
  }
}

function isVisibleCatalogProduct(product: CatalogProduct) {
  return !HIDDEN_PRODUCT_SKUS.includes(
    String(product.sku ?? "")
      .trim()
      .toUpperCase(),
  );
}

function isWholesaleCategory(category: string | null | undefined) {
  return (
    String(category ?? "")
      .trim()
      .toLowerCase() === "mayorista"
  );
}

function numValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickFirstPositive(...values: unknown[]) {
  for (const value of values) {
    const n = numValue(value);
    if (n > 0) return n;
  }

  return 0;
}

function getProductPriceForCustomer(
  product: CatalogProduct,
  customerCategory: string | null | undefined,
) {
  const p = product as CatalogProduct & Record<string, unknown>;
  const isKg = product.saleUnit === "KG";

  if (isWholesaleCategory(customerCategory)) {
    return pickFirstPositive(
      isKg ? p.wholesalePricePerKg : p.wholesalePrice,
      p.wholesalePrice,
      p.mayoristaPrice,
      p.price,
    );
  }

  return pickFirstPositive(
    isKg ? p.pricePerKg : p.price,
    p.price,
    p.minoristaPrice,
    p.retailPrice,
  );
}

function getProductStockForCustomer(
  product: CatalogProduct,
  _customerCategory: string | null | undefined,
) {
  // El backend ya devuelve availableQuantity / availableKg calculado según la categoría:
  // Mayorista => LOCAL, Minorista/Price => DEPÓSITO.
  if (product.saleUnit === "KG") {
    return numValue(product.availableKg);
  }

  return numValue(product.availableQuantity);
}

function getStockLabelForCustomer(
  product: CatalogProduct,
  customerCategory: string | null | undefined,
) {
  const stock = getProductStockForCustomer(product, customerCategory);
  const storeName = isWholesaleCategory(customerCategory)
    ? "local"
    : "depósito";

  if (stock <= 0) return `Sin stock en ${storeName}`;

  if (product.saleUnit === "KG") {
    return `${stock.toLocaleString("es-AR")} kg en ${storeName}`;
  }

  return `${stock.toLocaleString("es-AR")} en ${storeName}`;
}

function adaptProductForCustomer(
  product: CatalogProduct,
  customerCategory: string | null | undefined,
): CatalogProduct {
  const stock = getProductStockForCustomer(product, customerCategory);
  const price = getProductPriceForCustomer(product, customerCategory);
  const canSell = stock > 0 && price > 0;

  return {
    ...product,
    price,
    canSell,
    stockLabel: getStockLabelForCustomer(product, customerCategory),
  };
}

function normalizeSortText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-AR");
}

function sortCatalogProducts(
  list: CatalogProduct[],
  sortMode: CatalogSortMode,
  customerCategory?: string | null,
) {
  return [...list].sort((a, b) => {
    if (a.canSell !== b.canSell) {
      return a.canSell ? -1 : 1;
    }

    if (sortMode === "name-asc") {
      return normalizeSortText(a.name).localeCompare(
        normalizeSortText(b.name),
        "es-AR",
        { numeric: true, sensitivity: "base" },
      );
    }

    if (sortMode === "name-desc") {
      return normalizeSortText(b.name).localeCompare(
        normalizeSortText(a.name),
        "es-AR",
        { numeric: true, sensitivity: "base" },
      );
    }

    if (sortMode === "price-asc") {
      return (
        getProductPriceForCustomer(a, customerCategory) -
        getProductPriceForCustomer(b, customerCategory)
      );
    }

    if (sortMode === "price-desc") {
      return (
        getProductPriceForCustomer(b, customerCategory) -
        getProductPriceForCustomer(a, customerCategory)
      );
    }

    if (sortMode === "category-asc") {
      return normalizeSortText(a.category?.name).localeCompare(
        normalizeSortText(b.category?.name),
        "es-AR",
        { numeric: true, sensitivity: "base" },
      );
    }

    if (sortMode === "category-desc") {
      return normalizeSortText(b.category?.name).localeCompare(
        normalizeSortText(a.category?.name),
        "es-AR",
        { numeric: true, sensitivity: "base" },
      );
    }

    return 0;
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  const apiError = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
  };

  return (
    apiError.response?.data?.message ??
    apiError.response?.data?.error ??
    fallback
  );
}

async function fetchCategories() {
  return shopApi.getCategories();
}

async function fetchCatalogProducts(
  category: string,
  search: string,
  page: number,
  sort: CatalogSortMode,
) {
  return shopApi.getProducts({
    category,
    search,
    page,
    limit: SHOP_PRODUCTS_PAGE_SIZE,
    sort,
  } as any) as Promise<CatalogProductsResult>;
}

export default function TiendaPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<CatalogSortMode>("name-asc");
  const [customerCategory, setCustomerCategory] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<ShopAuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const cartItems = useCartStore((state) => state.items);
  const cartCount = useCartStore((state) => state.count());
  const add = useCartStore((state) => state.add);

  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  const storeSuffix = useMemo(() => {
    return isWholesaleCategory(customerCategory)
      ? "Mayorista / Local"
      : "Minorista / Depósito";
  }, [customerCategory]);

  const priceLabel = useMemo(() => {
    return isWholesaleCategory(customerCategory)
      ? "Precio mayorista"
      : "Precio minorista";
  }, [customerCategory]);

  const isLoggedIn = authChecked && Boolean(authUser);

  const accountLabel = useMemo(() => {
    if (!authUser) return "Ingresar";

    const clientName = [authUser.client?.nombre, authUser.client?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim();

    return clientName || authUser.name || "Mi cuenta";
  }, [authUser]);

  const selectedCategoryName = useMemo(() => {
    if (!category) return "Todas las categorías";
    return categories.find((cat) => cat.slug === category)?.name ?? "Categoría";
  }, [category, categories]);

  useEffect(() => {
    let alive = true;

    getCurrentUser().then((user) => {
      if (!alive) return;

      setAuthUser(user);
      setCustomerCategory(user?.client?.category ?? null);
      setAuthChecked(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    fetchCategories()
      .then((data) => {
        if (!alive) return;
        setCategories(data);
      })
      .catch((err) => {
        console.error(err);

        if (!alive) return;

        setCategories([]);
        toast.error("No se pudieron cargar las categorías");
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    setLoading(true);

    fetchCatalogProducts(category, search, currentPage, sortMode)
      .then((result) => {
        if (!alive) return;

        const resultCustomerCategory =
          result.customer?.category ?? authUser?.client?.category ?? null;

        const visibleProducts = sortCatalogProducts(
          (result.products ?? result.data ?? [])
            .filter(isVisibleCatalogProduct)
            .map((product) =>
              adaptProductForCustomer(product, resultCustomerCategory),
            ),
          sortMode,
          resultCustomerCategory,
        );

        const responseTotal =
          result.total ?? result.pagination?.total ?? visibleProducts.length;

        const responseTotalPages =
          result.totalPages ??
          result.pagination?.totalPages ??
          Math.ceil(Number(responseTotal || 0) / SHOP_PRODUCTS_PAGE_SIZE);

        setProducts(visibleProducts);
        setTotalProducts(Number(responseTotal ?? visibleProducts.length));
        setTotalPages(Math.max(1, Number(responseTotalPages || 1)));
        setCustomerCategory(resultCustomerCategory);
        setError("");
      })
      .catch((err: unknown) => {
        console.error(err);

        if (!alive) return;

        const message = getErrorMessage(err, "No se pudo cargar la tienda");

        setProducts([]);
        setTotalProducts(0);
        setTotalPages(1);
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [category, search, currentPage, sortMode, authUser?.client?.category]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleCategoryChange = (value: string) => {
    setLoading(true);
    setError("");
    setCurrentPage(1);
    setCategory(value);
  };

  const handleSearchChange = (value: string) => {
    setLoading(true);
    setError("");
    setCurrentPage(1);
    setSearch(value);
  };

  const handleSortChange = (value: CatalogSortMode) => {
    setLoading(true);
    setError("");
    setCurrentPage(1);
    setSortMode(value);
  };

  const pageStart = totalProducts
    ? (currentPage - 1) * SHOP_PRODUCTS_PAGE_SIZE + 1
    : 0;
  const pageEnd = Math.min(
    currentPage * SHOP_PRODUCTS_PAGE_SIZE,
    totalProducts,
  );

  function getCartQuantity(productId: string) {
    return (
      cartItems.find((item) => item.product.id === productId)?.quantity ?? 0
    );
  }

  function getAvailableStock(product: CatalogProduct) {
    if (product.saleUnit === "KG") {
      return numValue(product.availableKg);
    }

    return numValue(product.availableQuantity);
  }

  function formatStockAmount(product: CatalogProduct, value: number) {
    if (product.saleUnit === "KG") {
      return `${value.toLocaleString("es-AR", {
        maximumFractionDigits: 2,
      })} kg`;
    }

    const units = Math.trunc(value);
    return `${units.toLocaleString("es-AR")} unidad${units === 1 ? "" : "es"}`;
  }

  function updateProductInList(product: CatalogProduct) {
    setProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? adaptProductForCustomer(product, customerCategory)
          : item,
      ),
    );
  }

  const handleAddToCart = async (product: CatalogProduct) => {
    if (!isLoggedIn) {
      toast.error("Para agregar productos al carrito tenés que iniciar sesión");
      router.push("/tienda/login");
      return;
    }

    const productForCustomer = adaptProductForCustomer(
      product,
      customerCategory,
    );

    const currentCartQuantity = getCartQuantity(product.id);
    const nextQuantity = Number((currentCartQuantity + 1).toFixed(2));
    const availableStock = getAvailableStock(productForCustomer);

    if (!productForCustomer.canSell || availableStock <= 0) {
      const locationName = isWholesaleCategory(customerCategory)
        ? "local mayorista"
        : "depósito minorista";

      toast.error(`Este producto no tiene stock disponible en ${locationName}`);
      return;
    }

    if (nextQuantity > availableStock) {
      toast.error(
        `De ${productForCustomer.name} solo hay ${formatStockAmount(
          productForCustomer,
          availableStock,
        )} disponibles.`,
      );
      return;
    }

    setAddingProductId(product.id);

    try {
      const validation = await shopApi.validateCart({
        items: [
          {
            productId: product.id,
            quantity:
              productForCustomer.saleUnit === "KG" ? undefined : nextQuantity,
            quantityKg:
              productForCustomer.saleUnit === "KG" ? nextQuantity : undefined,
          },
        ],
      });

      const validatedItem = validation.items[0];

      if (validatedItem?.product) {
        updateProductInList(validatedItem.product);
      }

      if (!validation.ok || !validatedItem?.ok) {
        toast.error(
          validatedItem?.message ||
            `No hay stock suficiente para ${productForCustomer.name}`,
        );
        return;
      }

      const freshProduct = validatedItem.product
        ? adaptProductForCustomer(validatedItem.product, customerCategory)
        : productForCustomer;

      const result = add(freshProduct, 1);

      if (!result.ok) {
        toast.error(result.message || "No hay stock suficiente");
        return;
      }

      toast.success("Producto agregado al carrito");
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "No se pudo validar el stock del producto",
      );

      toast.error(message);
    } finally {
      setAddingProductId(null);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        :root {
          --bg: #f6f7f9;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --green: #14b86a;
          --green-soft: #e9f9f1;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --amber: #f59e0b;
          --amber-soft: #fffbeb;
          --red: #e11d48;
          --red-soft: #fff1f2;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --shadow-sm: 0 10px 28px rgba(15, 23, 42, 0.06);
          --radius: 18px;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .shop {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        button,
        input,
        select {
          font-family: inherit;
        }

        a {
          color: inherit;
        }

        .topbar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .topbar-inner {
          max-width: 1320px;
          height: 76px;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          flex-shrink: 0;
        }

        .brand-mark {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.18);
        }

        .brand-logo {
          width: 38px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .brand-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          line-height: 1;
        }

        .brand-sub {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }

        .brand-sub strong {
          color: var(--green);
          font-weight: 800;
        }

        .search-box {
          flex: 1;
          max-width: 560px;
          position: relative;
        }

        .search-box input {
          width: 100%;
          height: 46px;
          border: 1px solid var(--line);
          background: #f9fafb;
          border-radius: 999px;
          padding: 0 18px 0 46px;
          outline: none;
          font-size: 14px;
          color: var(--text);
          transition: 0.2s ease;
        }

        .search-box input::placeholder {
          color: var(--soft);
        }

        .search-box input:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 17px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--soft);
          width: 18px;
          height: 18px;
        }

        .header-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-btn {
          height: 42px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .header-btn:hover {
          border-color: var(--line-strong);
          background: #f9fafb;
        }

        .cart-btn {
          height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--white);
          border: 1px solid var(--primary);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 13px;
          font-weight: 800;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .cart-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .cart-count {
          min-width: 21px;
          height: 21px;
          border-radius: 999px;
          background: var(--white);
          color: var(--primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          padding: 0 6px;
        }

        .location-bar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
        }

        .location-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 10px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: var(--muted);
          font-size: 13px;
        }

        .location-left {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .location-left strong {
          color: var(--text);
          font-weight: 700;
        }

        .location-right {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--green);
          font-weight: 800;
        }

        .main {
          max-width: 1320px;
          margin: 0 auto;
          padding: 28px 28px 70px;
        }

        .seo-intro {
          background:
            radial-gradient(circle at top left, rgba(20,184,106,0.12), transparent 34%),
            linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
          border: 1px solid var(--line);
          border-radius: 26px;
          padding: 28px 30px;
          margin-bottom: 22px;
          box-shadow: var(--shadow-sm);
        }

        .seo-kicker {
          margin: 0 0 8px;
          color: var(--green);
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .seo-intro h1 {
          margin: 0;
          max-width: 820px;
          color: var(--text);
          font-size: clamp(28px, 4vw, 46px);
          line-height: 1.02;
          letter-spacing: -0.06em;
          font-weight: 950;
        }

        .seo-intro p {
          margin: 14px 0 0;
          max-width: 780px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.7;
          font-weight: 600;
        }

        .seo-benefits {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .seo-pill {
          height: 34px;
          padding: 0 13px;
          border-radius: 999px;
          background: var(--white);
          border: 1px solid var(--line);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 850;
        }

        .login-banner {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 18px 20px;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .login-banner-text {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.45;
        }

        .login-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--blue-soft);
          color: var(--blue);
          flex-shrink: 0;
        }

        .login-banner-text strong {
          color: var(--text);
        }

        .login-banner-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .login-primary {
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: var(--primary);
          color: var(--white);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .login-secondary {
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          background: var(--white);
          border: 1px solid var(--line);
          color: var(--text);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .content-layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 22px;
          align-items: start;
        }

        .sidebar {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 16px;
          position: sticky;
          top: 118px;
          box-shadow: var(--shadow-sm);
        }

        .sidebar-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
          padding: 0 4px;
          font-size: 13px;
          font-weight: 900;
          color: var(--text);
        }

        .cat-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cat-btn {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 40px;
          border-radius: 14px;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          transition: 0.16s ease;
        }

        .cat-btn:hover {
          background: #f9fafb;
          color: var(--text);
        }

        .cat-btn.active {
          background: var(--primary);
          color: var(--white);
        }

        .cat-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.5;
          flex-shrink: 0;
        }

        .catalog-area {
          min-width: 0;
        }

        .toolbar {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 16px 18px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: var(--shadow-sm);
        }

        .toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .toolbar-title h2 {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
          letter-spacing: -0.03em;
          font-weight: 900;
          color: var(--text);
        }

        .toolbar-title span {
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        .toolbar-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .chip {
          height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f9fafb;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .chip strong {
          color: var(--green);
          font-weight: 900;
        }

        .sort-control {
          height: 34px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--text);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px 0 12px;
        }

        .sort-control svg {
          width: 14px;
          height: 14px;
          color: var(--muted);
          flex-shrink: 0;
        }

        .sort-control select {
          border: 0;
          background: transparent;
          color: var(--text);
          outline: none;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          max-width: 190px;
        }

        .mobile-categories {
          display: none;
          position: relative;
          margin-bottom: 14px;
        }

        .mobile-categories select {
          width: 100%;
          height: 46px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          padding: 0 42px 0 14px;
          font-weight: 800;
          font-size: 13px;
          appearance: none;
          outline: none;
        }

        .mobile-categories svg {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 16px;
        }

        .card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 100%;
          transition: 0.22s ease;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.035);
        }

        .card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow);
          border-color: var(--line-strong);
        }

        .card-img {
          position: relative;
          aspect-ratio: 1 / 1;
          background: linear-gradient(135deg, #f9fafb 0%, #eef2f7 100%);
          overflow: hidden;
        }

        .card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: 0.45s ease;
        }

        .card:hover .card-img img {
          transform: scale(1.045);
        }

        .card-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d1d5db;
        }

        .tag-cat {
          position: absolute;
          top: 12px;
          left: 12px;
          max-width: calc(100% - 24px);
          border-radius: 999px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(229,231,235,0.9);
          backdrop-filter: blur(10px);
          padding: 6px 10px;
          color: var(--text);
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stock-badge {
          position: absolute;
          right: 12px;
          bottom: 12px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          backdrop-filter: blur(10px);
        }

        .stock-badge.in {
          background: rgba(233,249,241,0.96);
          color: var(--green);
          border: 1px solid rgba(20,184,106,0.18);
        }

        .stock-badge.out {
          background: rgba(255,241,242,0.96);
          color: var(--red);
          border: 1px solid rgba(225,29,72,0.16);
        }

        .card-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .card-name {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          line-height: 1.35;
          font-weight: 850;
          letter-spacing: -0.025em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 40px;
        }

        .card-unit {
          margin: 7px 0 14px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .card-footer {
          margin-top: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }

        .price-block {
          min-width: 0;
        }

        .price-label {
          margin: 0 0 4px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 800;
        }

        .price {
          margin: 0;
          color: var(--text);
          font-size: 22px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .out-price {
          margin: 0;
          color: var(--red);
          font-size: 14px;
          font-weight: 900;
        }

        .add-btn {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          border: none;
          background: var(--primary);
          color: var(--white);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: 0.16s ease;
          flex-shrink: 0;
        }

        .add-btn:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .add-btn:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }

        .lock-btn {
          width: 42px;
          height: 42px;
          border-radius: 15px;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: 0.16s ease;
          flex-shrink: 0;
        }

        .lock-btn:hover {
          color: var(--text);
          border-color: var(--line-strong);
          background: var(--white);
        }

        .err-box {
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid rgba(225,29,72,0.15);
          border-radius: 18px;
          padding: 14px 16px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 700;
        }

        .loading-wrap {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--muted);
          box-shadow: var(--shadow-sm);
        }

        .spinner {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 3px solid #e5e7eb;
          border-top-color: var(--primary);
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .empty {
          grid-column: 1 / -1;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 76px 24px;
          text-align: center;
          color: var(--muted);
          box-shadow: var(--shadow-sm);
        }

        .empty svg {
          color: var(--soft);
          margin-bottom: 12px;
        }

        .empty p {
          margin: 0;
          color: var(--text);
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }

        .empty small {
          display: block;
          margin-top: 6px;
          color: var(--muted);
          font-weight: 600;
        }

        .shop-pagination {
          margin-top: 22px;
          padding: 16px;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: var(--white);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          box-shadow: var(--shadow-sm);
        }

        .shop-pagination-info {
          color: var(--muted);
          font-size: 14px;
          font-weight: 850;
        }

        .shop-pagination-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .shop-pagination-btn {
          min-height: 42px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .shop-pagination-btn:hover:not(:disabled) {
          background: #f9fafb;
          border-color: var(--line-strong);
          transform: translateY(-1px);
        }

        .shop-pagination-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }

        .shop-pagination-page {
          color: var(--text);
          font-size: 15px;
          font-weight: 950;
          white-space: nowrap;
        }

        .footer {
          background: var(--white);
          border-top: 1px solid var(--line);
          margin-top: 30px;
        }

        .footer-inner {
          max-width: 1320px;
          margin: 0 auto;
          padding: 26px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .footer-mark {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .footer-logo {
          width: 25px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .footer-links a {
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }

        .footer-links a:hover {
          color: var(--text);
        }

        @media (max-width: 980px) {
          .topbar-inner {
            height: auto;
            padding: 16px 18px;
            flex-wrap: wrap;
            gap: 14px;
          }

          .brand {
            order: 1;
          }

          .header-actions {
            order: 2;
            margin-left: auto;
          }

          .search-box {
            order: 3;
            flex-basis: 100%;
            max-width: none;
          }

          .location-inner {
            padding: 10px 18px;
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .main {
            padding: 20px 18px 56px;
          }

          .seo-intro {
            padding: 24px 20px;
            border-radius: 22px;
          }

          .content-layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .mobile-categories {
            display: block;
          }

          .toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .toolbar-chips {
            justify-content: flex-start;
          }

          .sort-control {
            width: 100%;
            justify-content: flex-start;
          }

          .sort-control select {
            width: 100%;
            max-width: none;
          }
        }

        @media (max-width: 640px) {
          .brand-name {
            font-size: 15px;
          }

          .brand-sub {
            font-size: 11px;
          }

          .header-btn {
            width: 42px;
            padding: 0;
            justify-content: center;
          }

          .header-btn span {
            display: none;
          }

          .cart-btn {
            width: 42px;
            padding: 0;
            justify-content: center;
            position: relative;
          }

          .cart-btn span:not(.cart-count) {
            display: none;
          }

          .cart-count {
            position: absolute;
            top: -6px;
            right: -6px;
            background: var(--green);
            color: var(--white);
            border: 2px solid var(--white);
            min-width: 20px;
            height: 20px;
            font-size: 10px;
          }

          .login-banner {
            flex-direction: column;
            align-items: stretch;
          }

          .login-banner-actions {
            width: 100%;
          }

          .login-primary,
          .login-secondary {
            flex: 1;
          }

          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .card {
            border-radius: 18px;
          }

          .card-body {
            padding: 12px;
          }

          .card-name {
            font-size: 13px;
            min-height: 36px;
          }

          .price {
            font-size: 18px;
          }

          .add-btn,
          .lock-btn {
            width: 38px;
            height: 38px;
            border-radius: 13px;
          }

          .tag-cat {
            font-size: 10px;
            padding: 5px 8px;
          }

          .stock-badge {
            font-size: 10px;
            padding: 6px 8px;
          }

          .shop-pagination {
            display: grid;
            grid-template-columns: 1fr;
            text-align: center;
            padding: 12px;
            border-radius: 18px;
          }

          .shop-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
          }

          .shop-pagination-btn {
            width: 100%;
          }
        }
      `}</style>

      <div className="shop">
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/tienda" className="brand">
              <div className="brand-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Logo"
                  width={120}
                  height={120}
                  className="brand-logo"
                  priority
                />
              </div>

              <div className="brand-text">
                <span className="brand-name">ComarPOS</span>
                <span className="brand-sub">
                  Tienda <strong>{storeSuffix}</strong>
                </span>
              </div>
            </Link>

            <div className="search-box" data-nosnippet="true">
              <Search className="search-icon" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar productos, marcas o categorías..."
              />
            </div>

            <div className="header-actions">
              <Link
                className="header-btn"
                href={isLoggedIn ? "/tienda/cuenta" : "/tienda/login"}
              >
                <UserRound size={16} />
                <span>{accountLabel}</span>
              </Link>

              {isLoggedIn && (
                <Link className="cart-btn" href="/tienda/carrito">
                  <ShoppingCart size={16} />
                  <span>Carrito</span>
                  <span className="cart-count">{cartCount}</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        <div className="location-bar">
          <div className="location-inner">
            <div className="location-left">
  <MapPin size={14} />
  <span>
    Retiro y atención en{" "}
    <strong>
      San Luis 1481, Barrio Observatorio, Córdoba Capital
    </strong>{" "}
    y{" "}
    <strong>
      Paso de los Andes 893, Barrio Observatorio, Córdoba Capital
    </strong>
  </span>
</div>

            <div className="location-right">
              <Store size={14} />
              Catálogo actualizado
            </div>
          </div>
        </div>

        <main className="main">
          <section className="seo-intro">
            <p className="seo-kicker">Tienda y distribuidora de bebidas</p>

            <h1>Tienda online</h1>

            <p>
              Encontrá productos para comercios, eventos y clientes
              particulares. Trabajamos venta mayorista y minorista de fernet,
              cervezas, vinos, gaseosas, energizantes, combos y más productos.
            </p>

            <div className="seo-benefits">
              <span className="seo-pill">Venta mayorista</span>
              <span className="seo-pill">Venta minorista</span>
              <span className="seo-pill">Bebidas para comercios</span>
              <span className="seo-pill">Bebidas para eventos</span>
            </div>
          </section>

          {authChecked && !isLoggedIn && (
            <div className="login-banner">
              <div className="login-banner-text">
                <div className="login-icon">
                  <Lock size={18} />
                </div>

                <span>
                  Estás navegando como visitante. Para comprar y ver condiciones
                  comerciales, ingresá con tu cuenta.
                </span>
              </div>

              <div className="login-banner-actions">
                <Link href="/tienda/login" className="login-primary">
                  Iniciar sesión
                </Link>

                <Link href="/tienda/register" className="login-secondary">
                  Registrarme
                </Link>
              </div>
            </div>
          )}

          {error && <div className="err-box">⚠ {error}</div>}

          <div className="mobile-categories" data-nosnippet="true">
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} />
          </div>

          <div className="content-layout">
            <aside className="sidebar" data-nosnippet="true">
              <div className="sidebar-title">
                <span>Categorías</span>
                <ChevronDown size={15} />
              </div>

              <div className="cat-list">
                <button
                  className={`cat-btn ${category === "" ? "active" : ""}`}
                  onClick={() => handleCategoryChange("")}
                >
                  <span>Todas</span>
                  <span className="cat-dot" />
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`cat-btn ${
                      category === cat.slug ? "active" : ""
                    }`}
                    onClick={() => handleCategoryChange(cat.slug)}
                  >
                    <span>{cat.name}</span>
                    <span className="cat-dot" />
                  </button>
                ))}
              </div>
            </aside>

            <section className="catalog-area" aria-label="Catálogo de bebidas">
              {loading ? (
                <div className="loading-wrap">
                  <div className="spinner" />
                  <span className="loading-label">Cargando catálogo</span>
                </div>
              ) : (
                <>
                  <div className="toolbar">
                    <div className="toolbar-title">
                      <h2>{selectedCategoryName}</h2>
                      <span data-nosnippet="true">
                        {totalProducts}{" "}
                        {totalProducts === 1
                          ? "producto encontrado"
                          : "productos encontrados"}
                      </span>
                    </div>

                    <div className="toolbar-chips" data-nosnippet="true">
                      <div className="chip">
                        Lista: <strong>{storeSuffix}</strong>
                      </div>

                      <div className="chip">
                        Condición: <strong>{priceLabel}</strong>
                      </div>

                      <label className="sort-control">
                        <ArrowUpDown />
                        <select
                          value={sortMode}
                          onChange={(e) =>
                            handleSortChange(e.target.value as CatalogSortMode)
                          }
                          aria-label="Ordenar productos"
                        >
                          <option value="name-asc">Nombre A-Z</option>
                          <option value="name-desc">Nombre Z-A</option>
                          <option value="price-asc">
                            Precio menor a mayor
                          </option>
                          <option value="price-desc">
                            Precio mayor a menor
                          </option>
                          <option value="category-asc">Categoría A-Z</option>
                          <option value="category-desc">Categoría Z-A</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="grid">
                    {products.length === 0 && (
                      <div className="empty">
                        <Package size={42} />
                        <p>No se encontraron productos</p>
                        <small>
                          Probá cambiando la búsqueda o seleccionando otra
                          categoría.
                        </small>
                      </div>
                    )}

                    {products.map((product) => (
                      <article
                        className="card"
                        key={product.id}
                        data-nosnippet="true"
                      >
                        <div className="card-img">
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt={product.name} />
                          ) : (
                            <div className="card-placeholder">
                              <Package size={42} />
                            </div>
                          )}

                          {product.category?.name && (
                            <span className="tag-cat">
                              {product.category.name}
                            </span>
                          )}

                          {product.canSell ? (
                            <span className="stock-badge in">
                              {product.stockLabel}
                            </span>
                          ) : (
                            <span className="stock-badge out">
                              {product.stockLabel}
                            </span>
                          )}
                        </div>

                        <div className="card-body">
                          <h2 className="card-name">{product.name}</h2>

                          <p className="card-unit">
                            {product.saleUnit === "KG"
                              ? "Venta por kilogramo"
                              : "Venta por unidad"}
                          </p>

                          <div className="card-footer">
                            <div className="price-block">
                              <p className="price-label">{priceLabel}</p>

                              {product.canSell ? (
                                <p className="price">
                                  {formatMoney(product.price)}
                                </p>
                              ) : (
                                <p className="out-price">Consultar</p>
                              )}
                            </div>

                            {!isLoggedIn ? (
                              <Link
                                href="/tienda/login"
                                className="lock-btn"
                                title="Iniciar sesión"
                              >
                                <Lock size={16} />
                              </Link>
                            ) : (
                              <button
                                disabled={
                                  !product.canSell ||
                                  addingProductId === product.id
                                }
                                onClick={() => handleAddToCart(product)}
                                className="add-btn"
                                title="Agregar al carrito"
                              >
                                {addingProductId === product.id ? "…" : "+"}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {totalProducts > 0 && (
                    <div className="shop-pagination" data-nosnippet="true">
                      <div className="shop-pagination-info">
                        Mostrando {pageStart} - {pageEnd} de {totalProducts}{" "}
                        productos
                      </div>

                      <div className="shop-pagination-actions">
                        <button
                          type="button"
                          className="shop-pagination-btn"
                          disabled={currentPage === 1}
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                        >
                          Anterior
                        </button>

                        <span className="shop-pagination-page">
                          Página {currentPage} de {totalPages}
                        </span>

                        <button
                          type="button"
                          className="shop-pagination-btn"
                          disabled={currentPage === totalPages}
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(totalPages, prev + 1),
                            )
                          }
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </main>

        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <div className="footer-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Logo"
                  width={80}
                  height={80}
                  className="footer-logo"
                />
              </div>
              ComarPOS
            </div>

            <div className="footer-links">
              <Link href="/tienda">Tienda</Link>

              <Link href={isLoggedIn ? "/tienda/cuenta" : "/tienda/login"}>
                {isLoggedIn ? "Mi cuenta" : "Login"}
              </Link>

              {!isLoggedIn && <Link href="/tienda/register">Registro</Link>}

              {isLoggedIn && <Link href="/tienda/carrito">Carrito</Link>}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
