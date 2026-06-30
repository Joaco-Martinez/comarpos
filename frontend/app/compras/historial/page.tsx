/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type { Supplier } from "@/types";
import { fmtMoney, num } from "@/lib/helpers";
import { formatDateAR, formatDateTimeAR } from "@/lib/dateAR";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Check,
  Eye,
  FileText,
  Loader2,
  Package,
  Pencil,
  RefreshCcw,
  Search,
  Warehouse,
  X,
} from "lucide-react";

const PAGE_SIZE = 12;

type PurchaseItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  product?: {
    id?: string;
    name?: string | null;
    sku?: string | null;
    saleUnit?: string | null;
  } | null;
  quantity?: number | null;
  quantityKg?: number | null;
  unitCost?: number | null;
  price?: number | null;
  subtotal?: number | null;
  total?: number | null;
};

type PurchaseView = {
  id: string;
  supplierId?: string | null;
  supplier?: { id?: string; name?: string | null; cuit?: string | null } | null;
  providerName?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  documentNumber?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  to?: string | null;
  stockLocation?: string | null;
  location?: string | null;
  date?: string | null;
  purchaseDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  total?: number | null;
  amount?: number | null;
  items?: PurchaseItemView[];
  purchaseItems?: PurchaseItemView[];
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  userName?: string | null;
};

type PurchasesFetchResult = {
  items: PurchaseView[];
  serverPaginated: boolean;
  totalItems: number;
  totalPages: number;
  page: number;
};

function normalizeArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.purchases)) return data.purchases as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  if (Array.isArray(data?.results)) return data.results as T[];
  if (Array.isArray(data?.rows)) return data.rows as T[];
  return [];
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;

    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    (error as { message?: string })?.message ??
    fallback
  );
}

function safeNum(value: number | string | null | undefined, fallback?: number | string | null) {
  const parsedValue =
    value === null || value === undefined || value === "" ? undefined : Number(value);

  const parsedFallback =
    fallback === null || fallback === undefined || fallback === "" ? undefined : Number(fallback);

  return num(
    Number.isFinite(parsedValue) ? parsedValue : undefined,
    Number.isFinite(parsedFallback) ? parsedFallback : undefined
  );
}

function fmtDate(value?: string | null) {
  const result = formatDateAR(value);
  return result === "—" ? "Sin fecha" : result;
}

function fmtDateTime(value?: string | null) {
  const result = formatDateTimeAR(value);
  return result === "—" ? "Sin fecha" : result;
}

function getPurchaseDate(purchase: PurchaseView) {
  return purchase.date || purchase.purchaseDate || purchase.createdAt || null;
}

function getProviderName(purchase: PurchaseView) {
  return purchase.supplier?.name || purchase.providerName || purchase.supplierName || "Sin proveedor";
}

function getInvoiceNumber(purchase: PurchaseView) {
  return purchase.invoiceNumber || purchase.documentNumber || "—";
}

function getPurchaseItems(purchase: PurchaseView) {
  return purchase.items || purchase.purchaseItems || [];
}

function getItemName(item: PurchaseItemView) {
  return item.productNameSnapshot || item.product?.name || "Producto";
}

function getItemSku(item: PurchaseItemView) {
  return item.product?.sku || "SIN-SKU";
}

function getItemUnitCost(item: PurchaseItemView) {
  return safeNum(item.unitCost, item.price);
}

function getItemQty(item: PurchaseItemView) {
  const quantityKg = safeNum(item.quantityKg);

  if (quantityKg > 0) {
    return {
      label: `${quantityKg.toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      })} kg`,
      value: quantityKg,
    };
  }

  const quantity = safeNum(item.quantity, 1);
  return {
    label: String(quantity),
    value: quantity,
  };
}

function getItemSubtotal(item: PurchaseItemView) {
  const subtotal = safeNum(item.subtotal, item.total);

  if (subtotal > 0) return subtotal;

  return getItemUnitCost(item) * getItemQty(item).value;
}

function getPurchaseTotal(purchase: PurchaseView) {
  const directTotal = safeNum(purchase.total, purchase.amount);

  if (directTotal > 0) return directTotal;

  return getPurchaseItems(purchase).reduce((acc, item) => acc + getItemSubtotal(item), 0);
}

function getLocationLabel(purchase: PurchaseView) {
  const location = String(purchase.to || purchase.stockLocation || purchase.location || "").toUpperCase();

  if (location === "LOCAL") return "Mayorista";
  if (location === "DEPOSITO") return "Minorista";

  return "Sin dato";
}

