/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import StockMovementsPanel from "./StockMovementsPanel";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type { MovementLocation, Product, StockMovement } from "@/types";
import { normalizeArray, num, fmtDate } from "@/lib/helpers";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowUpDown,
  BarChart2,
  Camera,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── tipos ────────────────────────────────────────────────────────────────────

type StockMode = "ADD" | "TRANSFER";
type MobileTab = "stock" | "movements";
type SortKey = "category" | "product" | "sku";
type SortDirection = "asc" | "desc";

type StockForm = {
  productId: string;
  from: MovementLocation;
  to: MovementLocation;
  location: MovementLocation;
  quantity: string;
  quantityKg: string;
  mode: StockMode;
};

type MovementGroup = "INGRESS" | "EGRESS" | "TRANSFER";

type MovementUserView = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type MovementProductView = {
  id?: string | null;
  name?: string | null;
  sku?: string | null;
};

type StockMovementView = {
  id: string;
  productId: string;
  userId?: string | null;
  type: string;
  from?: MovementLocation | null;
  to?: MovementLocation | null;
  quantity?: number | null;
  quantityKg?: number | null;
  quantityLabel?: string | null;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
  product?: MovementProductView | null;
  user?: MovementUserView | null;
  movementGroup?: MovementGroup;
};

type MovementSearchResponse = {
  data: StockMovementView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── constantes ───────────────────────────────────────────────────────────────

const emptyForm: StockForm = {
  productId: "",
  from: "LOCAL",
  to: "DEPOSITO",
  location: "LOCAL",
  quantity: "",
  quantityKg: "",
  mode: "ADD",
};

const MOBILE_STOCK_PAGE_SIZE = 8;
const DESKTOP_STOCK_PAGE_SIZE = 20;
const STOCK_SKU_SCANNER_ELEMENT_ID = "comarpos-stock-sku-scanner";

// ─── helpers generales ────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.error ??
    fallback
  );
}

async function fetchStockData() {
  const [p, m] = await Promise.all([
    api.get("/products"),
    api.get("/products/movements").catch(() => ({ data: [] })),
  ]);
  return {
    products: normalizeArray<Product>(p.data),
    movements: normalizeArray<StockMovement>(m.data),
  };
}

// ─── helpers de producto/stock ────────────────────────────────────────────────

type ProductComponentLike = {
  quantity?: number | null;
  quantityKg?: number | null;
  component?: Product | null;
};

type ProductWithComponents = Product & {
  components?: ProductComponentLike[];
};

type StockLocationKey = "LOCAL" | "DEPOSITO";

function isCompositeProduct(product: Product) {
  const p = product as ProductWithComponents;
  return (
    product.type === "COMPUESTO" &&
    Array.isArray(p.components) &&
    p.components.length > 0
  );
}

function getProductMinStock(product: Product, location: StockLocationKey) {
  if (product.saleUnit === "KG") {
    return location === "DEPOSITO"
      ? num((product as any).minStockDepositoKg)
      : num(product.minStockKg);
  }
  return location === "DEPOSITO"
    ? num((product as any).minStockDeposito)
    : num(product.minStock);
}

function getSimpleProductStock(
  product: Product,
  location: StockLocationKey,
  useKg: boolean,
) {
  if (location === "LOCAL") {
    return useKg ? num(product.stockLocalKg) : num(product.stockLocal);
  }
  return useKg ? num(product.stockDepositoKg) : num(product.stockDeposito);
}

function getComponentRequiredAmount(component: ProductComponentLike) {
  const quantityKg = num(component.quantityKg);
  const quantity = num(component.quantity);
  if (quantityKg > 0) return { amount: quantityKg, useKg: true };
  return { amount: quantity, useKg: false };
}

function getCompositeAvailableStock(
  product: Product,
  location: StockLocationKey,
) {
  const components = (product as ProductWithComponents).components ?? [];
  if (!components.length) return 0;

  let available = Number.POSITIVE_INFINITY;
  for (const item of components) {
    const componentProduct = item.component;
    if (!componentProduct) return 0;
    const required = getComponentRequiredAmount(item);
    if (required.amount <= 0) continue;
    const componentStock = getSimpleProductStock(
      componentProduct,
      location,
      required.useKg,
    );
    available = Math.min(available, Math.floor(componentStock / required.amount));
  }

  if (!Number.isFinite(available)) return 0;
  return Math.max(0, available);
}

function getProductStockByLocation(product: Product, location: StockLocationKey) {
  if (isCompositeProduct(product)) return getCompositeAvailableStock(product, location);
  return getSimpleProductStock(product, location, product.saleUnit === "KG");
}

function getProductLocalStock(product: Product) {
  return getProductStockByLocation(product, "LOCAL");
}

function getProductDepositoStock(product: Product) {
  return getProductStockByLocation(product, "DEPOSITO");
}

function getStockUnit(product: Product) {
  if (isCompositeProduct(product)) return " promos";
  return product.saleUnit === "KG" ? " kg" : "";
}

function isLowStock(stock: number, min: number) {
  return min > 0 && stock <= min;
}

function getStockStatus(localLow: boolean, depositoLow: boolean) {
  if (localLow && depositoLow) return "BAJO EN AMBOS";
  if (localLow) return "BAJO EN MAYORISTA";
  if (depositoLow) return "BAJO EN MINORISTA";
  return "OK";
}

function getStockLowDetail(localLow: boolean, depositoLow: boolean) {
  if (localLow && depositoLow) return "Bajo de stock en Mayorista y Minorista";
  if (localLow) return "Bajo de stock en Mayorista";
  if (depositoLow) return "Bajo de stock en Minorista";
  return "Stock correcto en ambos depósitos";
}

function getStockBadgeClass(localLow: boolean, depositoLow: boolean) {
  return localLow || depositoLow ? "badge-red" : "badge-green";
}

