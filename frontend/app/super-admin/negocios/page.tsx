'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { Business } from '@/types';
import { Plus, CheckCircle2, PauseCircle, Wallet, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return (value as { content: T[] }).content;
  }

  return [];
}

const PLAN_LABEL: Record<string, string> = {
  BASICO: 'Básico',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
};

const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'Prueba',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin definir';
  try {
    return new Date(value).toLocaleDateString('es-AR');
  } catch {
    return 'Sin definir';
  }
}

export default function SuperAdminNegociosPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/super-admin/businesses');
      setBusinesses(normalizeArray<Business>(data));
    } catch {
      toast.error('No se pudieron cargar los negocios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSuspend = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/super-admin/businesses/${id}/suspend`);
      toast.success('Negocio suspendido.');
      await load();
    } catch {
      toast.error('No se pudo suspender el negocio.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/super-admin/businesses/${id}/activate`);
      toast.success('Negocio activado.');
      await load();
    } catch {
      toast.error('No se pudo activar el negocio.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkPayment = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/super-admin/businesses/${id}/mark-payment`);
      toast.success('Pago registrado, vencimiento actualizado.');
      await load();
    } catch {
      toast.error('No se pudo registrar el pago.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="sa-page">
      <div className="sa-header">
        <div>
          <h1>Negocios</h1>
          <p>Gestioná los negocios clientes de la plataforma ComarPOS.</p>
        </div>

        <div className="sa-header-actions">
          <button type="button" className="sa-btn-secondary" onClick={() => load()}>
            <RefreshCw size={16} />
            Actualizar
          </button>

          <Link href="/super-admin/negocios/nuevo" className="sa-btn-primary">
            <Plus size={16} />
            Nuevo negocio
          </Link>
        </div>
      </div>

      <div className="sa-table-wrap">
        {loading ? (
          <div className="sa-empty">Cargando negocios...</div>
        ) : businesses.length === 0 ? (
          <div className="sa-empty">Todavía no hay negocios cargados.</div>
        ) : (
          <table className="sa-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Subdominio</th>
                <th>Plan</th>
                <th>Estado</th>
                <th>Próximo vencimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="sa-business-name">{b.name}</div>
                    <div className="sa-business-meta">{b.cuit || 'Sin CUIT'}</div>
                  </td>
                  <td>{b.subdomain}</td>
                  <td>{PLAN_LABEL[b.plan] || b.plan}</td>
                  <td>
                    <span className={`sa-status sa-status-${b.status.toLowerCase()}`}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                  </td>
                  <td>{formatDate(b.proximoVencimiento)}</td>
                  <td>
                    <div className="sa-row-actions">
                      {b.status === 'SUSPENDED' ? (
                        <button
                          type="button"
                          className="sa-icon-btn"
                          disabled={actionLoadingId === b.id}
                          onClick={() => handleActivate(b.id)}
                          title="Activar negocio"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="sa-icon-btn"
                          disabled={actionLoadingId === b.id}
                          onClick={() => handleSuspend(b.id)}
                          title="Suspender negocio"
                        >
                          <PauseCircle size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="sa-icon-btn"
                        disabled={actionLoadingId === b.id}
                        onClick={() => handleMarkPayment(b.id)}
                        title="Marcar pago recibido este mes"
                      >
                        <Wallet size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .sa-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sa-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .sa-header h1 {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .sa-header p {
          margin: 4px 0 0;
          color: var(--text3);
          font-size: 14px;
        }

        .sa-header-actions {
          display: flex;
          gap: 10px;
        }

        .sa-btn-primary,
        .sa-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          border: 1px solid transparent;
        }

        .sa-btn-primary {
          background: var(--accent);
          color: #fff;
        }

        .sa-btn-secondary {
          background: var(--surface);
          border-color: var(--border);
          color: var(--text2);
        }

        .sa-table-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .sa-empty {
          padding: 40px;
          text-align: center;
          color: var(--text3);
        }

        .sa-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .sa-table th {
          text-align: left;
          padding: 12px 16px;
          background: var(--surface2);
          color: var(--text3);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--border);
        }

        .sa-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          vertical-align: middle;
        }

        .sa-table tr:last-child td {
          border-bottom: none;
        }

        .sa-business-name {
          font-weight: 600;
        }

        .sa-business-meta {
          color: var(--text3);
          font-size: 12px;
        }

        .sa-status {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .sa-status-active {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .sa-status-trial {
          background: rgba(37, 99, 235, 0.12);
          color: var(--accent2);
        }

        .sa-status-suspended {
          background: rgba(220, 38, 38, 0.12);
          color: var(--danger);
        }

        .sa-row-actions {
          display: flex;
          gap: 6px;
        }

        .sa-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          cursor: pointer;
        }

        .sa-icon-btn:hover {
          background: var(--surface3);
        }

        .sa-icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
