/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { clientName, fmtDate, fmtMoney, num } from '@/lib/helpers';
import { todayInputAR, startOfDayAR, endOfDayAR } from '@/lib/dateAR';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  UserRound,
  Warehouse,
} from 'lucide-react';

type DetailTab = 'resumen' | 'ventas' | 'compras' | 'stock' | 'cuenta' | 'remitos';

type UserView = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  client?: unknown;
};

type ProductLike = {
  id?: string | null;
  name?: string | null;
  sku?: string | null;
  saleUnit?: string | null;
  category?: { name?: string | null } | null;
};

type SaleItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  productSkuSnapshot?: string | null;
  product?: ProductLike | null;
  quantity?: number | string | null;
  quantityKg?: number | string | null;
  price?: number | string | null;
  subtotal?: number | string | null;
  priceType?: string | null;
  purchasePriceSnapshot?: number | string | null;
  profit?: number | string | null;
  boxContents?: {
    id?: string;
    productId?: string | null;
    quantity?: number | string | null;
    quantityKg?: number | string | null;
    product?: ProductLike | null;
  }[];
};

type PaymentView = {
  method?: string | null;
  amount?: number | string | null;
  reference?: string | null;
  notes?: string | null;
};

type SaleView = {
  id: string;
  userId?: string | null;
  client?: unknown;
  subtotal?: number | string | null;
  total?: number | string | null;
  discountType?: string | null;
  discountValue?: number | string | null;
  status?: string | null;
  invoiceStatus?: string | null;
  isInvoiced?: boolean | null;
  paymentMethod?: string | null;
  receiptType?: string | null;
  stockLocation?: string | null;
  accountDebtAmount?: number | string | null;
  grossProfit?: number | string | null;
  deliveryMethod?: string | null;
  deliveryStatus?: string | null;
  deliveryCost?: number | string | null;
  deliveryDistanceKm?: number | string | null;
  transportName?: string | null;
  packagesCount?: number | string | null;
  declaredValue?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: SaleItemView[];
  payments?: PaymentView[];
  invoice?: { id?: string; pdfUrl?: string | null; createdAt?: string | null } | null;
  invoiceAfip?: any;
  remitos?: any[];
  accountMovements?: any[];
};

type PurchaseItemView = {
  id?: string;
  productId?: string | null;
  productNameSnapshot?: string | null;
  productSkuSnapshot?: string | null;
  product?: ProductLike | null;
  quantity?: number | string | null;
  quantityKg?: number | string | null;
  costPrice?: number | string | null;
  purchasePrice?: number | string | null;
  price?: number | string | null;
  subtotal?: number | string | null;
};

type PurchaseView = {
  id: string;
  supplier?: string | null;
  provider?: string | null;
  providerName?: string | null;
  supplierName?: string | null;
  status?: string | null;
  stockLocation?: string | null;
  location?: string | null;
  subtotal?: number | string | null;
  total?: number | string | null;
  amount?: number | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: PurchaseItemView[];
  purchaseItems?: PurchaseItemView[];
};

type StockMovementView = {
  id: string;
  productId?: string | null;
  product?: ProductLike | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  quantity?: number | string | null;
  quantityKg?: number | string | null;
  reason?: string | null;
  reference?: string | null;
  createdAt?: string | null;
};

type ProductSummary = {
  key?: string;
  productId?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: string | null;
  quantity?: number | string | null;
  quantityKg?: number | string | null;
  subtotal?: number | string | null;
  operations?: number | string | null;
};

type ActivityResponse = {
  user: UserView;
  filters?: {
    fromDate?: string | null;
    toDate?: string | null;
  };
  summary?: {
    salesCount?: number;
    validSalesCount?: number;
    completedSalesCount?: number;
    pendingSalesCount?: number;
    cancelledSalesCount?: number;
    purchasesCount?: number;
    stockMovementsCount?: number;
    remitosCount?: number;
    accountMovementsCount?: number;
    arcaAuditLogsCount?: number;
    totalSold?: number;
    totalPurchased?: number;
    totalDebtGenerated?: number;
    totalAccountPayments?: number;
    averageTicket?: number;
    paymentBreakdown?: Record<string, number>;
    stockBreakdown?: Record<string, number>;
  };
  productsSold?: ProductSummary[];
  productsPurchased?: ProductSummary[];
  sales?: SaleView[];
  purchases?: PurchaseView[];
  stockMovements?: StockMovementView[];
  accountMovements?: any[];
  remitos?: any[];
  arcaAuditLogs?: any[];
};

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