function getLocationBadgeClass(purchase: PurchaseView) {
  const location = String(purchase.to || purchase.stockLocation || purchase.location || "").toUpperCase();

  if (location === "LOCAL") return "badge-green";
  if (location === "DEPOSITO") return "badge-yellow";

  return "badge-gray";
}

function getUserLabel(purchase: PurchaseView) {
  return purchase.user?.name || purchase.userName || purchase.user?.email || "Sin usuario";
}

function normalizePurchasesFetchResponse(data: any, fallbackPage: number): PurchasesFetchResult {
  const items = normalizeArray<PurchaseView>(data);
  const meta = data?.meta ?? data?.pagination ?? data;

  const totalItems = firstNumber(meta?.totalItems, meta?.total, meta?.count, items.length);
  const totalPages = Math.max(
    1,
    firstNumber(meta?.totalPages, meta?.pages, Math.ceil(totalItems / PAGE_SIZE)),
  );
  const page = Math.max(1, firstNumber(meta?.page, meta?.currentPage, fallbackPage));

  return {
    items,
    serverPaginated: Boolean(data?.meta || data?.pagination || meta?.total || meta?.totalItems || meta?.count),
    totalItems,
    totalPages,
    page,
  };
}

async function fetchPurchases(params?: {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}) {
  const response = await api.get("/purchases", { params });
  return normalizePurchasesFetchResponse(response.data, params?.page ?? 1);
}