function getProductCategoryLabel(product: Product) {
  const p = product as Product & {
    category?: { name?: string | null; nombre?: string | null } | string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
  };
  if (typeof p.category === "string" && p.category.trim()) return p.category;
  if (p.category && typeof p.category === "object") {
    return p.category.name ?? p.category.nombre ?? "Sin categoría";
  }
  return p.categoryName ?? p.categorySlug ?? "Sin categoría";
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const alphaSorter = new Intl.Collator("es-AR", {
  numeric: true,
  sensitivity: "base",
});

// ─── helpers de movimientos (compartidos con el modal) ────────────────────────

function getMovementGroup(movement: StockMovementView): MovementGroup {
  if (movement.movementGroup) return movement.movementGroup;
  if (movement.type === "TRANSFER") return "TRANSFER";
  if (movement.type === "INGRESS" || movement.type === "SALE_CANCEL") return "INGRESS";
  return "EGRESS";
}

function movementIcon(group: MovementGroup) {
  if (group === "TRANSFER") return <ArrowLeftRight size={14} />;
  if (group === "INGRESS") return <ArrowDownCircle size={14} />;
  return <ArrowUpCircle size={14} />;
}

function movementLabel(group: MovementGroup) {
  if (group === "TRANSFER") return "Movimiento";
  if (group === "INGRESS") return "Ingreso";
  return "Salida";
}

function movementLocationLabel(location?: MovementLocation | null) {
  if (location === "LOCAL") return "Mayorista";
  if (location === "DEPOSITO") return "Minorista";
  return "—";
}

function getMovementUserLabel(movement: StockMovementView) {
  if (movement.user?.name) return movement.user.name;
  if (movement.user?.email) return movement.user.email;
  if (movement.userId) return `Usuario #${String(movement.userId).slice(-8)}`;
  return "Sin usuario";
}

function getQuantityLabel(movement: StockMovementView) {
  if (movement.quantityLabel) return movement.quantityLabel;
  if (movement.quantityKg != null) return `${movement.quantityKg} kg`;
  if (movement.quantity != null) return String(movement.quantity);
  return "—";
}

// ─── modal de movimientos por producto ────────────────────────────────────────

function ProductMovementsModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const [data, setData] = useState<StockMovementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const query = new URLSearchParams({
      limit: "15",
      page: String(page),
      productId: product.id,
    }).toString();

    api
      .get<MovementSearchResponse>(`/products/movements/search?${query}`)
      .then((res) => {
        if (!alive) return;
        const payload = res.data;
        setData(Array.isArray(payload.data) ? payload.data : []);
        setTotalPages(payload.totalPages ?? 1);
        setTotal(payload.total ?? 0);
      })
      .catch((err) => {
        console.error("Error cargando movimientos del producto", err);
        if (!alive) return;
        setData([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [product.id, page]);

  // cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="pmm-backdrop" onClick={onClose}>
      <div className="pmm-modal" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="pmm-header">
          <div>
            <b>{product.name}</b>
            <small>
              {product.sku || "Sin SKU"} · {getProductCategoryLabel(product)}
            </small>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="pmm-body">
          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 14 }} />
          ) : data.length === 0 ? (
            <div className="empty-state">
              <BarChart2 size={32} />
              <p>Sin movimientos para este producto</p>
            </div>
          ) : (
            <>
              {/* tabla desktop */}
              <table className="pmm-table-desktop">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hacia</th>
                    <th>Cantidad</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((m) => {
                    const group = getMovementGroup(m);
                    return (
                      <tr key={m.id}>
                        <td>{fmtDate(m.createdAt)}</td>
                        <td>
                          <span className={`stock-movement-badge is-${group.toLowerCase()}`}>
                            {movementIcon(group)}
                            {movementLabel(group)}
                          </span>
                        </td>
                        <td>{movementLocationLabel(m.from)}</td>
                        <td>{movementLocationLabel(m.to)}</td>
                        <td style={{ fontFamily: "var(--mono)" }}>
                          {getQuantityLabel(m)}
                        </td>
                        <td>{getMovementUserLabel(m)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* cards mobile */}
              <div className="pmm-mobile-list">
                {data.map((m) => {
                  const group = getMovementGroup(m);
                  return (
                    <article key={m.id} className="pmm-mobile-card">
                      <div className="pmm-mobile-card-head">
                        <span>{fmtDate(m.createdAt)}</span>
                        <span className={`stock-movement-badge is-${group.toLowerCase()}`}>
                          {movementIcon(group)}
                          {movementLabel(group)}
                        </span>
                      </div>
                      <div className="pmm-mobile-card-grid">
                        <div>
                          <small>Desde</small>
                          <strong>{movementLocationLabel(m.from)}</strong>
                        </div>
                        <div>
                          <small>Hacia</small>
                          <strong>{movementLocationLabel(m.to)}</strong>
                        </div>
                        <div>
                          <small>Cantidad</small>
                          <strong style={{ fontFamily: "var(--mono)" }}>
                            {getQuantityLabel(m)}
                          </strong>
                        </div>
                        <div>
                          <small>Usuario</small>
                          <strong>{getMovementUserLabel(m)}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* footer paginación */}
        {!loading && totalPages > 1 && (
          <div className="pmm-footer">
            <span>
              Página {page} de {totalPages} · {total} movimientos
            </span>
            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .pmm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483600;
          background: rgba(0, 0, 0, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .pmm-modal {
          width: min(780px, 100%);
          max-height: min(85dvh, 700px);
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--surface);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }

        .pmm-header {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-shrink: 0;
        }

        .pmm-header b {
          display: block;
          font-size: 15px;
          font-weight: 900;
          color: var(--text);
        }

        .pmm-header small {
          display: block;
          margin-top: 3px;
          color: var(--text3);
          font-size: 11px;
          font-family: var(--mono);
        }

        .pmm-body {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 14px;
        }

        /* tabla desktop */
        .pmm-table-desktop {
          width: 100%;
          border-collapse: collapse;
        }

        .pmm-table-desktop th,
        .pmm-table-desktop td {
          padding: 9px 10px;
          text-align: left;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }

        .pmm-table-desktop th {
          font-weight: 900;
          color: var(--text2);
          font-size: 11px;
        }

        /* cards mobile */
        .pmm-mobile-list {
          display: none;
          flex-direction: column;
          gap: 8px;
        }

        .pmm-mobile-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .pmm-mobile-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .pmm-mobile-card-head > span:first-child {
          color: var(--text3);
          font-size: 11px;
          font-family: var(--mono);
          font-weight: 800;
        }

        .pmm-mobile-card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .pmm-mobile-card-grid > div {
          background: var(--bg);
          border-radius: 10px;
          padding: 6px 8px;
          display: grid;
          gap: 2px;
        }

        .pmm-mobile-card-grid small {
          color: var(--text3);
          font-size: 9.5px;
          font-weight: 900;
        }

        .pmm-mobile-card-grid strong {
          color: var(--text);
          font-size: 12px;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pmm-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .pmm-footer span {
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
        }

        .pmm-footer > div {
          display: flex;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .pmm-backdrop {
            align-items: flex-end;
            padding: 0;
          }

          .pmm-modal {
            width: 100%;
            max-height: 90dvh;
            border-radius: 22px 22px 0 0;
          }

          .pmm-table-desktop {
            display: none;
          }

          .pmm-mobile-list {
            display: flex;
          }

          .pmm-footer > div {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .pmm-footer > div button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<StockForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("movements");
  const [mobileStockPage, setMobileStockPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerLoading, setScannerLoading] = useState(false);
  const [selectedProductForMovements, setSelectedProductForMovements] =
    useState<Product | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("product");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const scannerInstanceRef = useRef<any>(null);
  const scannerHandledRef = useRef(false);
  const movementsSectionRef = useRef<HTMLDivElement | null>(null);

  const load = async (showSuccess = false) => {
    setLoading(true);
    try {
      const data = await fetchStockData();
      setProducts(data.products);
      setMovements(data.movements);
      if (showSuccess) toast.success("Stock actualizado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchStockData()
      .then((data) => {
        if (!alive) return;
        setProducts(data.products);
        setMovements(data.movements);
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        toast.error("Error al cargar stock");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);

    const result = products.filter((p) => {
      if (!q) return true;
      return (
        normalizeSearch(p.name).includes(q) ||
        normalizeSearch(String(p.sku ?? "")).includes(q) ||
        normalizeSearch(getProductCategoryLabel(p)).includes(q)
      );
    });

    return [...result].sort((a, b) => {
      let aValue = "";
      let bValue = "";
      if (sortKey === "product") { aValue = a.name; bValue = b.name; }
      if (sortKey === "sku") { aValue = String(a.sku ?? ""); bValue = String(b.sku ?? ""); }
      if (sortKey === "category") { aValue = getProductCategoryLabel(a); bValue = getProductCategoryLabel(b); }
      const order = alphaSorter.compare(aValue, bValue);
      return sortDirection === "asc" ? order : -order;
    });
  }, [products, search, sortKey, sortDirection]);

  const desktopStockTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / DESKTOP_STOCK_PAGE_SIZE),
  );
  const mobileStockTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / MOBILE_STOCK_PAGE_SIZE),
  );
  const safeDesktopStockPage = Math.min(
    Math.max(1, mobileStockPage),
    desktopStockTotalPages,
  );
  const safeMobileStockPage = Math.min(
    Math.max(1, mobileStockPage),
    mobileStockTotalPages,
  );
  const desktopStockItems = filtered.slice(
    (safeDesktopStockPage - 1) * DESKTOP_STOCK_PAGE_SIZE,
    safeDesktopStockPage * DESKTOP_STOCK_PAGE_SIZE,
  );
  const desktopStockStart =
    filtered.length === 0
      ? 0
      : (safeDesktopStockPage - 1) * DESKTOP_STOCK_PAGE_SIZE + 1;
  const desktopStockEnd = Math.min(
    filtered.length,
    safeDesktopStockPage * DESKTOP_STOCK_PAGE_SIZE,
  );
  const mobileStockItems = filtered.slice(
    (safeMobileStockPage - 1) * MOBILE_STOCK_PAGE_SIZE,
    safeMobileStockPage * MOBILE_STOCK_PAGE_SIZE,
  );

  const lowStockCount = products.filter((p) => {
    const localMin = getProductMinStock(p, "LOCAL");
    const depositoMin = getProductMinStock(p, "DEPOSITO");
    return (
      isLowStock(getProductLocalStock(p), localMin) ||
      isLowStock(getProductDepositoStock(p), depositoMin)
    );
  }).length;

  const selected = products.find((p) => p.id === form.productId);

  const stockProducts = useMemo(
    () =>
      products
        .filter((p) => p.type === "SIMPLE" && !p.isService)
        .sort((a, b) => alphaSorter.compare(a.name, b.name)),
    [products],
  );

  const productSearchResults = useMemo(() => {
    const q = normalizeSearch(productSearch);
    if (!q) return [];
    return stockProducts
      .filter((p) =>
        normalizeSearch(p.name).includes(q) ||
        normalizeSearch(String(p.sku ?? "")).includes(q) ||
        normalizeSearch(getProductCategoryLabel(p)).includes(q),
      )
      .slice(0, 12);
  }, [productSearch, stockProducts]);

  const selectProduct = (product: Product) => {
    setForm((prev) => ({ ...prev, productId: product.id, quantity: "", quantityKg: "" }));
    setProductSearch(`${product.sku ? `${product.sku} · ` : ""}${product.name}`);
    setProductPickerOpen(false);
  };

  const toggleSort = (key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) { setSortDirection("asc"); return key; }
      setSortDirection((prevDirection) => prevDirection === "asc" ? "desc" : "asc");
      return prevKey;
    });
  };

  const sortLabel = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  const handleScannedSku = (value: string) => {
    const scanned = value.trim();
    if (!scanned) return;

    const found = stockProducts.find(
      (p) => normalizeSearch(String(p.sku ?? "")) === normalizeSearch(scanned),
    );

    if (!found) {
      toast.error(`No encontré ningún producto con SKU ${scanned}`);
      setProductSearch(scanned);
      setProductPickerOpen(true);
      return;
    }

    selectProduct(found);
    toast.success(`Producto seleccionado: ${found.name}`);
  };

  const stopScanner = async () => {
    const scanner = scannerInstanceRef.current;
    scannerHandledRef.current = false;
    if (!scanner) return;

    try {
      const state = scanner.getState?.();
      if (state === 2) await scanner.stop();
    } catch (e) {
      console.warn("No se pudo detener el scanner", e);
    }

    try {
      await scanner.clear?.();
    } catch {
      // puede fallar si el contenedor ya fue desmontado
    }

    scannerInstanceRef.current = null;
  };

  const closeScanner = async () => {
    await stopScanner();
    setScannerError("");
    setScannerLoading(false);
    setScannerOpen(false);
  };

  const openScanner = () => {
    setScannerError("");
    setScannerLoading(true);
    setProductPickerOpen(false);
    scannerHandledRef.current = false;
    setScannerOpen(true);
  };

  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;

    const startScanner = async () => {
      setScannerLoading(true);
      setScannerError("");

      try {
        if (typeof window === "undefined") return;

        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(STOCK_SKU_SCANNER_ELEMENT_ID);
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.72,
              );
              return {
                width: Math.max(220, Math.min(size, 340)),
                height: Math.max(120, Math.min(Math.floor(size * 0.55), 220)),
              };
            },
            aspectRatio: 1.777,
          },
          async (decodedText: string) => {
            const sku = decodedText.trim();
            if (!sku || scannerHandledRef.current) return;
            scannerHandledRef.current = true;
            handleScannedSku(sku);
            await closeScanner();
          },
          () => {
            // ignorar lecturas fallidas
          },
        );

        if (!cancelled) setScannerLoading(false);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setScannerLoading(false);
          setScannerError(
            e?.message?.includes("Permission")
              ? "No se pudo acceder a la cámara. Revisá los permisos del navegador."
              : "No se pudo iniciar la cámara. Probá con HTTPS, otro navegador o buscá el SKU manualmente.",
          );
        }
      }
    };

    const timeoutId = window.setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      void stopScanner();
    };
  }, [scannerOpen, stockProducts]);

  const save = async () => {
    if (!selected) { toast.error("Seleccioná un producto"); return; }

    const quantity = num(form.quantity);
    const quantityKg = num(form.quantityKg);
    const isKg = selected.saleUnit === "KG";
    const isTransfer = form.mode === "TRANSFER";

    if (isKg && quantityKg <= 0) { toast.error("Ingresá una cantidad válida en kg"); return; }
    if (!isKg && quantity <= 0) { toast.error("Ingresá una cantidad válida"); return; }
    if (isTransfer && form.from === form.to) { toast.error("El origen y el destino no pueden ser iguales"); return; }

    setSaving(true);
    const toastId = toast.loading(isTransfer ? "Transfiriendo stock..." : "Agregando stock...");

    try {
      if (isTransfer) {
        if (isKg) {
          await api.post(`/products/${selected.id}/transfer-kg`, { from: form.from, to: form.to, quantityKg });
        } else {
          await api.post("/products/transfer", { productId: selected.id, from: form.from, to: form.to, quantity });
        }
      } else {
        if (isKg) {
          await api.post(`/products/${selected.id}/add-stock-kg`, { to: form.location, quantityKg });
        } else {
          await api.post("/products/add-stock", { productId: selected.id, to: form.location, quantity });
        }
      }

      setForm(emptyForm);
      setProductSearch("");
      setProductPickerOpen(false);
      setMobileSheetOpen(false);
      toast.success(isTransfer ? "Stock transferido correctamente" : "Stock agregado correctamente", { id: toastId });
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al mover stock"), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  // ─── form de stock (reutilizado en desktop y mobile sheet) ────────────────

  const stockFormContent = (
    <div
      className="stock-form-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 0.9fr 1fr 1fr auto",
        gap: 10,
        alignItems: "end",
      }}
    >
      <div className="stock-product-picker">
        <label className="form-label">Producto / SKU</label>

        <div className="stock-product-search-row">
          <div className="stock-product-search-box">
            <Search size={14} />
            <input
              value={productSearch}
              onFocus={() => setProductPickerOpen(normalizeSearch(productSearch).length > 0)}
              onChange={(e) => {
                const value = e.target.value;
                setProductSearch(value);
                setProductPickerOpen(normalizeSearch(value).length > 0);
                setForm((prev) => ({ ...prev, productId: "" }));
              }}
              onKeyDown={(e) => { if (e.key === "Escape") setProductPickerOpen(false); }}
              placeholder="Buscar por nombre, SKU o categoría..."
              disabled={saving}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary stock-scan-btn"
            onClick={openScanner}
            disabled={saving}
            title="Escanear SKU"
          >
            <ScanBarcode size={15} />
            Escanear
          </button>
        </div>

        {productPickerOpen && !selected && productSearchResults.length > 0 && (
          <div className="stock-product-results">
            {productSearchResults.map((p) => {
              const local = getProductLocalStock(p);
              const deposito = getProductDepositoStock(p);
              const unit = getStockUnit(p);
              return (
                <button type="button" key={p.id} onClick={() => selectProduct(p)} disabled={saving}>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.sku || "Sin SKU"} · {getProductCategoryLabel(p)}</small>
                  </span>
                  <em>May. {local}{unit} · Min. {deposito}{unit}</em>
                </button>
              );
            })}
          </div>
        )}

        {productPickerOpen && productSearch && !selected && productSearchResults.length === 0 && (
          <div className="stock-product-results stock-product-results-empty">
            <p>No encontré productos con ese nombre, SKU o categoría.</p>
          </div>
        )}

        {selected && (
          <div className="stock-selected-product">
            <div>
              <b>{selected.name}</b>
              <small>{selected.sku || "Sin SKU"} · {getProductCategoryLabel(selected)}</small>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setForm((prev) => ({ ...prev, productId: "" })); setProductSearch(""); setProductPickerOpen(false); }}
              disabled={saving}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="form-label">Operación</label>
        <select
          value={form.mode}
          onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value as StockMode }))}
          disabled={saving}
        >
          <option value="ADD">Agregar</option>
          <option value="TRANSFER">Transferir</option>
        </select>
      </div>

      {form.mode === "TRANSFER" ? (
        <>
          <div>
            <label className="form-label">Desde</label>
            <select
              value={form.from}
              onChange={(e) => setForm((p) => ({ ...p, from: e.target.value as MovementLocation }))}
              disabled={saving}
            >
              <option value="LOCAL">Mayorista</option>
              <option value="DEPOSITO">Minorista</option>
            </select>
          </div>
          <div>
            <label className="form-label">Hacia</label>
            <select
              value={form.to}
              onChange={(e) => setForm((p) => ({ ...p, to: e.target.value as MovementLocation }))}
              disabled={saving}
            >
              <option value="LOCAL">Mayorista</option>
              <option value="DEPOSITO">Minorista</option>
            </select>
          </div>
        </>
      ) : (
        <div className="stock-location-field">
          <label className="form-label">Destino</label>
          <select
            value={form.location}
            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value as MovementLocation }))}
            disabled={saving}
          >
            <option value="LOCAL">Mayorista</option>
            <option value="DEPOSITO">Minorista</option>
          </select>
        </div>
      )}

      <div>
        <label className="form-label">
          Cantidad {selected?.saleUnit === "KG" ? "kg" : ""}
        </label>
        <input
          type="number"
          min="0"
          step={selected?.saleUnit === "KG" ? "0.001" : "1"}
          value={selected?.saleUnit === "KG" ? form.quantityKg : form.quantity}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              [selected?.saleUnit === "KG" ? "quantityKg" : "quantity"]: e.target.value,
            }))
          }
          disabled={saving}
        />
      </div>

      <button
        className="btn btn-primary stock-submit-btn"
        onClick={save}
        disabled={saving || !selected}
      >
        {saving ? (
          <span className="spinner" />
        ) : form.mode === "TRANSFER" ? (
          <><ArrowLeftRight size={14} /> Transferir</>
        ) : (
          "Agregar stock"
        )}
      </button>
    </div>
  );

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout
      title="Stock"
      subtitle="Carga de stock, historial de movimientos e inventario"
    >
      {/* resumen mobile */}
      <div className="stock-mobile-summary">
        <div className="stock-mobile-summary-grid">
          <div><small>Productos</small><b>{products.length}</b></div>
          <div>
            <small>Stock bajo</small>
            <b className={lowStockCount > 0 ? "stock-danger" : ""}>{lowStockCount}</b>
          </div>
          <div><small>Movimientos</small><b>{movements.length}</b></div>
        </div>

        <button
          className="btn btn-primary stock-mobile-open-sheet"
          onClick={() => setMobileSheetOpen(true)}
        >
          {form.mode === "TRANSFER" ? <ArrowLeftRight size={15} /> : <ArrowDownCircle size={15} />}
          Mover stock
        </button>
      </div>

      {/* tabs mobile */}
      <div className="stock-mobile-tabs">
        <button
          type="button"
          className={mobileTab === "movements" ? "is-active" : ""}
          onClick={() => setMobileTab("movements")}
        >
          Movimientos
        </button>
        <button
          type="button"
          className={mobileTab === "stock" ? "is-active" : ""}
          onClick={() => setMobileTab("stock")}
        >
          Inventario
        </button>
      </div>

      {/* form desktop */}
      <div className="card stock-form-card" style={{ padding: 16, marginBottom: 18 }}>
        {stockFormContent}
      </div>

      <StockMovementsPanel ref={movementsSectionRef} />

      {/* buscador inventario */}
      <div className="stock-toolbar">
        <div className="stock-search" style={{ position: "relative", maxWidth: 420, flex: "1 1 320px" }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }}
          />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setMobileStockPage(1); }}
            placeholder="Buscar producto, SKU o categoría..."
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      {/* tabla inventario */}
      <div className="card stock-card stock-inventory-card" style={{ marginBottom: 18 }}>
        <div className="table-wrap stock-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 200 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className="stock-sort-th" onClick={() => toggleSort("product")}>
                      Producto{sortLabel("product")}<ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="stock-sort-th" onClick={() => toggleSort("sku")}>
                      SKU{sortLabel("sku")}<ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="stock-sort-th" onClick={() => toggleSort("category")}>
                      Categoría{sortLabel("category")}<ArrowUpDown size={13} />
                    </button>
                  </th>
                  <th>Unidad</th>
                  <th>Mayorista</th>
                  <th>Minorista</th>
                  <th>Mín. Mayorista</th>
                  <th>Mín. Minorista</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {desktopStockItems.map((p) => {
                  const local = getProductLocalStock(p);
                  const deposito = getProductDepositoStock(p);
                  const localMin = getProductMinStock(p, "LOCAL");
                  const depositoMin = getProductMinStock(p, "DEPOSITO");
                  const unit = getStockUnit(p);
                  const localLow = isLowStock(local, localMin);
                  const depositoLow = isLowStock(deposito, depositoMin);
                  const status = getStockStatus(localLow, depositoLow);
                  const badgeClass = getStockBadgeClass(localLow, depositoLow);

                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: "pointer" }}
                      title="Ver movimientos de este producto"
                      onClick={() => setSelectedProductForMovements(p)}
                    >
                      <td>
                        <div className="stock-product-name">
                          <b>{p.name}</b>
                          {isCompositeProduct(p) && (
                            <span className="stock-product-note">Promo calculada por componentes</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontFamily: "var(--mono)" }}>{p.sku || "—"}</td>
                      <td>{getProductCategoryLabel(p)}</td>
                      <td>
                        <span className="badge badge-gray">
                          {isCompositeProduct(p) ? "PROMO" : p.saleUnit}
                        </span>
                      </td>
                      <td style={{ fontFamily: "var(--mono)", color: localLow ? "var(--danger)" : "var(--text)", fontWeight: localLow ? 900 : 500 }}>
                        {local}{unit}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", color: depositoLow ? "var(--danger)" : "var(--text)", fontWeight: depositoLow ? 900 : 500 }}>
                        {deposito}{unit}
                      </td>
                      <td>{localMin}{unit}</td>
                      <td>{depositoMin}{unit}</td>
                      <td>
                        <div className="stock-status-cell">
                          <span className={`badge ${badgeClass}`}>{status}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state"><BarChart2 size={36} /><p>Sin productos</p></div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="stock-desktop-pagination">
            <span>
              Mostrando {desktopStockStart} - {desktopStockEnd} de {filtered.length}
              {filtered.length === 1 ? " producto" : " productos"}
            </span>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={safeDesktopStockPage === 1}
                onClick={() => setMobileStockPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <span>Página {safeDesktopStockPage} de {desktopStockTotalPages}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={safeDesktopStockPage === desktopStockTotalPages}
                onClick={() => setMobileStockPage((prev) => Math.min(desktopStockTotalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {/* lista mobile */}
        <div className="stock-mobile-list">
          {loading ? (
            <div style={{ padding: 10 }}>
              <div className="skeleton" style={{ height: 170, borderRadius: 16 }} />
            </div>
          ) : (
            mobileStockItems.map((p) => {
              const local = getProductLocalStock(p);
              const deposito = getProductDepositoStock(p);
              const localMin = getProductMinStock(p, "LOCAL");
              const depositoMin = getProductMinStock(p, "DEPOSITO");
              const unit = getStockUnit(p);
              const localLow = isLowStock(local, localMin);
              const depositoLow = isLowStock(deposito, depositoMin);
              const status = getStockStatus(localLow, depositoLow);
              const badgeClass = getStockBadgeClass(localLow, depositoLow);

              return (
                <article
                  className="stock-mobile-item"
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  title="Ver movimientos de este producto"
                  onClick={() => setSelectedProductForMovements(p)}
                >
                  <div className="stock-mobile-head">
                    <div>
                      <h3>{p.name}</h3>
                      <span>
                        {p.sku || "Sin SKU"} · {getProductCategoryLabel(p)} ·{" "}
                        {isCompositeProduct(p) ? "PROMO" : p.saleUnit} · Mín. May. {localMin}{unit} · Mín. Min. {depositoMin}{unit}
                      </span>
                    </div>
                    <span className={`badge ${badgeClass}`}>{status}</span>
                  </div>

                  {(localLow || depositoLow) && (
                    <div className="stock-mobile-alert">
                      {getStockLowDetail(localLow, depositoLow)}
                    </div>
                  )}

                  {isCompositeProduct(p) && (
                    <div className="stock-mobile-chip-row">
                      <span className="badge badge-gray">Stock por componentes</span>
                    </div>
                  )}

                  <div className="stock-mobile-data">
                    <div>
                      <small>Mayorista</small>
                      <strong className={localLow ? "stock-danger" : ""}>{local}{unit}</strong>
                    </div>
                    <div>
                      <small>Minorista</small>
                      <strong className={depositoLow ? "stock-danger" : ""}>{deposito}{unit}</strong>
                    </div>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !filtered.length && (
            <div className="empty-state"><BarChart2 size={36} /><p>Sin productos</p></div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="stock-mobile-pagination">
            <span>Página {safeMobileStockPage} de {mobileStockTotalPages} · {filtered.length} productos</span>
            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileStockPage === 1}
                onClick={() => setMobileStockPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobileStockPage === mobileStockTotalPages}
                onClick={() => setMobileStockPage((prev) => Math.min(mobileStockTotalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* scanner */}
      {scannerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="stock-scanner-backdrop" onClick={closeScanner}>
            <div className="stock-scanner-modal" onClick={(e) => e.stopPropagation()}>
              <div className="stock-scanner-header">
                <div>
                  <b>Escanear SKU</b>
                  <small>Apuntá al código de barras o QR del producto.</small>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={closeScanner}>
                  <X size={16} />
                </button>
              </div>

              <div className="stock-scanner-camera">
                <div id={STOCK_SKU_SCANNER_ELEMENT_ID} className="stock-scanner-reader" />
                {scannerLoading && (
                  <div className="stock-scanner-loading">
                    <span className="spinner" />
                    <p>Iniciando cámara...</p>
                  </div>
                )}
              </div>

              {scannerError ? (
                <div className="stock-scanner-error-box">
                  <Camera size={16} />
                  <span>{scannerError}</span>
                </div>
              ) : (
                <div className="stock-scanner-footer">
                  <small>Tip: acercá el código, evitá reflejos y usá buena luz.</small>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* mobile sheet */}
      {mobileSheetOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="stock-mobile-sheet-backdrop"
            onClick={() => !saving && setMobileSheetOpen(false)}
          >
            <div className="stock-mobile-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="stock-mobile-sheet-handle" />
              <div className="stock-mobile-sheet-header">
                <div>
                  <b>Mover stock</b>
                  <small>Agregá o transferí inventario rápido.</small>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => !saving && setMobileSheetOpen(false)}
                  disabled={saving}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="stock-mobile-sheet-body">{stockFormContent}</div>
            </div>
          </div>,
          document.body,
        )}

      {/* modal movimientos por producto */}
      {selectedProductForMovements &&
        typeof document !== "undefined" &&
        createPortal(
          <ProductMovementsModal
            product={selectedProductForMovements}
            onClose={() => setSelectedProductForMovements(null)}
          />,
          document.body,
        )}

      <style jsx global>{`
        .stock-mobile-list,
        .stock-mobile-summary,
        .stock-mobile-tabs,
        .stock-mobile-pagination {
          display: none;
        }

        .stock-desktop-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          background: var(--surface);
        }

        .stock-desktop-pagination > span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .stock-desktop-pagination > div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .stock-desktop-pagination > div > span {
          color: var(--text2);
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .stock-toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .stock-go-movements-btn { white-space: nowrap; }
        .stock-location-field { grid-column: auto; }

        .stock-product-picker { position: relative; min-width: 0; }

        .stock-product-search-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
        }

        .stock-product-search-box { position: relative; min-width: 0; }

        .stock-product-search-box svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text3);
          pointer-events: none;
        }

        .stock-product-search-box input { padding-left: 34px; }
        .stock-scan-btn { white-space: nowrap; }

        .stock-product-results {
          position: absolute;
          left: 0;
          right: 0;
          top: calc(100% + 6px);
          z-index: 60;
          max-height: 320px;
          overflow-y: auto;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
          padding: 6px;
        }

        .stock-product-results button {
          width: 100%;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--text);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          text-align: left;
          padding: 9px 10px;
          cursor: pointer;
        }

        .stock-product-results button:hover { background: var(--surface2); }

        .stock-product-results span { display: grid; gap: 3px; min-width: 0; }

        .stock-product-results b {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stock-product-results small {
          color: var(--text3);
          font-size: 11px;
          font-family: var(--mono);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stock-product-results em {
          flex-shrink: 0;
          color: var(--text2);
          font-size: 11px;
          font-style: normal;
          font-family: var(--mono);
        }

        .stock-product-results-empty { padding: 10px; }

        .stock-product-results-empty p {
          margin: 0;
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .stock-selected-product {
          margin-top: 8px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface2);
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stock-selected-product div { min-width: 0; display: grid; gap: 3px; }

        .stock-selected-product b {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stock-selected-product small {
          color: var(--text3);
          font-size: 11px;
          font-family: var(--mono);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stock-sort-th {
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 0;
        }

        .stock-sort-th:hover { color: var(--accent); }

        /* hover sutil en filas clickeables */
        .stock-desktop-table tbody tr:hover {
          background: color-mix(in srgb, var(--accent) 5%, transparent);
        }

        .stock-scanner-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483500;
          background: rgba(0, 0, 0, 0.62);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .stock-scanner-modal {
          width: min(520px, 100%);
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--surface);
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        }

        .stock-scanner-header {
          padding: 14px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .stock-scanner-header b { display: block; color: var(--text); font-size: 15px; }
        .stock-scanner-header small { display: block; margin-top: 3px; color: var(--text3); font-size: 11px; }

        .stock-scanner-camera {
          position: relative;
          min-height: 300px;
          overflow: hidden;
          border-bottom: 1px solid var(--border);
          background: #000;
          display: block;
        }

        .stock-scanner-reader { width: 100%; min-height: 300px; }

        .stock-scanner-reader video {
          width: 100% !important;
          height: 300px !important;
          object-fit: cover !important;
        }

        .stock-scanner-loading {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.72);
          color: white;
          z-index: 2;
        }

        .stock-scanner-loading p { margin: 0; font-size: 12px; font-weight: 800; }

        .stock-scanner-error-box {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 13px;
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          padding: 10px 12px;
          margin: 12px;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 800;
        }

        .stock-scanner-footer { padding: 11px 14px; color: var(--text3); font-size: 11px; font-weight: 800; }

        .stock-product-name { display: grid; gap: 4px; }
        .stock-product-note { color: var(--text3); font-size: 11px; font-weight: 800; }
        .stock-status-cell { display: grid; gap: 5px; align-items: start; }

        .stock-low-detail { color: var(--danger); font-size: 11px; font-weight: 800; line-height: 1.2; }

        .stock-mobile-alert {
          border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
          background: color-mix(in srgb, var(--danger) 10%, transparent);
          color: var(--danger);
          border-radius: 10px;
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.25;
        }

        @media (max-width: 1200px) {
          .stock-form-grid { grid-template-columns: 1.5fr 1fr 1fr !important; }
          .stock-submit-btn { grid-column: 1 / -1; width: 100%; justify-content: center; }
          .stock-location-field { grid-column: auto; }
        }

        @media (max-width: 768px) {
          .stock-mobile-summary { display: grid; gap: 10px; margin-bottom: 10px; }

          .stock-mobile-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }

          .stock-mobile-summary-grid > div {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 8px;
            min-width: 0;
          }

          .stock-mobile-summary-grid small {
            display: block;
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 900;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .stock-mobile-summary-grid b {
            display: block;
            color: var(--text);
            font-family: var(--mono);
            font-size: 16px;
            line-height: 1;
          }

          .stock-mobile-open-sheet { width: 100%; min-height: 40px; justify-content: center; }

          .stock-mobile-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 10px;
            position: sticky;
            top: 0;
            z-index: 5;
            background: var(--bg);
            padding: 2px 0 8px;
          }

          .stock-mobile-tabs button {
            border: 1px solid var(--border);
            border-radius: 999px;
            min-height: 34px;
            background: var(--surface2);
            color: var(--text2);
            font-size: 12px;
            font-weight: 900;
          }

          .stock-mobile-tabs button.is-active {
            border-color: var(--accent);
            color: var(--accent);
            background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          }

          .stock-form-card { display: none; }

          .stock-toolbar {
            display: ${mobileTab === "stock" ? "grid" : "none"};
            grid-template-columns: 1fr;
            gap: 8px;
            margin-bottom: 10px;
          }

          .stock-go-movements-btn { width: 100%; justify-content: center; }

          .stock-search { max-width: none !important; width: 100%; margin-bottom: 10px !important; }

          .stock-search input { width: 100%; height: 38px; min-height: 38px; font-size: 13px; }

          .stock-card { border-radius: 18px; overflow: hidden; }
          .stock-card-title { padding: 12px !important; font-size: 13px; }
          .stock-desktop-table { display: none; }
          .stock-desktop-pagination { display: none; }

          .stock-inventory-card { display: ${mobileTab === "stock" ? "block" : "none"}; }
          .stock-movements-card { display: ${mobileTab === "movements" ? "block" : "none"}; }

          .stock-mobile-list { display: grid; gap: 7px; padding: 8px; }

          .stock-mobile-item {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 9px;
            display: grid;
            gap: 8px;
            min-width: 0;
          }

          .stock-mobile-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; min-width: 0; }
          .stock-mobile-head > div { min-width: 0; display: grid; gap: 3px; }

          .stock-mobile-head h3 {
            font-size: 13px;
            line-height: 1.2;
            font-weight: 900;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-head span:not(.badge):not(.stock-movement-type) {
            color: var(--text3);
            font-size: 10.5px;
            font-family: var(--mono);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-mobile-head > .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 4px 6px;
            max-width: 112px;
            white-space: normal;
            text-align: center;
            line-height: 1.05;
          }

          .stock-mobile-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
          .stock-mobile-chip-row .badge { font-size: 9px; padding: 4px 6px; }

          .stock-mobile-data {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
          }

          .stock-mobile-data > div {
            display: grid;
            gap: 3px;
            border-radius: 11px;
            background: var(--bg);
            padding: 7px 8px;
            min-width: 0;
          }

          .stock-mobile-data small {
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 900;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .stock-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            line-height: 1.15;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-danger { color: var(--danger) !important; }

          .stock-movement-type {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 10px;
            font-weight: 900;
            color: var(--text2);
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 4px 7px;
            flex-shrink: 0;
          }

          .stock-movements-mobile-list { padding-top: 8px; }
          .stock-mobile-movement-data { grid-template-columns: repeat(2, minmax(0, 1fr)); }

          .stock-mobile-pagination {
            display: grid;
            gap: 8px;
            padding: 9px 10px 10px;
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .stock-mobile-pagination span { text-align: center; color: var(--text3); font-size: 11px; font-weight: 900; }

          .stock-mobile-pagination > div { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

          .stock-mobile-pagination button { width: 100%; justify-content: center; }

          .stock-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(0, 0, 0, 0.48);
          }

          .stock-mobile-sheet {
            width: 100%;
            height: auto;
            max-height: min(92dvh, 680px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 22px 22px 0 0;
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.35);
          }

          .stock-mobile-sheet-handle {
            width: 44px; height: 4px; border-radius: 999px;
            background: var(--border); margin: 10px auto 8px; flex-shrink: 0;
          }

          .stock-mobile-sheet-header {
            display: flex; align-items: flex-start; justify-content: space-between;
            gap: 12px; padding: 0 14px 12px;
            border-bottom: 1px solid var(--border); flex-shrink: 0;
          }

          .stock-mobile-sheet-header b { display: block; color: var(--text); font-size: 15px; line-height: 1.2; }
          .stock-mobile-sheet-header small { display: block; margin-top: 3px; color: var(--text3); font-size: 11px; line-height: 1.25; }

          .stock-mobile-sheet-body {
            flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
            padding: 12px 14px calc(14px + env(safe-area-inset-bottom));
            -webkit-overflow-scrolling: touch;
          }

          .stock-mobile-sheet-body .stock-form-grid {
            display: flex !important; flex-direction: column !important;
            grid-template-columns: none !important; gap: 10px !important;
            align-items: stretch !important; width: 100% !important; min-width: 0 !important;
          }

          .stock-mobile-sheet-body .stock-form-grid > div {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            border: 1px solid var(--border); border-radius: 14px; background: var(--surface2); padding: 10px;
          }

          .stock-mobile-sheet-body .stock-form-grid label {
            display: block; margin-bottom: 6px; font-size: 10px; letter-spacing: 0.08em; color: var(--text3);
          }

          .stock-mobile-sheet-body .stock-submit-btn {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            min-height: 46px; justify-content: center; grid-column: auto !important;
            border-radius: 14px; margin-top: 2px;
          }

          .stock-mobile-sheet-body .stock-product-search-row { grid-template-columns: 1fr !important; }
          .stock-mobile-sheet-body .stock-product-results { position: static !important; margin-top: 8px !important; max-height: 260px !important; }
          .stock-mobile-sheet-body .stock-product-picker { overflow: visible !important; }
          .stock-mobile-sheet-body .stock-scan-btn { width: 100% !important; justify-content: center !important; }

          .stock-mobile-sheet-body select,
          .stock-mobile-sheet-body input {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            min-height: 42px; font-size: 14px;
          }

          .stock-mobile-sheet-body select { overflow: hidden; text-overflow: ellipsis; }
        }

        @media (max-width: 420px) {
          .stock-mobile-summary-grid { gap: 6px; }
          .stock-mobile-summary-grid > div { padding: 7px; border-radius: 12px; }
          .stock-mobile-list { padding: 7px; }
          .stock-mobile-item { padding: 8px; border-radius: 13px; }
          .stock-mobile-head { align-items: flex-start; }
          .stock-mobile-head h3 { font-size: 12.5px; }
          .stock-mobile-data > div { padding: 6px 7px; }
          .stock-mobile-data strong { font-size: 11px; }
          .stock-mobile-sheet { max-height: 94dvh; }
        }
      `}</style>

      <style jsx global>{`
        @media (max-width: 768px) {
          body:has(.stock-mobile-sheet-backdrop) { overflow: hidden; }

          .stock-mobile-sheet-backdrop {
            position: fixed !important; inset: 0 !important; z-index: 2147483000 !important;
            display: flex !important; align-items: flex-end !important; justify-content: center !important;
            background: rgba(0, 0, 0, 0.55) !important; padding: 0 !important;
          }

          .stock-mobile-sheet {
            width: 100% !important; max-width: 100vw !important; height: auto !important;
            max-height: min(92dvh, 680px) !important; overflow: hidden !important;
            display: flex !important; flex-direction: column !important;
            border-radius: 22px 22px 0 0 !important; border: 1px solid var(--border) !important;
            background: var(--surface) !important; box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.45) !important;
          }

          .stock-mobile-sheet-handle {
            width: 44px !important; height: 4px !important; border-radius: 999px !important;
            background: var(--border) !important; margin: 10px auto 8px !important; flex-shrink: 0 !important;
          }

          .stock-mobile-sheet-header {
            display: flex !important; align-items: flex-start !important; justify-content: space-between !important;
            gap: 12px !important; padding: 0 14px 12px !important;
            border-bottom: 1px solid var(--border) !important; flex-shrink: 0 !important;
          }

          .stock-mobile-sheet-header b { display: block !important; color: var(--text) !important; font-size: 15px !important; line-height: 1.2 !important; }
          .stock-mobile-sheet-header small { display: block !important; margin-top: 3px !important; color: var(--text3) !important; font-size: 11px !important; line-height: 1.25 !important; }

          .stock-mobile-sheet-body {
            flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: hidden !important;
            padding: 12px 14px calc(14px + env(safe-area-inset-bottom)) !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .stock-mobile-sheet-body .stock-form-grid {
            display: flex !important; flex-direction: column !important; grid-template-columns: none !important;
            gap: 10px !important; align-items: stretch !important; width: 100% !important; min-width: 0 !important;
          }

          .stock-mobile-sheet-body .stock-form-grid > div {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            border: 1px solid var(--border) !important; border-radius: 14px !important;
            background: var(--surface2) !important; padding: 10px !important;
          }

          .stock-mobile-sheet-body .stock-form-grid label {
            display: block !important; margin-bottom: 6px !important; font-size: 10px !important;
            letter-spacing: 0.08em !important; color: var(--text3) !important;
          }

          .stock-mobile-sheet-body select,
          .stock-mobile-sheet-body input {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            min-height: 42px !important; font-size: 14px !important;
          }

          .stock-mobile-sheet-body select { overflow: hidden !important; text-overflow: ellipsis !important; }

          .stock-mobile-sheet-body .stock-submit-btn {
            width: 100% !important; min-width: 0 !important; max-width: 100% !important;
            min-height: 46px !important; justify-content: center !important; grid-column: auto !important;
            border-radius: 14px !important; margin-top: 2px !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}
