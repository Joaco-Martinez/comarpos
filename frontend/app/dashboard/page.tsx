'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Sale, Alert, Product } from '@/types';
import { clientName, normalizeArray, num } from '@/lib/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Package, AlertTriangle, DollarSign } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDateAR, formatShortDateAR, isSameDayAR, todayInputAR } from '@/lib/dateAR';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

type ProductWithMinStock = Product & {
  minStockDeposito?: number | string | null;
  minStockDepositoKg?: number | string | null;
};

type AlertWithProduct = Alert & {
  product?: ProductWithMinStock | null;
  productName?: string | null;
  productSku?: string | null;
  sku?: string | null;
  message?: string | null;

  stockLocal?: number | string | null;
  stockDeposito?: number | string | null;
  stockLocalKg?: number | string | null;
  stockDepositoKg?: number | string | null;

  minStock?: number | string | null;
  minStockDeposito?: number | string | null;
  minStockKg?: number | string | null;
  minStockDepositoKg?: number | string | null;

  saleUnit?: string | null;
};

type DashboardData = {
  sales: Sale[];
  alerts: AlertWithProduct[];
  products: ProductWithMinStock[];
  totals: { totalRevenue?: number; totalSales?: number } | null;
};

function getProductStockMayorista(product: ProductWithMinStock) {
  return product.saleUnit === 'KG'
    ? num((product as any).stockLocalKg)
    : num((product as any).stockLocal);
}

function getProductStockMinorista(product: ProductWithMinStock) {
  return product.saleUnit === 'KG'
    ? num((product as any).stockDepositoKg)
    : num((product as any).stockDeposito);
}

function getProductMinMayorista(product: ProductWithMinStock) {
  return product.saleUnit === 'KG'
    ? num((product as any).minStockKg)
    : num((product as any).minStock);
}

function getProductMinMinorista(product: ProductWithMinStock) {
  return product.saleUnit === 'KG'
    ? num((product as any).minStockDepositoKg)
    : num((product as any).minStockDeposito);
}

function isProductLowStock(product: ProductWithMinStock) {
  if ((product as any).isService) return false;
  if ((product as any).isActive === false) return false;

  const stockMayorista = getProductStockMayorista(product);
  const stockMinorista = getProductStockMinorista(product);

  const minMayorista = getProductMinMayorista(product);
  const minMinorista = getProductMinMinorista(product);

  const lowMayorista = minMayorista > 0 && stockMayorista <= minMayorista;
  const lowMinorista = minMinorista > 0 && stockMinorista <= minMinorista;

  return lowMayorista || lowMinorista;
}

function getAlertProductName(alert: AlertWithProduct) {
  return alert.productName ?? alert.product?.name ?? alert.message ?? 'Producto';
}

function getAlertUnit(alert: AlertWithProduct) {
  const unit = String(alert.saleUnit || alert.product?.saleUnit || 'UNIT').toUpperCase();
  return unit === 'KG' ? 'kg' : 'un.';
}