export default function ComprasHistorialPage() {
  const [purchases, setPurchases] = useState<PurchaseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [serverPaginated, setServerPaginated] = useState(false);
  const [serverTotalItems, setServerTotalItems] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [detail, setDetail] = useState<PurchaseView | null>(null);
  const [providerEditing, setProviderEditing] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState("");
  const [providerSaving, setProviderSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    api
      .get("/suppliers")
      .then((res) => setSuppliers((res.data as any)?.content ?? res.data ?? []))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, fromDate, toDate]);

  const load = useCallback(
    async (showSuccess = false) => {
      setLoading(true);

      try {
        const result = await fetchPurchases({
          page: currentPage,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });

        setPurchases(result.items);
        setServerPaginated(result.serverPaginated);
        setServerTotalItems(result.totalItems);
        setServerTotalPages(result.totalPages);

        if (showSuccess) toast.success("Historial actualizado");
      } catch (error) {
        console.error(error);
        toast.error(getErrorMessage(error, "No se pudo cargar el historial de compras"));
      } finally {
        setLoading(false);
      }
    },
    [currentPage, debouncedSearch, fromDate, toDate],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (serverPaginated) return purchases;

    const q = debouncedSearch.toLowerCase();

    return purchases.filter((purchase) => {
      const purchaseDate = getPurchaseDate(purchase);
      const dateOnly = purchaseDate ? new Date(purchaseDate).toISOString().slice(0, 10) : "";

      const matchesSearch =
        !q ||
        purchase.id.toLowerCase().includes(q) ||
        getProviderName(purchase).toLowerCase().includes(q) ||
        getInvoiceNumber(purchase).toLowerCase().includes(q) ||
        getPurchaseItems(purchase).some((item) =>
          `${getItemName(item)} ${getItemSku(item)}`.toLowerCase().includes(q),
        );

      const matchesFrom = !fromDate || !dateOnly || dateOnly >= fromDate;
      const matchesTo = !toDate || !dateOnly || dateOnly <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [purchases, debouncedSearch, fromDate, toDate, serverPaginated]);

  const totalPages = serverPaginated
    ? serverTotalPages
    : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedPurchases = useMemo(() => {
    if (serverPaginated) return filtered;

    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage, serverPaginated]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totalFilteredItems = serverPaginated ? serverTotalItems : filtered.length;
  const pageStart = totalFilteredItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, totalFilteredItems);

  const summaryTotal = filtered.reduce((acc, purchase) => acc + getPurchaseTotal(purchase), 0);
  const summaryProducts = filtered.reduce(
    (acc, purchase) => acc + getPurchaseItems(purchase).length,
    0,
  );

  const openPurchaseDetail = (purchase: PurchaseView) => {
    setDetail(purchase);
    setSupplierDraft(purchase.supplierId ?? purchase.supplier?.id ?? "");
    setProviderEditing(false);
  };

  const updateProvider = async () => {
    if (!detail) return;

    setProviderSaving(true);
    const toastId = toast.loading("Actualizando proveedor...");

    try {
      const response = await api.patch(`/purchases/${detail.id}/supplier`, {
        supplierId: supplierDraft || null,
      });

      const updatedPurchase: PurchaseView = {
        ...detail,
        ...response.data,
        supplierId: response.data?.supplierId ?? (supplierDraft || null),
        supplier:
          response.data?.supplier ??
          suppliers.find((s) => s.id === supplierDraft) ??
          null,
      };

      setPurchases((prev) =>
        prev.map((purchase) =>
          purchase.id === updatedPurchase.id ? { ...purchase, ...updatedPurchase } : purchase,
        ),
      );
      setDetail(updatedPurchase);
      setProviderEditing(false);
      toast.success("Proveedor actualizado", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "No se pudo actualizar el proveedor"), { id: toastId });
    } finally {
      setProviderSaving(false);
    }
  };

  return (
    <AppLayout
      title="Historial de compras"
      subtitle="Compras registradas, proveedores, comprobantes e ingreso de stock"
      actions={
        <Link href="/compras" className="btn btn-secondary btn-sm">
          <ArrowLeft size={15} />
          Volver a compras
        </Link>
      }
    >
      <div className="purchase-history-stats">
        <div className="stat-card">
          <div className="stat-value">{totalFilteredItems}</div>
          <div className="stat-label">Compras</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--accent)" }}>
            {fmtMoney(summaryTotal)}
          </div>
          <div className="stat-label">Total comprado</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{summaryProducts}</div>
          <div className="stat-label">Líneas de productos</div>
        </div>
      </div>

      <div className="purchase-history-filters">
        <div className="purchase-history-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por proveedor, comprobante, producto o ID..."
          />
        </div>

        <label>
          <span>Desde</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>

        <label>
          <span>Hasta</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>

        <button className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Actualizar
        </button>
      </div>

      <div className="card purchase-history-card">
        <div className="purchase-history-desktop">
          {loading ? (
            <div style={{ padding: 18 }}>
              <div className="skeleton" style={{ height: 260 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Comprobante</th>
                  <th>Ingreso</th>
                  <th>Pago</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Usuario</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {paginatedPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => openPurchaseDetail(purchase)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>
                      #{purchase.id.slice(-8)}
                    </td>
                    <td>{fmtDate(getPurchaseDate(purchase))}</td>
                    <td>{getProviderName(purchase)}</td>
                    <td>{getInvoiceNumber(purchase)}</td>
                    <td>
                      <span className={`badge ${getLocationBadgeClass(purchase)}`}>
                        {getLocationLabel(purchase)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{purchase.paymentMethod || "—"}</span>
                    </td>
                    <td>{getPurchaseItems(purchase).length}</td>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 900, color: "var(--accent)" }}>
                      {fmtMoney(getPurchaseTotal(purchase))}
                    </td>
                    <td>{getUserLabel(purchase)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openPurchaseDetail(purchase)}>
                        <Eye size={14} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin compras registradas</p>
            </div>
          )}
        </div>

        <div className="purchase-history-mobile">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 240 }} />
            </div>
          ) : (
            paginatedPurchases.map((purchase) => (
              <article
                key={`${purchase.id}-mobile`}
                className="purchase-history-item"
                onClick={() => openPurchaseDetail(purchase)}
              >
                <div className="purchase-history-item-head">
                  <div>
                    <span>#{purchase.id.slice(-8)}</span>
                    <b>{getProviderName(purchase)}</b>
                    <small>{fmtDateTime(getPurchaseDate(purchase))}</small>
                  </div>
                  <strong>{fmtMoney(getPurchaseTotal(purchase))}</strong>
                </div>

                <div className="purchase-history-badges">
                  <span className={`badge ${getLocationBadgeClass(purchase)}`}>
                    <Warehouse size={12} />
                    {getLocationLabel(purchase)}
                  </span>
                  <span className="badge badge-gray">{purchase.paymentMethod || "Sin pago"}</span>
                  <span className="badge badge-gray">
                    <Package size={12} />
                    {getPurchaseItems(purchase).length} productos
                  </span>
                </div>

                <div className="purchase-history-item-data">
                  <div>
                    <small>Comprobante</small>
                    <b>{getInvoiceNumber(purchase)}</b>
                  </div>
                  <div>
                    <small>Usuario</small>
                    <b>{getUserLabel(purchase)}</b>
                  </div>
                </div>
              </article>
            ))
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin compras registradas</p>
            </div>
          )}
        </div>

        {!loading && totalFilteredItems > 0 && (
          <div className="purchase-history-pagination">
            <div>
              Mostrando {pageStart} - {pageEnd} de {totalFilteredItems} compras
            </div>

            <div>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span>
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {mounted && detail &&
        createPortal(
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
            <div className="modal purchase-detail-modal">
              <div className="modal-header">
                <div>
                  <b>Compra #{detail.id.slice(-8)}</b>
                  <small>{fmtDateTime(getPurchaseDate(detail))}</small>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div className="purchase-detail-grid">
                  <div className="purchase-provider-edit-card">
                    <small>Proveedor</small>
                    {providerEditing ? (
                      <div className="purchase-provider-editor">
                        <select
                          value={supplierDraft}
                          onChange={(e) => setSupplierDraft(e.target.value)}
                          autoFocus
                          disabled={providerSaving}
                          onKeyDown={(e) => {
                            if (e.key === "Escape" && !providerSaving) {
                              setSupplierDraft(detail.supplierId ?? detail.supplier?.id ?? "");
                              setProviderEditing(false);
                            }
                          }}
                        >
                          <option value="">Sin proveedor</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <div className="purchase-provider-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={providerSaving}
                            onClick={() => {
                              setSupplierDraft(detail.supplierId ?? detail.supplier?.id ?? "");
                              setProviderEditing(false);
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={providerSaving}
                            onClick={() => void updateProvider()}
                          >
                            {providerSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="purchase-provider-view">
                        <b>{getProviderName(detail)}</b>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSupplierDraft(detail.supplierId ?? detail.supplier?.id ?? "");
                            setProviderEditing(true);
                          }}
                        >
                          <Pencil size={13} />
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <small>Comprobante</small>
                    <b>{getInvoiceNumber(detail)}</b>
                  </div>

                  <div>
                    <small>Ingreso de stock</small>
                    <b>
                      <span className={`badge ${getLocationBadgeClass(detail)}`}>
                        {getLocationLabel(detail)}
                      </span>
                    </b>
                  </div>

                  <div>
                    <small>Método de pago</small>
                    <b>{detail.paymentMethod || "—"}</b>
                  </div>

                  <div>
                    <small>Usuario</small>
                    <b>{getUserLabel(detail)}</b>
                  </div>

                  <div>
                    <small>Total</small>
                    <b className="purchase-detail-total">{fmtMoney(getPurchaseTotal(detail))}</b>
                  </div>
                </div>

                {detail.description && (
                  <div className="purchase-detail-note">
                    <small>Observación</small>
                    <p>{detail.description}</p>
                  </div>
                )}

                <div className="purchase-detail-products">
                  <div className="purchase-detail-products-head">
                    <b>Productos</b>
                    <span>{getPurchaseItems(detail).length} líneas</span>
                  </div>

                  <div className="purchase-detail-products-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th>Cantidad</th>
                          <th>Costo</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>

                      <tbody>
                        {getPurchaseItems(detail).map((item, index) => (
                          <tr key={item.id || `${getItemName(item)}-${index}`}>
                            <td>{getItemName(item)}</td>
                            <td>{getItemSku(item)}</td>
                            <td>{getItemQty(item).label}</td>
                            <td>{fmtMoney(getItemUnitCost(item))}</td>
                            <td>{fmtMoney(getItemSubtotal(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!getPurchaseItems(detail).length && (
                      <div className="empty-state compact">
                        <Package size={30} />
                        <p>Esta compra no trajo detalle de productos</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        .purchase-history-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .purchase-history-filters {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 160px 160px auto;
          gap: 10px;
          align-items: end;
          margin-bottom: 16px;
        }

        .purchase-history-search {
          position: relative;
        }

        .purchase-history-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text3);
        }

        .purchase-history-search input {
          width: 100%;
          padding-left: 34px;
        }

        .purchase-history-filters label {
          display: grid;
          gap: 5px;
        }

        .purchase-history-filters label span {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .purchase-history-card {
          overflow: hidden;
        }

        .purchase-history-desktop {
          overflow-x: auto;
        }

        .purchase-history-desktop table {
          min-width: 1080px;
        }

        .purchase-history-mobile {
          display: none;
        }

        .purchase-history-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .purchase-history-pagination > div:last-child {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .purchase-detail-modal {
          width: min(880px, calc(100vw - 32px));
        }

        .modal-header > div {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .modal-header small {
          color: var(--text3);
          font-size: 12px;
        }

        .purchase-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .purchase-detail-grid > div,
        .purchase-detail-note {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
          padding: 12px;
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .purchase-detail-grid small,
        .purchase-detail-note small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .purchase-detail-grid b {
          overflow-wrap: anywhere;
        }

        .purchase-detail-total {
          color: var(--accent);
          font-family: var(--mono);
          font-size: 18px;
        }

        .purchase-provider-edit-card {
          align-content: start;
        }

        .purchase-provider-view {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .purchase-provider-view b {
          min-width: 0;
        }

        .purchase-provider-view button,
        .purchase-provider-actions button {
          white-space: nowrap;
        }

        .purchase-provider-editor {
          display: grid;
          gap: 8px;
        }

        .purchase-provider-editor input {
          width: 100%;
          min-width: 0;
        }

        .purchase-provider-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .purchase-detail-note {
          margin-bottom: 16px;
        }

        .purchase-detail-note p {
          margin: 0;
          color: var(--text2);
          line-height: 1.45;
          font-size: 13px;
        }

        .purchase-detail-products {
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          background: var(--surface);
        }

        .purchase-detail-products-head {
          padding: 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid var(--border);
        }

        .purchase-detail-products-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .purchase-detail-products-table {
          overflow-x: auto;
        }

        .purchase-detail-products-table table {
          min-width: 680px;
        }

        .empty-state.compact {
          min-height: 160px;
        }

        @media (max-width: 900px) {
          .purchase-history-stats {
            grid-template-columns: 1fr;
          }

          .purchase-history-filters {
            grid-template-columns: 1fr 1fr;
          }

          .purchase-history-search {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 768px) {
          .purchase-history-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 10px;
          }

          .purchase-history-filters {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 10px;
          }

          .purchase-history-filters button {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .purchase-history-desktop {
            display: none;
          }

          .purchase-history-mobile {
            display: grid;
            gap: 9px;
            padding: 10px;
          }

          .purchase-history-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface2);
            padding: 11px;
            display: grid;
            gap: 10px;
            cursor: pointer;
          }

          .purchase-history-item-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            align-items: flex-start;
          }

          .purchase-history-item-head > div {
            min-width: 0;
            display: grid;
            gap: 3px;
          }

          .purchase-history-item-head span {
            color: var(--text3);
            font-family: var(--mono);
            font-size: 10px;
            font-weight: 800;
          }

          .purchase-history-item-head b {
            font-size: 14px;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }

          .purchase-history-item-head small {
            color: var(--text3);
            font-size: 11px;
          }

          .purchase-history-item-head strong {
            color: var(--accent);
            font-family: var(--mono);
            font-size: 12px;
            white-space: nowrap;
          }

          .purchase-history-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .purchase-history-badges .badge {
            display: inline-flex;
            gap: 4px;
            align-items: center;
          }

          .purchase-history-item-data {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .purchase-history-item-data > div {
            border-radius: 12px;
            background: var(--bg);
            padding: 8px;
            display: grid;
            gap: 3px;
            min-width: 0;
          }

          .purchase-history-item-data small {
            color: var(--text3);
            font-size: 10px;
            font-weight: 900;
          }

          .purchase-history-item-data b {
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .purchase-history-pagination {
            display: grid;
            grid-template-columns: 1fr;
            text-align: center;
          }

          .purchase-history-pagination > div:last-child {
            display: grid;
            grid-template-columns: 1fr;
          }

          .purchase-history-pagination button {
            width: 100%;
            justify-content: center;
          }

          .modal-overlay {
            align-items: flex-start;
            padding: 12px;
          }

          .purchase-detail-modal {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
            max-height: calc(100dvh - 24px);
            border-radius: 18px;
          }

          .purchase-detail-grid {
            grid-template-columns: 1fr;
          }

          .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 420px) {
          .purchase-history-stats,
          .purchase-history-filters,
          .purchase-history-item-data {
            grid-template-columns: 1fr;
          }

          .purchase-history-search {
            grid-column: auto;
          }

          .purchase-history-item-head {
            display: grid;
          }

          .purchase-history-item-head strong {
            white-space: normal;
          }
        }
      `}</style>
    </AppLayout>
  );
}
