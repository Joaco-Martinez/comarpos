'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Alert, Product } from '@/types';
import { AlertTriangle, Bell, RefreshCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { num } from '@/lib/helpers';
import { formatDateAR } from '@/lib/dateAR';

type ProductWithMinStock = Product & {
  minStockDeposito?: number | string | null;
  minStockDepositoKg?: number | string | null;
};

type AlertExtra = Alert & {
  product?: ProductWithMinStock | null;
  productName?: string | null;
  productSku?: string | null;
  sku?: string | null;
  message?: string | null;
  title?: string | null;

  stock?: number | string | null;
  currentStock?: number | string | null;

  stockLocal?: number | string | null;
  stockDeposito?: number | string | null;
  stockLocalKg?: number | string | null;
  stockDepositoKg?: number | string | null;

  minStock?: number | string | null;
  minStockDeposito?: number | string | null;
  minStockKg?: number | string | null;
  minStockDepositoKg?: number | string | null;

  location?: string | null;
  saleUnit?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type AlertView = {
  id: string;
  productName: string;
  sku: string;
  date: string;
  unit: string;

  localStock: number;
  depositoStock: number;

  minStockLocal: number;
  minStockDeposito: number;

  lowLocal: boolean;
  lowDeposito: boolean;

  message: string;
};

function normalizeAlerts(data: unknown): AlertExtra[] {
  if (Array.isArray(data)) return data as AlertExtra[];

  const obj = data as {
    content?: AlertExtra[];
    data?: AlertExtra[];
    alerts?: AlertExtra[];
    items?: AlertExtra[];
  };

  return obj?.content ?? obj?.data ?? obj?.alerts ?? obj?.items ?? [];
}

function formatAlertDate(value: unknown) {
  const formatted = formatDateAR(value ? String(value) : null);
  return formatted === '—' ? 'Sin fecha' : formatted;
}

function getAlertProductName(alert: AlertExtra) {
  return (
    alert.productName ||
    alert.product?.name ||
    alert.title ||
    alert.message?.replace(/^Alerta\s+de\s+stock\s*:*/i, '').trim() ||
    'Producto sin nombre'
  );
}

function getAlertSku(alert: AlertExtra) {
  return alert.productSku || alert.sku || alert.product?.sku || 'SIN-SKU';
}

function getAlertUnit(alert: AlertExtra) {
  const unit = String(alert.saleUnit || alert.product?.saleUnit || 'UNIT').toUpperCase();
  return unit === 'KG' ? 'kg' : 'un.';
}

function buildAlertView(alert: AlertExtra): AlertView {
  const unit = getAlertUnit(alert);
  const isKg = unit === 'kg';

  const localStock = isKg
    ? num(
        alert.stockLocalKg ??
          alert.product?.stockLocalKg ??
          alert.stockLocal ??
          alert.product?.stockLocal
      )
    : num(
        alert.stockLocal ??
          alert.product?.stockLocal ??
          alert.stock ??
          alert.currentStock
      );

  const depositoStock = isKg
    ? num(
        alert.stockDepositoKg ??
          alert.product?.stockDepositoKg ??
          alert.stockDeposito ??
          alert.product?.stockDeposito
      )
    : num(alert.stockDeposito ?? alert.product?.stockDeposito);

  const minStockLocal = isKg
    ? num(alert.minStockKg ?? alert.product?.minStockKg ?? 0)
    : num(alert.minStock ?? alert.product?.minStock ?? 0);

  const minStockDeposito = isKg
    ? num(
        alert.minStockDepositoKg ??
          alert.product?.minStockDepositoKg ??
          0
      )
    : num(
        alert.minStockDeposito ??
          alert.product?.minStockDeposito ??
          0
      );

  const lowLocal = minStockLocal > 0 && localStock <= minStockLocal;
  const lowDeposito =
    minStockDeposito > 0 && depositoStock <= minStockDeposito;

  const productName = getAlertProductName(alert);
  const sku = getAlertSku(alert);
  const date = formatAlertDate(alert.createdAt ?? alert.updatedAt);

  let message = alert.message || 'Revisar stock del producto.';

  if (lowLocal && lowDeposito) {
    message = 'Stock bajo en Mayorista y Minorista.';
  } else if (lowLocal) {
    message = 'Stock bajo en Mayorista.';
  } else if (lowDeposito) {
    message = 'Stock bajo en Minorista.';
  } else if (minStockLocal > 0 || minStockDeposito > 0) {
    message = 'El producto figura en alertas, pero el stock actual parece recuperado.';
  }

  return {
    id: String(alert.id ?? `${productName}-${sku}-${date}`),
    productName,
    sku,
    date,
    unit,
    localStock,
    depositoStock,
    minStockLocal,
    minStockDeposito,
    lowLocal,
    lowDeposito,
    message,
  };
}

function alertStatusLabel(alert: AlertView) {
  if (alert.lowLocal && alert.lowDeposito) return 'Crítico';
  if (alert.lowLocal || alert.lowDeposito) return 'Stock bajo';
  return 'Revisar';
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<AlertExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadAlerts = async (showSuccess = false) => {
    setLoading(true);

    try {
      const response = await api.get('/alerts');
      setAlerts(normalizeAlerts(response.data));

      if (showSuccess) {
        toast.success('Alertas actualizadas');
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar las alertas de stock');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get('/alerts')
      .then((response) => {
        if (!alive) return;
        setAlerts(normalizeAlerts(response.data));
      })
      .catch((error) => {
        console.error(error);
        if (!alive) return;
        toast.error('No se pudieron cargar las alertas de stock');
        setAlerts([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const alertViews = useMemo(() => alerts.map(buildAlertView), [alerts]);

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return alertViews;

    return alertViews.filter(
      (alert) =>
        alert.productName.toLowerCase().includes(q) ||
        alert.sku.toLowerCase().includes(q) ||
        alert.message.toLowerCase().includes(q)
    );
  }, [alertViews, search]);

  const criticalCount = alertViews.filter((a) => a.lowLocal && a.lowDeposito).length;
  const lowCount = alertViews.filter((a) => a.lowLocal || a.lowDeposito).length;

  return (
    <AppLayout
      title="Alertas de stock"
      subtitle="Productos con stock bajo el mínimo"
      actions={
        <button
          className="btn btn-secondary btn-sm alerts-refresh-btn"
          onClick={() => loadAlerts(true)}
          disabled={loading}
        >
          <RefreshCcw size={14} /> Actualizar
        </button>
      }
    >
      <div className="alerts-stats-grid">
        <div className="stat-card alerts-stat-card">
          <div className="stat-value">{alertViews.length}</div>
          <div className="stat-label">Alertas</div>
        </div>

        <div className="stat-card alerts-stat-card">
          <div
            className="stat-value"
            style={{ color: criticalCount > 0 ? 'var(--danger)' : 'var(--accent)' }}
          >
            {criticalCount}
          </div>
          <div className="stat-label">Críticas</div>
        </div>

        <div className="stat-card alerts-stat-card">
          <div
            className="stat-value"
            style={{ color: lowCount > 0 ? 'var(--warn)' : 'var(--accent)' }}
          >
            {lowCount}
          </div>
          <div className="stat-label">Stock bajo</div>
        </div>
      </div>

      <div className="alerts-toolbar">
        <div className="alerts-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto, SKU o alerta..."
          />
        </div>
      </div>

      {loading ? (
        <div className="alerts-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton alerts-skeleton" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="alerts-empty">
          <Bell size={46} />
          <h2>{search ? 'No encontré alertas' : 'Todo bajo control'}</h2>
          <p>
            {search
              ? 'Probá buscando por otro producto o SKU.'
              : 'No hay productos con stock crítico en este momento.'}
          </p>
        </div>
      ) : (
        <div className="alerts-list">
          {filteredAlerts.map((alert) => {
            const statusLabel = alertStatusLabel(alert);
            const isCritical = alert.lowLocal && alert.lowDeposito;

            return (
              <article className="alerts-item" key={alert.id}>
                <div className="alerts-item-icon">
                  <AlertTriangle size={19} />
                </div>

                <div className="alerts-item-content">
                  <div className="alerts-item-top">
                    <div className="alerts-product-title">
                      <b>{alert.productName}</b>
                      <span>
                        {alert.sku} · Alerta desde {alert.date}
                      </span>
                    </div>

                    <span className={`badge ${isCritical ? 'badge-red' : 'badge-yellow'}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <p>{alert.message}</p>

                  <div className="alerts-stock-grid">
                    <div className={alert.lowLocal ? 'is-low' : ''}>
                      <small>Stock Mayorista</small>
                      <strong>
                        {alert.localStock} {alert.unit}
                      </strong>
                    </div>

                    <div className={alert.lowLocal ? 'is-low' : ''}>
                      <small>Mín. Mayorista</small>
                      <strong>
                        {alert.minStockLocal} {alert.unit}
                      </strong>
                    </div>

                    <div className={alert.lowDeposito ? 'is-low' : ''}>
                      <small>Stock Minorista</small>
                      <strong>
                        {alert.depositoStock} {alert.unit}
                      </strong>
                    </div>

                    <div className={alert.lowDeposito ? 'is-low' : ''}>
                      <small>Mín. Minorista</small>
                      <strong>
                        {alert.minStockDeposito} {alert.unit}
                      </strong>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .alerts-refresh-btn {
          white-space: nowrap;
        }

        .alerts-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .alerts-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .alerts-search {
          width: min(460px, 100%);
          position: relative;
        }

        .alerts-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text3);
          pointer-events: none;
        }

        .alerts-search input {
          width: 100%;
          padding-left: 34px;
        }

        .alerts-list {
          display: grid;
          gap: 10px;
          width: 100%;
        }

        .alerts-skeleton {
          height: 88px;
          border-radius: 16px;
        }

        .alerts-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          min-width: 0;
          width: 100%;
          padding: 16px;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-left: 4px solid var(--danger);
          border-radius: 16px;
          background: var(--surface);
        }

        .alerts-item-icon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: var(--danger);
          background: rgba(239, 68, 68, 0.1);
          flex-shrink: 0;
        }

        .alerts-item-content {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .alerts-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }

        .alerts-product-title {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .alerts-product-title b {
          color: var(--text);
          font-size: 14px;
          line-height: 1.25;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alerts-product-title span {
          color: var(--text3);
          font-size: 11px;
          line-height: 1.2;
          font-family: var(--mono);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alerts-item p {
          margin: 0;
          color: var(--text2);
          font-size: 12px;
          line-height: 1.4;
        }

        .alerts-stock-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .alerts-stock-grid > div {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface2);
          padding: 9px 10px;
        }

        .alerts-stock-grid > div.is-low {
          border-color: rgba(239, 68, 68, 0.32);
          background: rgba(239, 68, 68, 0.08);
        }

        .alerts-stock-grid small {
          display: block;
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .alerts-stock-grid strong {
          display: block;
          font-family: var(--mono);
          color: var(--text);
          font-size: 13px;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .alerts-stock-grid .is-low strong {
          color: var(--danger);
        }

        .alerts-empty {
          width: 100%;
          text-align: center;
          padding: 78px 20px;
          border: 1px dashed var(--border);
          border-radius: 18px;
          background: var(--surface);
        }

        .alerts-empty svg {
          color: var(--accent);
          margin: 0 auto 16px;
          display: block;
        }

        .alerts-empty h2 {
          font-size: 20px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        .alerts-empty p {
          max-width: 340px;
          margin: 0 auto;
          color: var(--text2);
          font-size: 14px;
          line-height: 1.45;
        }

        @media (max-width: 768px) {
          .alerts-refresh-btn {
            width: 100%;
            justify-content: center;
          }

          .alerts-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin-bottom: 10px;
          }

          .alerts-stat-card {
            min-height: 58px;
            padding: 9px !important;
          }

          .alerts-stat-card :global(.stat-value),
          .alerts-stat-card .stat-value {
            font-size: 17px !important;
            line-height: 1.1;
          }

          .alerts-stat-card :global(.stat-label),
          .alerts-stat-card .stat-label {
            font-size: 9px !important;
            line-height: 1.15;
          }

          .alerts-toolbar {
            margin-bottom: 10px;
          }

          .alerts-search {
            width: 100%;
          }

          .alerts-search input {
            height: 36px;
            min-height: 36px;
            font-size: 12px;
          }

          .alerts-list {
            gap: 8px;
          }

          .alerts-skeleton {
            height: 118px;
            border-radius: 15px;
          }

          .alerts-item {
            gap: 9px;
            padding: 10px;
            border-radius: 15px;
            border-left-width: 3px;
          }

          .alerts-item-icon {
            width: 32px;
            height: 32px;
            border-radius: 10px;
          }

          .alerts-item-top {
            gap: 8px;
          }

          .alerts-product-title b {
            font-size: 13px;
          }

          .alerts-product-title span {
            font-size: 10px;
          }

          .alerts-item-top .badge {
            font-size: 9px;
            padding: 4px 7px;
            flex-shrink: 0;
          }

          .alerts-item p {
            font-size: 11px;
          }

          .alerts-stock-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
          }

          .alerts-stock-grid > div {
            padding: 7px 6px;
            border-radius: 10px;
          }

          .alerts-stock-grid small {
            font-size: 8.8px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .alerts-stock-grid strong {
            font-size: 10.5px;
          }

          .alerts-empty {
            padding: 56px 14px;
            border-radius: 16px;
          }

          .alerts-empty h2 {
            font-size: 17px;
          }

          .alerts-empty p {
            font-size: 13px;
          }
        }

        @media (max-width: 420px) {
          .alerts-item {
            display: grid;
            grid-template-columns: 32px minmax(0, 1fr);
          }

          .alerts-product-title b {
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
        }
      `}</style>
    </AppLayout>
  );
}