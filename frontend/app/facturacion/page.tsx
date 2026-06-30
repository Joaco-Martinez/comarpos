'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { clientName } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { formatDateAR } from '@/lib/dateAR';
import {
  AlertTriangle,
  FileText,
  Download,
  RefreshCcw,
  Receipt,
  X,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MOBILE_PAGE_SIZE = 8;

interface Invoice {
  id: string;
  saleId: string;
  cae: string;
  caeVto: string;
  tipo: string;
  total: number;
  createdAt: string;
  sale?: {
    client?: {
      id?: string;
      name?: string;
      nombre?: string;
      apellido?: string;
      dni?: string;
    } | null;
    total: number;
    receiptType: string;
  };
}

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

function normalizeInvoices(data: unknown): Invoice[] {
  if (Array.isArray(data)) return data as Invoice[];

  if (
    data &&
    typeof data === 'object' &&
    'content' in data &&
    Array.isArray((data as { content?: unknown }).content)
  ) {
    return (data as { content: Invoice[] }).content;
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

async function fetchInvoices() {
  const r = await api.get('/factura-pdf/all');
  return normalizeInvoices(r.data);
}

function formatDate(value?: string | null) {
  return formatDateAR(value);
}

function shortCae(cae?: string | null) {
  const value = String(cae ?? '');
  if (!value) return '—';
  if (value.length <= 12) return value;

  return `${value.slice(0, 4)}…${value.slice(-6)}`;
}

function getInvoiceClient(inv: Invoice) {
  return inv.sale?.client ? clientName(inv.sale.client as never) : 'Consumidor final';
}

function getInvoiceType(inv: Invoice) {
  return inv.sale?.receiptType ?? inv.tipo ?? '—';
}

function getInvoiceTotal(inv: Invoice) {
  return inv.sale?.total ?? inv.total ?? 0;
}

export default function FacturacionPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState('');
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchInvoices();
      setInvoices(data);

      if (showSuccess) {
        toast.success('Facturas actualizadas');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchInvoices()
      .then((data) => {
        if (!alive) return;
        setInvoices(data);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;
        toast.error('Error al cargar facturas');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const mobileTotalPages = Math.max(1, Math.ceil(invoices.length / MOBILE_PAGE_SIZE));
  const safeMobilePage = Math.min(mobilePage, mobileTotalPages);
  const mobileStart = invoices.length ? (safeMobilePage - 1) * MOBILE_PAGE_SIZE + 1 : 0;
  const mobileEnd = Math.min(safeMobilePage * MOBILE_PAGE_SIZE, invoices.length);

  const mobileInvoices = useMemo(() => {
    const start = (safeMobilePage - 1) * MOBILE_PAGE_SIZE;
    return invoices.slice(start, start + MOBILE_PAGE_SIZE);
  }, [invoices, safeMobilePage]);

  const handleDownload = (saleId: string) => {
    toast.success('Abriendo PDF');
    window.open(`${API_URL}/factura-pdf/${saleId}/descargar`, '_blank');
  };

  const handleRegenerar = (saleId: string) => {
    setConfirmModal({
      title: 'Regenerar PDF',
      message:
        '¿Querés regenerar el PDF de esta factura? Se volverá a crear el comprobante con los datos actuales de la venta.',
      confirmText: 'Regenerar',
      danger: false,
      onConfirm: async () => {
        setRegenerating(saleId);

        const toastId = toast.loading('Regenerando PDF...');

        try {
          await api.post(`/factura-pdf/${saleId}/regenerar`);
          toast.success('PDF regenerado correctamente', { id: toastId });
          await load();
        } catch (e) {
          console.error(e);
          toast.error(getErrorMessage(e, 'Error al regenerar el PDF'), { id: toastId });
        } finally {
          setRegenerating('');
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AppLayout title="AFIP / Facturación" subtitle="Facturas electrónicas y comprobantes">
      <div className="card invoices-card">
        <div
          className="invoices-header"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Receipt size={18} style={{ color: '#06b6d4' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Facturas emitidas</span>
          <span className="badge badge-gray" style={{ marginLeft: 4 }}>
            {invoices.length}
          </span>
        </div>

        <div className="table-wrap invoices-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>CAE</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Vto. CAE</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: '#06b6d4',
                        }}
                      >
                        {inv.cae ?? '—'}
                      </span>
                    </td>

                    <td>
                      <span className="badge badge-blue">
                        {inv.sale?.receiptType ?? inv.tipo ?? '—'}
                      </span>
                    </td>

                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {inv.sale?.client ? clientName(inv.sale.client as never) : '—'}
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                      }}
                    >
                      {fmt(inv.sale?.total ?? inv.total ?? 0)}
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        color: 'var(--text2)',
                      }}
                    >
                      {formatDate(inv.caeVto)}
                    </td>

                    <td
                      style={{
                        fontSize: 12,
                        color: 'var(--text2)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {formatDate(inv.createdAt)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(inv.saleId)}
                        >
                          <Download size={12} /> PDF
                        </button>

                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRegenerar(inv.saleId)}
                          disabled={regenerating === inv.saleId}
                          title="Regenerar PDF"
                        >
                          <RefreshCcw
                            size={12}
                            style={{
                              animation:
                                regenerating === inv.saleId ? 'spin 0.7s linear infinite' : 'none',
                            }}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !invoices.length && (
            <div className="empty-state">
              <FileText size={36} />
              <p>Sin facturas emitidas todavía</p>
            </div>
          )}
        </div>

        <div className="invoices-mobile-list">
          {loading ? (
            <div className="invoices-mobile-loading">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton invoices-mobile-skeleton" />
              ))}
            </div>
          ) : (
            mobileInvoices.map((inv) => (
              <article className="invoice-mobile-card" key={`${inv.id}-mobile`}>
                <div className="invoice-mobile-top">
                  <div className="invoice-mobile-icon">
                    <Receipt size={15} />
                  </div>

                  <div className="invoice-mobile-main">
                    <div className="invoice-mobile-title-line">
                      <h3>{getInvoiceClient(inv)}</h3>
                      <span className="badge badge-blue">{getInvoiceType(inv)}</span>
                    </div>

                    <span className="invoice-mobile-cae">CAE {shortCae(inv.cae)}</span>
                  </div>
                </div>

                <div className="invoice-mobile-grid">
                  <div>
                    <small>Total</small>
                    <strong className="invoice-mobile-total">{fmt(getInvoiceTotal(inv))}</strong>
                  </div>

                  <div>
                    <small>Fecha</small>
                    <strong>{formatDate(inv.createdAt)}</strong>
                  </div>

                  <div>
                    <small>Vto. CAE</small>
                    <strong>{formatDate(inv.caeVto)}</strong>
                  </div>

                  <div>
                    <small>Venta</small>
                    <strong>#{String(inv.saleId ?? '').slice(-8) || '—'}</strong>
                  </div>
                </div>

                <div className="invoice-mobile-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(inv.saleId)}>
                    <Download size={13} /> PDF
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRegenerar(inv.saleId)}
                    disabled={regenerating === inv.saleId}
                  >
                    <RefreshCcw
                      size={13}
                      style={{
                        animation: regenerating === inv.saleId ? 'spin 0.7s linear infinite' : 'none',
                      }}
                    />
                    Regenerar
                  </button>
                </div>
              </article>
            ))
          )}

          {!loading && !invoices.length && (
            <div className="empty-state invoices-mobile-empty">
              <FileText size={36} />
              <p>Sin facturas emitidas todavía</p>
            </div>
          )}
        </div>

        {!loading && invoices.length > 0 && (
          <div className="invoices-mobile-pagination">
            <div>
              {mobileStart} - {mobileEnd} de {invoices.length} facturas
            </div>

            <div className="invoices-mobile-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobilePage === 1}
                onClick={() => setMobilePage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span>
                {safeMobilePage}/{mobileTotalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={safeMobilePage === mobileTotalPages}
                onClick={() => setMobilePage((prev) => Math.min(mobileTotalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal invoice-confirm-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .invoices-mobile-list,
        .invoices-mobile-pagination {
          display: none;
        }

        @media (max-width: 768px) {
          .invoices-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .invoices-header {
            padding: 13px 14px !important;
            gap: 8px !important;
          }

          .invoices-header span:first-of-type {
            font-size: 14px !important;
          }

          .invoices-desktop-table {
            display: none;
          }

          .invoices-mobile-list {
            display: grid;
            gap: 8px;
            padding: 10px;
          }

          .invoices-mobile-loading {
            display: grid;
            gap: 8px;
          }

          .invoices-mobile-skeleton {
            height: 112px;
            border-radius: 15px;
          }

          .invoice-mobile-card {
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface2);
            padding: 10px;
            display: grid;
            gap: 9px;
            min-width: 0;
          }

          .invoice-mobile-top {
            display: flex;
            align-items: flex-start;
            gap: 9px;
            min-width: 0;
          }

          .invoice-mobile-icon {
            width: 34px;
            height: 34px;
            border-radius: 11px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
            border: 1px solid color-mix(in srgb, #06b6d4 28%, var(--border));
            background: color-mix(in srgb, #06b6d4 10%, var(--surface));
            color: #06b6d4;
          }

          .invoice-mobile-main {
            display: grid;
            gap: 3px;
            min-width: 0;
            flex: 1;
          }

          .invoice-mobile-title-line {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
          }

          .invoice-mobile-title-line h3 {
            margin: 0;
            flex: 1;
            min-width: 0;
            color: var(--text);
            font-size: 13px;
            line-height: 1.2;
            font-weight: 900;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .invoice-mobile-title-line .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 3px 6px;
            max-width: 92px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .invoice-mobile-cae {
            color: #06b6d4;
            font-family: var(--mono);
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .invoice-mobile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
          }

          .invoice-mobile-grid > div {
            min-width: 0;
            border-radius: 12px;
            background: var(--surface);
            padding: 8px;
          }

          .invoice-mobile-grid small {
            display: block;
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 900;
            line-height: 1.15;
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .invoice-mobile-grid strong {
            display: block;
            color: var(--text);
            font-family: var(--mono);
            font-size: 11px;
            line-height: 1.15;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .invoice-mobile-total {
            color: var(--accent) !important;
            font-size: 12px !important;
          }

          .invoice-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .invoice-mobile-actions button {
            width: 100%;
            min-height: 32px;
            justify-content: center;
          }

          .invoices-mobile-pagination {
            display: grid;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid var(--border);
            background: var(--surface);
            color: var(--text3);
            font-size: 11px;
            font-weight: 900;
            text-align: center;
          }

          .invoices-mobile-pagination-actions {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 8px;
            align-items: center;
          }

          .invoices-mobile-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .invoices-mobile-pagination-actions span {
            color: var(--text2);
            font-family: var(--mono);
            font-size: 11px;
            font-weight: 900;
            min-width: 44px;
          }

          .invoices-mobile-empty {
            padding: 28px 10px;
          }

          .modal-overlay {
            align-items: flex-end !important;
            justify-content: center !important;
            padding: 0 !important;
          }

          .invoice-confirm-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            margin: 0 !important;
            border-radius: 22px 22px 0 0 !important;
            max-height: 82dvh;
          }

          .invoice-confirm-modal .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 9px !important;
          }

          .invoice-confirm-modal .modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .invoices-mobile-list {
            padding: 8px;
          }

          .invoice-mobile-card {
            padding: 9px;
            border-radius: 14px;
          }

          .invoice-mobile-icon {
            width: 32px;
            height: 32px;
          }

          .invoice-mobile-grid > div {
            padding: 7px;
          }

          .invoice-mobile-grid small {
            font-size: 9px;
          }

          .invoice-mobile-grid strong {
            font-size: 10.5px;
          }
        }
      `}</style>
    </AppLayout>
  );
}