function toInputDate() {
  return todayInputAR();
}

function getDayRange(dateValue: string) {
  const safeDate = dateValue || todayInputAR();
  return {
    from: startOfDayAR(safeDate),
    to: endOfDayAR(safeDate),
  };
}

function getClientLabel(client: unknown) {
  return clientName(client as Parameters<typeof clientName>[0]);
}

function money(value?: number | string | null) {
  return fmtMoney(num(value));
}

function getUserName(user?: UserView | null) {
  return user?.name || user?.email || 'Vendedor';
}

function getStockLocationLabel(value?: string | null) {
  const location = String(value ?? '').toUpperCase();
  if (location === 'LOCAL') return 'Mayorista';
  if (location === 'DEPOSITO') return 'Minorista';
  return value || 'Sin dato';
}

function getStatusBadgeClass(status?: string | null) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'COMPLETED' || value === 'CONFIRMED' || value === 'ISSUED') return 'badge-green';
  if (value === 'PENDING' || value === 'PENDING_AFIP') return 'badge-yellow';
  if (value === 'CANCELLED' || value === 'CANCELED' || value === 'ERROR') return 'badge-red';
  return 'badge-gray';
}

function getMovementTypeLabel(type?: string | null) {
  const value = String(type ?? '').toUpperCase();
  if (value === 'SALE') return 'Venta';
  if (value === 'SALE_CANCEL') return 'Cancelación venta';
  if (value === 'TRANSFER') return 'Transferencia';
  if (value === 'INGRESS') return 'Ingreso';
  if (value === 'ADJUSTMENT') return 'Ajuste';
  return value || 'Movimiento';
}

function getMovementBadgeClass(type?: string | null) {
  const value = String(type ?? '').toUpperCase();
  if (value === 'SALE' || value === 'INGRESS') return 'badge-green';
  if (value === 'SALE_CANCEL') return 'badge-red';
  if (value === 'TRANSFER') return 'badge-yellow';
  return 'badge-gray';
}

function getItemName(item: SaleItemView | PurchaseItemView) {
  return item.productNameSnapshot || item.product?.name || 'Producto';
}

function getItemSku(item: SaleItemView | PurchaseItemView) {
  return item.productSkuSnapshot || item.product?.sku || null;
}

function getItemQtyLabel(item: { quantity?: number | string | null; quantityKg?: number | string | null }) {
  if (num(item.quantityKg) > 0) return `${num(item.quantityKg).toLocaleString('es-AR')} kg`;
  return `${num(item.quantity).toLocaleString('es-AR')} u.`;
}

function getMovementQtyLabel(item: StockMovementView) {
  if (num(item.quantityKg) > 0) return `${num(item.quantityKg).toLocaleString('es-AR')} kg`;
  return `${num(item.quantity).toLocaleString('es-AR')} u.`;
}

function getSaleTotal(sale: SaleView) {
  const directTotal = num(sale.total);
  if (directTotal > 0) return directTotal;

  return (sale.items ?? []).reduce((acc, item) => {
    const qty = num(item.quantityKg) || num(item.quantity) || 1;
    return acc + (num(item.subtotal) || num(item.price) * qty);
  }, 0);
}

function getPurchaseItems(purchase: PurchaseView) {
  return purchase.items ?? purchase.purchaseItems ?? [];
}

function getPurchaseTotal(purchase: PurchaseView) {
  const directTotal = num(purchase.total || purchase.amount || purchase.subtotal);
  if (directTotal > 0) return directTotal;

  return getPurchaseItems(purchase).reduce((acc, item) => {
    const qty = num(item.quantityKg) || num(item.quantity) || 1;
    const cost = num(item.costPrice || item.purchasePrice || item.price);
    return acc + (num(item.subtotal) || cost * qty);
  }, 0);
}

function getSupplierLabel(purchase: PurchaseView) {
  return purchase.supplierName || purchase.providerName || purchase.supplier || purchase.provider || 'Sin proveedor';
}

function matchesSearch(values: unknown[], search: string) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => String(value ?? '').toLowerCase().includes(q));
}