function getAlertStocks(alert: AlertWithProduct) {
  const product = alert.product;
  const unit = getAlertUnit(alert);
  const isKg = unit === 'kg';

  const stockMayorista = isKg
    ? num(alert.stockLocalKg ?? product?.stockLocalKg)
    : num(alert.stockLocal ?? product?.stockLocal);

  const stockMinorista = isKg
    ? num(alert.stockDepositoKg ?? product?.stockDepositoKg)
    : num(alert.stockDeposito ?? product?.stockDeposito);

  const minMayorista = isKg
    ? num(alert.minStockKg ?? product?.minStockKg)
    : num(alert.minStock ?? product?.minStock);

  const minMinorista = isKg
    ? num(alert.minStockDepositoKg ?? product?.minStockDepositoKg)
    : num(alert.minStockDeposito ?? product?.minStockDeposito);

  const lowMayorista = minMayorista > 0 && stockMayorista <= minMayorista;
  const lowMinorista = minMinorista > 0 && stockMinorista <= minMinorista;

  return {
    unit,
    stockMayorista,
    stockMinorista,
    minMayorista,
    minMinorista,
    lowMayorista,
    lowMinorista,
  };
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [salesRes, alertsRes, productsRes, totalsRes] = await Promise.allSettled([
    api.get('/sales'),
    api.get('/alerts'),
    api.get('/products'),
    api.get('/product-stats/totals'),
  ]);

  const sales =
    salesRes.status === 'fulfilled'
      ? normalizeArray<Sale>(salesRes.value.data)
      : [];

  const alerts =
    alertsRes.status === 'fulfilled'
      ? normalizeArray<AlertWithProduct>(alertsRes.value.data)
      : [];

  const products =
    productsRes.status === 'fulfilled'
      ? normalizeArray<ProductWithMinStock>(productsRes.value.data)
      : [];

  const totals =
    totalsRes.status === 'fulfilled'
      ? totalsRes.value.data.content ?? totalsRes.value.data
      : null;

  return {
    sales,
    alerts,
    products,
    totals,
  };
}

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [alerts, setAlerts] = useState<AlertWithProduct[]>([]);
  const [products, setProducts] = useState<ProductWithMinStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<{ totalRevenue?: number; totalSales?: number } | null>(null);

  useEffect(() => {
    let alive = true;

    fetchDashboardData()
      .then((data) => {
        if (!alive) return;

        setSales(data.sales);
        setAlerts(data.alerts);
        setProducts(data.products);
        setTotals(data.totals);

        const hasPartialError =
          data.sales.length === 0 &&
          data.alerts.length === 0 &&
          data.products.length === 0 &&
          !data.totals;

        if (hasPartialError) {
          toast.error('No se pudieron cargar los datos del dashboard');
        }
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error('Error al cargar el dashboard');
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const salesByDay = (() => {
    const map: Record<string, number> = {};

    (Array.isArray(sales) ? sales : []).forEach((s) => {
      if (s.status === 'COMPLETED') {
        const d = formatShortDateAR(s.createdAt);

        map[d] = (map[d] || 0) + (s.total || 0);
      }
    });

    return Object.entries(map)
      .slice(-14)
      .map(([date, total]) => ({ date, total }));
  })();

  const todaySales = (Array.isArray(sales) ? sales : []).filter((s) => {
    const today = todayInputAR();
    return isSameDayAR(s.createdAt, today) && s.status === 'COMPLETED';
  });

  const todayRevenue = todaySales.reduce((a, s) => a + (s.total || 0), 0);

  const lowStock = (Array.isArray(products) ? products : []).filter(isProductLowStock).length;

  return (
    <AppLayout title="Dashboard" subtitle="Resumen general">
      {loading ? (
        <div
          className="dashboard-loading-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      ) : (
        <>
          <div
            className="dashboard-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
              marginBottom: 28,
            }}
          >
            <StatCard
              icon={<DollarSign size={18} />}
              label="Ventas hoy"
              value={fmt(todayRevenue)}
              sub={`${todaySales.length} transacciones`}
              color="var(--accent)"
            />

            <StatCard
              icon={<ShoppingCart size={18} />}
              label="Total ventas"
              value={String(
                totals?.totalSales ??
                  (Array.isArray(sales) ? sales : []).filter((s) => s.status === 'COMPLETED')
                    .length
              )}
              sub="Completadas"
              color="var(--accent2)"
            />

            <StatCard
              icon={<Package size={18} />}
              label="Productos"
              value={String((Array.isArray(products) ? products : []).length)}
              sub={`${lowStock} bajo stock`}
              color="#a78bfa"
            />

            <StatCard
              icon={<AlertTriangle size={18} />}
              label="Alertas"
              value={String(alerts.length)}
              sub="Stock crítico"
              color={alerts.length > 0 ? 'var(--danger)' : 'var(--text3)'}
            />
          </div>

          <div
            className="dashboard-main-grid"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}
          >
            <div className="card dashboard-chart-card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div className="section-title dashboard-section-title" style={{ fontSize: 15 }}>
                  Ingresos — últimos 14 días
                </div>
              </div>

              {salesByDay.length > 0 ? (
                <div className="dashboard-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesByDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{
                          fill: 'var(--text3)',
                          fontSize: 11,
                          fontFamily: 'var(--mono)',
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        tick={{
                          fill: 'var(--text3)',
                          fontSize: 10,
                          fontFamily: 'var(--mono)',
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />

                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                        }}
                        labelStyle={{ color: 'var(--text2)' }}
                        formatter={(v: unknown) => [fmt(Number(v)), 'Total']}
                      />

                      <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div
                  className="empty-state dashboard-empty-chart"
                  style={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <TrendingUp size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                  <p>Sin datos de ventas todavía</p>
                </div>
              )}
            </div>

            <div className="card dashboard-alerts-card" style={{ padding: 24 }}>
              <div
                className="dashboard-card-header"
                style={{
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div className="section-title dashboard-section-title" style={{ fontSize: 15 }}>
                  Alertas de stock
                </div>

                <Link
                  href="/alertas"
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  Ver todas
                </Link>
              </div>

              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
                  <AlertTriangle size={28} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 13 }}>Sin alertas activas</p>
                </div>
              ) : (
                <div className="dashboard-alerts-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alerts.slice(0, 6).map((a) => {
                    const alertStock = getAlertStocks(a);

                    return (
                      <div
                        key={a.id}
                        className="dashboard-alert-item"
                        style={{
                          background: 'var(--surface2)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'grid',
                          gap: 7,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {getAlertProductName(a)}
                        </span>

                        <div className="dashboard-alert-stock-row">
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 11,
                              color: alertStock.lowMayorista ? 'var(--danger)' : 'var(--text3)',
                            }}
                          >
                            May: {alertStock.stockMayorista}/{alertStock.minMayorista} {alertStock.unit}
                          </span>

                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 11,
                              color: alertStock.lowMinorista ? 'var(--danger)' : 'var(--text3)',
                            }}
                          >
                            Min: {alertStock.stockMinorista}/{alertStock.minMinorista} {alertStock.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card dashboard-sales-card" style={{ marginTop: 16, padding: 24 }}>
            <div
              className="dashboard-card-header"
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div className="section-title dashboard-section-title" style={{ fontSize: 15 }}>
                Ventas recientes
              </div>

              <Link
                href="/ventas"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
              >
                Ver historial
              </Link>
            </div>

            <div className="table-wrap dashboard-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {(Array.isArray(sales) ? sales : []).slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            color: 'var(--text3)',
                          }}
                        >
                          #{s.id.slice(-6)}
                        </span>
                      </td>

                      <td style={{ color: 'var(--text2)', fontSize: 13 }}>
                        {formatDateAR(s.createdAt)}
                      </td>

                      <td style={{ fontSize: 13 }}>{clientName(s.client)}</td>

                      <td>
                        <span className="badge badge-gray">{s.paymentMethod}</span>
                      </td>

                      <td
                        style={{
                          fontFamily: 'var(--mono)',
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}
                      >
                        {fmt(s.total)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            s.status === 'COMPLETED'
                              ? 'badge-green'
                              : s.status === 'PENDING'
                                ? 'badge-yellow'
                                : 'badge-red'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!sales || !sales.length) && (
                <div className="empty-state">
                  <p>Sin ventas registradas</p>
                </div>
              )}
            </div>

            <div className="dashboard-mobile-sales">
              {(Array.isArray(sales) ? sales : []).slice(0, 8).map((s) => (
                <div className="dashboard-mobile-sale" key={s.id}>
                  <div className="dashboard-mobile-sale-head">
                    <div>
                      <strong>#{s.id.slice(-6)}</strong>
                      <span>{formatDateAR(s.createdAt)}</span>
                    </div>

                    <span
                      className={`badge ${
                        s.status === 'COMPLETED'
                          ? 'badge-green'
                          : s.status === 'PENDING'
                            ? 'badge-yellow'
                            : 'badge-red'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="dashboard-mobile-sale-body">
                    <div>
                      <small>Cliente</small>
                      <b>{clientName(s.client)}</b>
                    </div>

                    <div>
                      <small>Método</small>
                      <span className="badge badge-gray">{s.paymentMethod}</span>
                    </div>

                    <div>
                      <small>Total</small>
                      <b className="dashboard-mobile-total">{fmt(s.total)}</b>
                    </div>
                  </div>
                </div>
              ))}

              {(!sales || !sales.length) && (
                <div className="empty-state">
                  <p>Sin ventas registradas</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .dashboard-mobile-sales {
          display: none;
        }

        .dashboard-alert-stock-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .dashboard-alert-stock-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .dashboard-loading-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .dashboard-stats-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 16px !important;
          }

          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .dashboard-chart-card,
          .dashboard-alerts-card,
          .dashboard-sales-card {
            padding: 14px !important;
            border-radius: 18px;
            overflow: hidden;
          }

          .dashboard-section-title {
            font-size: 14px !important;
          }

          .dashboard-chart-card > div:first-child {
            margin-bottom: 12px !important;
          }

          .dashboard-chart-wrap {
            width: 100%;
            height: 220px;
            overflow: hidden;
          }

          .dashboard-empty-chart {
            height: 180px !important;
          }

          .dashboard-card-header {
            gap: 12px;
            align-items: flex-start !important;
          }

          .dashboard-card-header a {
            flex-shrink: 0;
            white-space: nowrap;
          }

          .dashboard-alerts-card {
            min-width: 0;
          }

          .dashboard-alerts-list {
            gap: 10px !important;
          }

          .dashboard-alert-item {
            align-items: stretch !important;
            gap: 8px;
            border-radius: 12px !important;
            padding: 10px !important;
          }

          .dashboard-alert-item span:first-child {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .dashboard-alert-stock-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .dashboard-desktop-table {
            display: none;
          }

          .dashboard-mobile-sales {
            display: grid;
            gap: 10px;
          }

          .dashboard-mobile-sale {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 12px;
            background: var(--surface);
            display: grid;
            gap: 12px;
            min-width: 0;
          }

          .dashboard-mobile-sale-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
          }

          .dashboard-mobile-sale-head > div {
            display: grid;
            gap: 3px;
            min-width: 0;
          }

          .dashboard-mobile-sale-head strong {
            font-family: var(--mono);
            font-size: 13px;
            color: var(--text);
          }

          .dashboard-mobile-sale-head span:not(.badge) {
            font-size: 11px;
            color: var(--text3);
          }

          .dashboard-mobile-sale-body {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .dashboard-mobile-sale-body > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
            min-width: 0;
          }

          .dashboard-mobile-sale-body small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 700;
          }

          .dashboard-mobile-sale-body b {
            font-size: 12px;
            text-align: right;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 190px;
          }

          .dashboard-mobile-total {
            font-family: var(--mono);
            color: var(--accent);
          }
        }

        @media (max-width: 420px) {
          .dashboard-chart-card,
          .dashboard-alerts-card,
          .dashboard-sales-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .dashboard-card-header {
            flex-direction: column;
          }

          .dashboard-alert-item {
            flex-direction: column;
          }

          .dashboard-alert-item span:first-child {
            white-space: normal;
          }

          .dashboard-alert-stock-row {
            grid-template-columns: 1fr;
          }

          .dashboard-mobile-sale {
            border-radius: 14px;
            padding: 10px;
          }

          .dashboard-mobile-sale-head {
            flex-direction: column;
            align-items: stretch;
          }

          .dashboard-mobile-sale-head .badge {
            width: fit-content;
          }

          .dashboard-mobile-sale-body > div {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .dashboard-mobile-sale-body b {
            text-align: left;
            max-width: 100%;
          }
        }
      `}</style>
    </AppLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </div>
      </div>

      <div className="stat-value" style={{ color }}>
        {value}
      </div>

      <div className="stat-label">{label}</div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text3)',
          fontFamily: 'var(--mono)',
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    </div>
  );
}