export default function VendedorDetallePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = String(params?.id ?? '');
  const initialDate = searchParams.get('date') || toInputDate();

  const [date, setDate] = useState(initialDate);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async (showSuccess = false) => {
    if (!userId) return;

    setLoading(true);

    try {
      const { from, to } = getDayRange(date);
      const response = await api.get(`/users/${userId}/activity`, {
        params: {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
        },
      });

      setActivity(response.data);
      if (showSuccess) toast.success('Detalle actualizado');
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, 'No se pudo cargar el detalle del vendedor'));
    } finally {
      setLoading(false);
    }
  }, [date, userId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const summary = activity?.summary ?? {};
  const sales = activity?.sales ?? [];
  const purchases = activity?.purchases ?? [];
  const stockMovements = activity?.stockMovements ?? [];
  const accountMovements = activity?.accountMovements ?? [];
  const remitos = activity?.remitos ?? [];
  const productsSold = activity?.productsSold ?? [];
  const productsPurchased = activity?.productsPurchased ?? [];

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) =>
        matchesSearch(
          [sale.id, getClientLabel(sale.client), sale.status, sale.paymentMethod, sale.receiptType],
          search
        )
      ),
    [sales, search]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((purchase) =>
        matchesSearch([purchase.id, getSupplierLabel(purchase), purchase.status], search)
      ),
    [purchases, search]
  );

  const filteredMovements = useMemo(
    () =>
      stockMovements.filter((movement) =>
        matchesSearch(
          [movement.id, movement.product?.name, movement.product?.sku, movement.type, movement.reason, movement.reference],
          search
        )
      ),
    [stockMovements, search]
  );

  const totalActivityCount =
    (summary.salesCount ?? 0) +
    (summary.purchasesCount ?? 0) +
    (summary.stockMovementsCount ?? 0) +
    (summary.accountMovementsCount ?? 0) +
    (summary.remitosCount ?? 0);

  return (
    <AppLayout
      title={activity ? getUserName(activity.user) : 'Detalle vendedor'}
      subtitle={activity?.user?.email || 'Actividad completa del usuario'}
      actions={
        <div className="detail-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/vendedores')}>
            <ArrowLeft size={14} />
            Volver
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => loadActivity(true)} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Actualizar
          </button>
        </div>
      }
    >
      <div className="detail-toolbar">
        <div className="detail-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar dentro del detalle por producto, cliente, proveedor, estado, ID..."
          />
        </div>

        <label className="detail-date-filter">
          <CalendarDays size={14} />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 18 }}>
          <div className="skeleton" style={{ height: 420 }} />
        </div>
      ) : !activity ? (
        <div className="card detail-empty">
          <UserRound size={42} />
          <b>No encontré este usuario</b>
          <p>Revisá que el ID exista o que tengas permiso ADMIN.</p>
        </div>
      ) : (
        <>
          <section className="seller-profile-card card">
            <div className="seller-profile-avatar">
              <UserRound size={26} />
            </div>
            <div>
              <h2>{getUserName(activity.user)}</h2>
              <p>{activity.user.email || 'Sin email'}</p>
              <div className="seller-profile-badges">
                <span className="badge badge-gray">{activity.user.role || 'SIN ROL'}</span>
                <span className={`badge ${activity.user.isActive === false ? 'badge-red' : 'badge-green'}`}>
                  {activity.user.isActive === false ? 'Inactivo' : 'Activo'}
                </span>
                <span className="badge badge-gray">ID: {activity.user.id}</span>
              </div>
            </div>
          </section>

          <section className="detail-stats-grid">
            <div className="stat-card detail-stat-card">
              <span><DollarSign size={18} /></span>
              <div>
                <div className="stat-value detail-money">{money(summary.totalSold)}</div>
                <div className="stat-label">Total vendido</div>
              </div>
            </div>

            <div className="stat-card detail-stat-card">
              <span><ShoppingCart size={18} /></span>
              <div>
                <div className="stat-value">{summary.salesCount ?? 0}</div>
                <div className="stat-label">Ventas</div>
              </div>
            </div>

            <div className="stat-card detail-stat-card">
              <span><ShoppingBag size={18} /></span>
              <div>
                <div className="stat-value">{summary.purchasesCount ?? 0}</div>
                <div className="stat-label">Compras</div>
              </div>
            </div>

            <div className="stat-card detail-stat-card">
              <span><ArrowRightLeft size={18} /></span>
              <div>
                <div className="stat-value">{summary.stockMovementsCount ?? 0}</div>
                <div className="stat-label">Movimientos stock</div>
              </div>
            </div>

            <div className="stat-card detail-stat-card">
              <span><ReceiptText size={18} /></span>
              <div>
                <div className="stat-value">{totalActivityCount}</div>
                <div className="stat-label">Acciones totales</div>
              </div>
            </div>
          </section>

          <div className="detail-tabs card">
            {([
              ['resumen', 'Resumen'],
              ['ventas', `Ventas (${summary.salesCount ?? 0})`],
              ['compras', `Compras (${summary.purchasesCount ?? 0})`],
              ['stock', `Stock (${summary.stockMovementsCount ?? 0})`],
              ['cuenta', `Cuenta (${summary.accountMovementsCount ?? 0})`],
              ['remitos', `Remitos (${summary.remitosCount ?? 0})`],
            ] as [DetailTab, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={tab === value ? 'active' : ''}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'resumen' && (
            <div className="detail-grid-two">
              <section className="detail-section card">
                <div className="detail-section-head">
                  <b>Resumen fino</b>
                  <span>Backend calculado</span>
                </div>

                <div className="info-grid">
                  <div><small>Ventas válidas</small><b>{summary.validSalesCount ?? 0}</b></div>
                  <div><small>Completadas</small><b>{summary.completedSalesCount ?? 0}</b></div>
                  <div><small>Pendientes</small><b>{summary.pendingSalesCount ?? 0}</b></div>
                  <div><small>Canceladas</small><b>{summary.cancelledSalesCount ?? 0}</b></div>
                  <div><small>Ticket promedio</small><b>{money(summary.averageTicket)}</b></div>
                  <div><small>Deuda generada</small><b>{money(summary.totalDebtGenerated)}</b></div>
                  <div><small>Abonos cargados</small><b>{money(summary.totalAccountPayments)}</b></div>
                  <div><small>Total compras</small><b>{money(summary.totalPurchased)}</b></div>
                </div>
              </section>

              <section className="detail-section card">
                <div className="detail-section-head">
                  <b>Medios de pago</b>
                  <span>{Object.keys(summary.paymentBreakdown ?? {}).length}</span>
                </div>

                <div className="simple-list">
                  {Object.entries(summary.paymentBreakdown ?? {}).length ? Object.entries(summary.paymentBreakdown ?? {}).map(([method, amount]) => (
                    <div key={method} className="simple-row">
                      <span>{method}</span>
                      <b>{money(amount)}</b>
                    </div>
                  )) : <div className="muted-box">Sin pagos para esta fecha.</div>}
                </div>
              </section>

              <section className="detail-section card">
                <div className="detail-section-head">
                  <b>Productos vendidos</b>
                  <span>{productsSold.length}</span>
                </div>

                <div className="simple-list">
                  {productsSold.length ? productsSold.map((product) => (
                    <div key={product.key || product.productId || product.name} className="product-summary-row">
                      <span><Package size={15} /></span>
                      <div>
                        <b>{product.name || 'Producto'}</b>
                        <small>{product.sku || 'SIN-SKU'} · {num(product.quantityKg) > 0 ? `${num(product.quantityKg)} kg` : `${num(product.quantity)} u.`} · {product.operations ?? 0} mov.</small>
                      </div>
                      <strong>{money(product.subtotal)}</strong>
                    </div>
                  )) : <div className="muted-box">Sin productos vendidos.</div>}
                </div>
              </section>

              <section className="detail-section card">
                <div className="detail-section-head">
                  <b>Productos comprados</b>
                  <span>{productsPurchased.length}</span>
                </div>

                <div className="simple-list">
                  {productsPurchased.length ? productsPurchased.map((product) => (
                    <div key={product.key || product.productId || product.name} className="product-summary-row">
                      <span><ShoppingBag size={15} /></span>
                      <div>
                        <b>{product.name || 'Producto'}</b>
                        <small>{product.sku || 'SIN-SKU'} · {num(product.quantityKg) > 0 ? `${num(product.quantityKg)} kg` : `${num(product.quantity)} u.`} · {product.operations ?? 0} mov.</small>
                      </div>
                      <strong>{money(product.subtotal)}</strong>
                    </div>
                  )) : <div className="muted-box">Sin productos comprados.</div>}
                </div>
              </section>
            </div>
          )}

          {tab === 'ventas' && (
            <section className="detail-section card">
              <div className="detail-section-head">
                <b>Ventas con lujo de detalle</b>
                <span>{filteredSales.length}</span>
              </div>

              <div className="document-list">
                {filteredSales.length ? filteredSales.map((sale) => (
                  <article key={sale.id} className="document-card">
                    <div className="document-head">
                      <div>
                        <h3>Venta #{sale.id.slice(-8)}</h3>
                        <p>ID completo: {sale.id}</p>
                        <p>{fmtDate(String(sale.createdAt))} · Cliente: {getClientLabel(sale.client)}</p>
                      </div>

                      <div className="document-badges">
                        <span className={`badge ${getStatusBadgeClass(sale.status)}`}>{sale.status || 'SIN ESTADO'}</span>
                        <span className={`badge ${getStatusBadgeClass(sale.invoiceStatus)}`}>{sale.invoiceStatus || 'Sin factura'}</span>
                        <span className="badge badge-gray">{getStockLocationLabel(sale.stockLocation)}</span>
                      </div>
                    </div>

                    <div className="info-grid compact">
                      <div><small>Subtotal</small><b>{money(sale.subtotal)}</b></div>
                      <div><small>Total</small><b>{money(getSaleTotal(sale))}</b></div>
                      <div><small>Ganancia</small><b>{money(sale.grossProfit)}</b></div>
                      <div><small>Deuda</small><b>{money(sale.accountDebtAmount)}</b></div>
                      <div><small>Pago principal</small><b>{sale.paymentMethod || 'Sin método'}</b></div>
                      <div><small>Comprobante</small><b>{sale.receiptType || 'Sin dato'}</b></div>
                      <div><small>Descuento</small><b>{sale.discountType ? `${sale.discountType} ${sale.discountValue ?? ''}` : 'Sin descuento'}</b></div>
                      <div><small>Delivery</small><b>{sale.deliveryMethod || 'Sin dato'} · {money(sale.deliveryCost)}</b></div>
                      <div><small>Km envío</small><b>{sale.deliveryDistanceKm ?? 'Sin dato'}</b></div>
                      <div><small>Bultos</small><b>{sale.packagesCount ?? 'Sin dato'}</b></div>
                      <div><small>Transporte</small><b>{sale.transportName || 'Sin dato'}</b></div>
                      <div><small>Actualizada</small><b>{sale.updatedAt ? fmtDate(String(sale.updatedAt)) : 'Sin dato'}</b></div>
                    </div>

                    <div className="subsection-title"><ReceiptText size={14} /> Items</div>
                    <div className="line-list">
                      {sale.items?.length ? sale.items.map((item, index) => {
                        const qty = num(item.quantityKg) || num(item.quantity) || 1;
                        const total = num(item.subtotal) || num(item.price) * qty;

                        return (
                          <div key={item.id || `${sale.id}-item-${index}`} className="detail-line">
                            <div>
                              <b>{getItemName(item)}</b>
                              <small>{getItemSku(item) || 'SIN-SKU'} · {item.product?.category?.name || 'Sin categoría'}</small>
                              {item.boxContents?.length ? (
                                <small>Componentes: {item.boxContents.map((box) => `${box.product?.name || 'Producto'} (${getItemQtyLabel(box)})`).join(' · ')}</small>
                              ) : null}
                            </div>
                            <small>{getItemQtyLabel(item)} · {item.priceType || 'PRICE'} · costo {money(item.purchasePriceSnapshot)}</small>
                            <strong>{money(total)}</strong>
                          </div>
                        );
                      }) : <div className="muted-box">Sin items.</div>}
                    </div>

                    <div className="subsection-title"><CreditCard size={14} /> Pagos</div>
                    <div className="line-list">
                      {sale.payments?.length ? sale.payments.map((payment, index) => (
                        <div key={`${sale.id}-payment-${index}`} className="detail-line">
                          <div>
                            <b>{payment.method || 'Pago'}</b>
                            <small>{payment.reference || payment.notes || 'Sin referencia'}</small>
                          </div>
                          <small>Pago parcial</small>
                          <strong>{money(payment.amount)}</strong>
                        </div>
                      )) : (
                        <div className="detail-line">
                          <div><b>{sale.paymentMethod || 'Sin método'}</b><small>Método principal</small></div>
                          <small>Total venta</small>
                          <strong>{money(getSaleTotal(sale))}</strong>
                        </div>
                      )}
                    </div>
                  </article>
                )) : <div className="muted-box">No hay ventas para mostrar.</div>}
              </div>
            </section>
          )}

          {tab === 'compras' && (
            <section className="detail-section card">
              <div className="detail-section-head">
                <b>Compras cargadas</b>
                <span>{filteredPurchases.length}</span>
              </div>

              <div className="document-list">
                {filteredPurchases.length ? filteredPurchases.map((purchase) => (
                  <article key={purchase.id} className="document-card">
                    <div className="document-head">
                      <div>
                        <h3>Compra #{purchase.id.slice(-8)}</h3>
                        <p>ID completo: {purchase.id}</p>
                        <p>{fmtDate(String(purchase.createdAt))} · Proveedor: {getSupplierLabel(purchase)}</p>
                      </div>

                      <div className="document-badges">
                        <span className={`badge ${getStatusBadgeClass(purchase.status)}`}>{purchase.status || 'SIN ESTADO'}</span>
                        <span className="badge badge-gray">{getStockLocationLabel(purchase.stockLocation || purchase.location)}</span>
                      </div>
                    </div>

                    <div className="info-grid compact">
                      <div><small>Subtotal</small><b>{money(purchase.subtotal)}</b></div>
                      <div><small>Total</small><b>{money(getPurchaseTotal(purchase))}</b></div>
                      <div><small>Proveedor</small><b>{getSupplierLabel(purchase)}</b></div>
                      <div><small>Ubicación</small><b>{getStockLocationLabel(purchase.stockLocation || purchase.location)}</b></div>
                      <div><small>Creada</small><b>{fmtDate(String(purchase.createdAt))}</b></div>
                      <div><small>Actualizada</small><b>{purchase.updatedAt ? fmtDate(String(purchase.updatedAt)) : 'Sin dato'}</b></div>
                    </div>

                    <div className="subsection-title"><FileText size={14} /> Items comprados</div>
                    <div className="line-list">
                      {getPurchaseItems(purchase).length ? getPurchaseItems(purchase).map((item, index) => {
                        const qty = num(item.quantityKg) || num(item.quantity) || 1;
                        const cost = num(item.costPrice || item.purchasePrice || item.price);
                        const total = num(item.subtotal) || cost * qty;

                        return (
                          <div key={item.id || `${purchase.id}-item-${index}`} className="detail-line">
                            <div>
                              <b>{getItemName(item)}</b>
                              <small>{getItemSku(item) || 'SIN-SKU'} · {item.product?.category?.name || 'Sin categoría'}</small>
                            </div>
                            <small>{getItemQtyLabel(item)} · costo {money(cost)}</small>
                            <strong>{money(total)}</strong>
                          </div>
                        );
                      }) : <div className="muted-box">Sin items.</div>}
                    </div>
                  </article>
                )) : <div className="muted-box">No hay compras para mostrar.</div>}
              </div>
            </section>
          )}

          {tab === 'stock' && (
            <section className="detail-section card">
              <div className="detail-section-head">
                <b>Movimientos de stock</b>
                <span>{filteredMovements.length}</span>
              </div>

              <div className="line-list padded">
                {filteredMovements.length ? filteredMovements.map((movement) => (
                  <div key={movement.id} className="movement-line">
                    <span className={`badge ${getMovementBadgeClass(movement.type)}`}>{getMovementTypeLabel(movement.type)}</span>
                    <div>
                      <b>{movement.product?.name || 'Producto'}</b>
                      <small>ID: {movement.id}</small>
                      <small>{fmtDate(String(movement.createdAt))} · {getMovementQtyLabel(movement)}</small>
                      <small>{getStockLocationLabel(movement.from)} → {getStockLocationLabel(movement.to)}</small>
                      {movement.product?.sku && <small>SKU: {movement.product.sku}</small>}
                      {movement.reason && <small>Motivo: {movement.reason}</small>}
                      {movement.reference && <small>Referencia: {movement.reference}</small>}
                    </div>
                    <Warehouse size={16} />
                  </div>
                )) : <div className="muted-box">No hay movimientos de stock para mostrar.</div>}
              </div>
            </section>
          )}

          {tab === 'cuenta' && (
            <section className="detail-section card">
              <div className="detail-section-head">
                <b>Movimientos de cuenta corriente</b>
                <span>{accountMovements.length}</span>
              </div>

              <div className="line-list padded">
                {accountMovements.length ? accountMovements.map((movement, index) => (
                  <div key={movement.id || index} className="detail-line">
                    <div>
                      <b>{movement.type || 'Movimiento'}</b>
                      <small>{movement.client ? getClientLabel(movement.client) : 'Sin cliente'} · {fmtDate(String(movement.date || movement.createdAt))}</small>
                      {movement.description && <small>{movement.description}</small>}
                    </div>
                    <small>Saldo: {money(movement.previousBalance)} → {money(movement.newBalance)}</small>
                    <strong>{money(movement.amount)}</strong>
                  </div>
                )) : <div className="muted-box">No hay movimientos de cuenta corriente.</div>}
              </div>
            </section>
          )}

          {tab === 'remitos' && (
            <section className="detail-section card">
              <div className="detail-section-head">
                <b>Remitos emitidos</b>
                <span>{remitos.length}</span>
              </div>

              <div className="document-list">
                {remitos.length ? remitos.map((remito, index) => (
                  <article key={remito.id || index} className="document-card">
                    <div className="document-head">
                      <div>
                        <h3>Remito {remito.fullNumber || remito.number || `#${index + 1}`}</h3>
                        <p>ID: {remito.id || 'Sin ID'}</p>
                        <p>{fmtDate(String(remito.issueDate || remito.createdAt))} · Cliente: {remito.clientName || (remito.client ? getClientLabel(remito.client) : 'Sin cliente')}</p>
                      </div>

                      <div className="document-badges">
                        <span className={`badge ${getStatusBadgeClass(remito.status)}`}>{remito.status || 'SIN ESTADO'}</span>
                        <span className="badge badge-gray">PV {remito.pointOfSale || '-'}</span>
                      </div>
                    </div>

                    <div className="info-grid compact">
                      <div><small>CAI</small><b>{remito.cai || 'Sin CAI'}</b></div>
                      <div><small>Vto CAI</small><b>{remito.caiExpiresAt ? fmtDate(String(remito.caiExpiresAt)) : 'Sin dato'}</b></div>
                      <div><small>Transporte</small><b>{remito.transportName || 'Sin dato'}</b></div>
                      <div><small>Bultos</small><b>{remito.packagesCount ?? 'Sin dato'}</b></div>
                      <div><small>Valor declarado</small><b>{money(remito.declaredValue)}</b></div>
                      <div><small>PDF</small><b>{remito.pdfUrl ? 'Disponible' : 'Sin PDF'}</b></div>
                    </div>
                  </article>
                )) : <div className="muted-box">No hay remitos emitidos.</div>}
              </div>
            </section>
          )}
        </>
      )}

      <style jsx>{`
        .detail-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .detail-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
          gap: 10px;
          margin-bottom: 16px;
        }

        .detail-search,
        .detail-date-filter {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface);
          padding: 0 12px;
          min-height: 44px;
          color: var(--text3);
        }

        .detail-search input,
        .detail-date-filter input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          color: var(--text);
          font: inherit;
        }

        .seller-profile-card {
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          padding: 16px;
          margin-bottom: 16px;
        }

        .seller-profile-avatar {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: var(--surface2);
          color: var(--accent);
        }

        .seller-profile-card h2 {
          margin: 0 0 3px;
          font-size: 20px;
          font-weight: 950;
        }

        .seller-profile-card p {
          margin: 0 0 8px;
          color: var(--text3);
          font-size: 13px;
        }

        .seller-profile-badges,
        .document-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .detail-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .detail-stat-card {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .detail-stat-card > span {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--surface2);
          color: var(--accent);
          flex-shrink: 0;
        }

        .detail-money {
          color: var(--accent) !important;
        }

        .detail-tabs {
          display: flex;
          gap: 8px;
          padding: 10px;
          margin-bottom: 16px;
          overflow-x: auto;
        }

        .detail-tabs button {
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text3);
          border-radius: 999px;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        }

        .detail-tabs button.active {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }

        .detail-grid-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .detail-section {
          overflow: hidden;
        }

        .detail-section-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 14px;
          border-bottom: 1px solid var(--border);
        }

        .detail-section-head b {
          font-size: 14px;
          font-weight: 950;
        }

        .detail-section-head span {
          color: var(--text3);
          font-size: 12px;
          font-weight: 900;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding: 14px;
        }

        .info-grid.compact {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          padding: 0;
          margin-top: 12px;
        }

        .info-grid > div {
          border: 1px solid var(--border);
          background: var(--surface2);
          border-radius: 14px;
          padding: 10px;
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .info-grid small {
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .info-grid b {
          font-size: 12px;
          font-family: var(--mono);
          overflow-wrap: anywhere;
        }

        .simple-list,
        .document-list,
        .line-list {
          display: grid;
        }

        .simple-row,
        .product-summary-row,
        .detail-line,
        .movement-line {
          border-bottom: 1px solid var(--border);
          padding: 12px 14px;
          display: grid;
          gap: 10px;
          align-items: center;
        }

        .simple-row:last-child,
        .product-summary-row:last-child,
        .detail-line:last-child,
        .movement-line:last-child {
          border-bottom: none;
        }

        .simple-row {
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .simple-row span,
        .simple-row b,
        .detail-line b,
        .movement-line b,
        .product-summary-row b {
          font-size: 13px;
        }

        .simple-row b,
        .detail-line strong,
        .product-summary-row strong {
          font-family: var(--mono);
          color: var(--accent);
          white-space: nowrap;
        }

        .product-summary-row {
          grid-template-columns: 34px minmax(0, 1fr) auto;
        }

        .product-summary-row > span {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: var(--surface2);
          color: var(--accent);
        }

        .product-summary-row small,
        .detail-line small,
        .movement-line small,
        .document-head p {
          display: block;
          color: var(--text3);
          font-size: 11px;
          margin-top: 2px;
          line-height: 1.35;
        }

        .document-card {
          padding: 14px;
          border-bottom: 1px solid var(--border);
        }

        .document-card:last-child {
          border-bottom: none;
        }

        .document-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .document-head h3 {
          margin: 0 0 3px;
          font-size: 15px;
          font-weight: 950;
        }

        .document-head p {
          margin: 0;
        }

        .subsection-title {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 14px 0 8px;
          color: var(--text3);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .line-list {
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          background: var(--surface2);
        }

        .line-list.padded {
          border: none;
          border-radius: 0;
          background: transparent;
        }

        .detail-line {
          grid-template-columns: minmax(0, 1fr) minmax(160px, auto) auto;
          background: var(--surface);
        }

        .movement-line {
          grid-template-columns: auto minmax(0, 1fr) 20px;
        }

        .muted-box {
          margin: 12px;
          border: 1px dashed var(--border);
          border-radius: 14px;
          padding: 16px;
          color: var(--text3);
          background: var(--surface2);
          text-align: center;
          font-size: 12px;
        }

        .detail-empty {
          padding: 34px 18px;
          text-align: center;
          color: var(--text3);
          display: grid;
          justify-items: center;
          gap: 8px;
        }

        .detail-empty b {
          color: var(--text);
        }

        .detail-empty p {
          margin: 0;
        }

        @media (max-width: 1100px) {
          .detail-stats-grid,
          .detail-grid-two {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .info-grid,
          .info-grid.compact {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .detail-toolbar,
          .detail-stats-grid,
          .detail-grid-two,
          .info-grid,
          .info-grid.compact {
            grid-template-columns: 1fr;
          }

          .seller-profile-card {
            grid-template-columns: 44px minmax(0, 1fr);
            padding: 14px;
          }

          .seller-profile-avatar {
            width: 44px;
            height: 44px;
            border-radius: 15px;
          }

          .document-head {
            display: grid;
          }

          .detail-line,
          .movement-line,
          .product-summary-row {
            grid-template-columns: 1fr;
          }

          .product-summary-row > span {
            display: none;
          }
        }
      `}</style>
    </AppLayout>
  );
}
    