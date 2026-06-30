'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { AccountMovement, Client, PaymentMethod } from '@/types';
import { clientName, fmtDate, fmtMoney, normalizeArray, num } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { RefreshCcw, Search, Wallet, X } from 'lucide-react';

const methods: PaymentMethod[] = [
  'EFECTIVO',
  'TRANSFERENCIA',
  'TARJETA',
  'DEBITO',
  'CREDITO',
  'QR',
  'QR_MERCADOPAGO',
  'QR_NACION',
];

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

async function fetchAccountsData() {
  const [d, m] = await Promise.all([
    api.get('/accounts/debtors'),
    api.get('/accounts/movements'),
  ]);

  return {
    debtors: normalizeArray<Client>(d.data),
    movements: normalizeArray<AccountMovement>(m.data),
  };
}

export default function CuentasCorrientesPage() {
  const [debtors, setDebtors] = useState<Client[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [payment, setPayment] = useState({
    amount: '',
    method: 'EFECTIVO' as PaymentMethod,
    reference: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchAccountsData();

      setDebtors(data.debtors);
      setMovements(data.movements);

      if (showSuccess) {
        toast.success('Cuentas corrientes actualizadas');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar cuentas corrientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchAccountsData()
      .then((data) => {
        if (!alive) return;

        setDebtors(data.debtors);
        setMovements(data.movements);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;

        toast.error('Error al cargar cuentas corrientes');
      })
      .finally(() => {
        if (!alive) return;

        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const total = debtors.reduce((a, c) => a + num(c.currentBalance), 0);

  const filtered = debtors.filter(
    (c) =>
      !search ||
      clientName(c).toLowerCase().includes(search.toLowerCase()) ||
      c.dni?.includes(search)
  );

  const openPayment = (c: Client) => {
    setClient(c);
    setPayment({
      amount: '',
      method: 'EFECTIVO',
      reference: '',
      description: '',
    });
  };

  const closePaymentModal = () => {
    if (saving) return;

    setClient(null);
    setPayment({
      amount: '',
      method: 'EFECTIVO',
      reference: '',
      description: '',
    });
  };

  const savePayment = async () => {
    if (!client) return;

    const amount = num(payment.amount);

    if (!payment.amount || amount <= 0) {
      toast.error('Ingresá un importe válido');
      return;
    }

    setSaving(true);

    const toastId = toast.loading('Registrando abono...');

    try {
      await api.post(`/accounts/clients/${client.id}/payment`, {
        ...payment,
        amount,
      });

      setClient(null);
      setPayment({
        amount: '',
        method: 'EFECTIVO',
        reference: '',
        description: '',
      });

      toast.success('Abono registrado correctamente', { id: toastId });
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al registrar abono'), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout
      title="Cuentas corrientes"
      subtitle="Deudas, abonos e historial de saldos"
      actions={
        <button className="btn btn-secondary btn-sm cc-action-btn" onClick={() => load(true)} disabled={loading}>
          <RefreshCcw size={14} /> Actualizar
        </button>
      }
    >
      <div
        className="cc-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{debtors.length}</div>
          <div className="stat-label">Clientes con deuda</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-value"
            style={{ color: total > 0 ? 'var(--warn)' : 'var(--accent)' }}
          >
            {fmtMoney(total)}
          </div>
          <div className="stat-label">Total pendiente</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{movements.length}</div>
          <div className="stat-label">Movimientos</div>
        </div>
      </div>

      <div className="cc-search" style={{ position: 'relative', maxWidth: 460, marginBottom: 18 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text3)',
          }}
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente o DNI..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div className="card cc-card" style={{ marginBottom: 18 }}>
        <div
          className="cc-card-title"
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          Clientes con saldo pendiente
        </div>

        <div className="table-wrap cc-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 180 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI</th>
                  <th>Saldo</th>
                  <th>Límite</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{clientName(c)}</b>
                      <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                        {c.telefono ?? c.gmail ?? '—'}
                      </div>
                    </td>

                    <td style={{ fontFamily: 'var(--mono)' }}>{c.dni}</td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        fontWeight: 900,
                        color: 'var(--warn)',
                      }}
                    >
                      {fmtMoney(c.currentBalance)}
                    </td>

                    <td>{c.creditLimit ? fmtMoney(c.creditLimit) : 'Sin límite'}</td>

                    <td>
                      <span
                        className={`badge ${
                          c.isAccountEnabled === false ? 'badge-red' : 'badge-green'
                        }`}
                      >
                        {c.isAccountEnabled === false ? 'Bloqueada' : 'Habilitada'}
                      </span>
                    </td>

                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openPayment(c)}>
                        <Wallet size={13} /> Registrar abono
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>No hay deudas pendientes</p>
            </div>
          )}
        </div>

        <div className="cc-mobile-list">
          {loading ? (
            <div style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 180 }} />
            </div>
          ) : (
            filtered.map((c) => (
              <div className="cc-mobile-item" key={c.id}>
                <div className="cc-mobile-item-head">
                  <div>
                    <b>{clientName(c)}</b>
                    <span>{c.telefono ?? c.gmail ?? '—'}</span>
                  </div>

                  <span
                    className={`badge ${
                      c.isAccountEnabled === false ? 'badge-red' : 'badge-green'
                    }`}
                  >
                    {c.isAccountEnabled === false ? 'Bloqueada' : 'Habilitada'}
                  </span>
                </div>

                <div className="cc-mobile-data">
                  <div>
                    <small>DNI</small>
                    <strong>{c.dni || '—'}</strong>
                  </div>

                  <div>
                    <small>Saldo</small>
                    <strong className="cc-warn">{fmtMoney(c.currentBalance)}</strong>
                  </div>

                  <div>
                    <small>Límite</small>
                    <strong>{c.creditLimit ? fmtMoney(c.creditLimit) : 'Sin límite'}</strong>
                  </div>
                </div>

                <button className="btn btn-primary btn-sm cc-mobile-pay-btn" onClick={() => openPayment(c)}>
                  <Wallet size={13} /> Registrar abono
                </button>
              </div>
            ))
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>No hay deudas pendientes</p>
            </div>
          )}
        </div>
      </div>

      <div className="card cc-card">
        <div
          className="cc-card-title"
          style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            fontWeight: 800,
          }}
        >
          Últimos movimientos
        </div>

        <div className="table-wrap cc-desktop-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Saldo anterior</th>
                <th>Saldo nuevo</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {movements.slice(0, 60).map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.date)}</td>

                  <td>{m.client ? clientName(m.client) : '—'}</td>

                  <td>
                    <span
                      className={`badge ${
                        m.type === 'PAYMENT' || m.type === 'ADJUSTMENT_NEGATIVE'
                          ? 'badge-green'
                          : 'badge-yellow'
                      }`}
                    >
                      {m.type}
                    </span>
                  </td>

                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 800 }}>
                    {fmtMoney(m.amount)}
                  </td>

                  <td>{fmtMoney(m.previousBalance)}</td>

                  <td>{fmtMoney(m.newBalance)}</td>

                  <td>{m.description ?? m.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!movements.length && !loading && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>

        <div className="cc-mobile-list">
          {movements.slice(0, 60).map((m) => (
            <div className="cc-mobile-item" key={m.id}>
              <div className="cc-mobile-item-head">
                <div>
                  <b>{m.client ? clientName(m.client) : '—'}</b>
                  <span>{fmtDate(m.date)}</span>
                </div>

                <span
                  className={`badge ${
                    m.type === 'PAYMENT' || m.type === 'ADJUSTMENT_NEGATIVE'
                      ? 'badge-green'
                      : 'badge-yellow'
                  }`}
                >
                  {m.type}
                </span>
              </div>

              <div className="cc-mobile-data">
                <div>
                  <small>Monto</small>
                  <strong>{fmtMoney(m.amount)}</strong>
                </div>

                <div>
                  <small>Saldo anterior</small>
                  <strong>{fmtMoney(m.previousBalance)}</strong>
                </div>

                <div>
                  <small>Saldo nuevo</small>
                  <strong>{fmtMoney(m.newBalance)}</strong>
                </div>
              </div>

              <div className="cc-mobile-detail">
                <small>Detalle</small>
                <p>{m.description ?? m.reference ?? '—'}</p>
              </div>
            </div>
          ))}

          {!movements.length && !loading && (
            <div className="empty-state">
              <Wallet size={36} />
              <p>Sin movimientos</p>
            </div>
          )}
        </div>
      </div>

      {client && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closePaymentModal()}
        >
          <div className="modal cc-modal">
            <div className="modal-header">
              <b>Registrar abono</b>

              <button className="btn btn-ghost btn-sm" onClick={closePaymentModal} disabled={saving}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: 'var(--text2)', marginBottom: 14 }}>
                {clientName(client)} · saldo actual {fmtMoney(client.currentBalance)}
              </p>

              <div className="form-row cc-form-row">
                <div className="form-group">
                  <label className="form-label">Importe</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Método</label>
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        method: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Referencia</label>
                <input
                  value={payment.reference}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      reference: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={payment.description}
                  onChange={(e) =>
                    setPayment((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer cc-modal-footer">
              <button className="btn btn-secondary" onClick={closePaymentModal} disabled={saving}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={savePayment}
                disabled={saving || !payment.amount}
              >
                {saving ? <span className="spinner" /> : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cc-mobile-list {
          display: none;
        }

        @media (max-width: 768px) {
          .cc-action-btn {
            width: 100%;
            justify-content: center;
          }

          .cc-stats-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }

          .cc-search {
            max-width: none !important;
            width: 100% !important;
            margin-bottom: 14px !important;
          }

          .cc-search input {
            width: 100%;
          }

          .cc-card {
            overflow: hidden;
            border-radius: 18px;
          }

          .cc-card-title {
            padding: 14px !important;
            font-size: 14px;
          }

          .cc-desktop-table {
            display: none;
          }

          .cc-mobile-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .cc-mobile-item {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 12px;
            background: var(--surface);
            display: grid;
            gap: 12px;
            min-width: 0;
          }

          .cc-mobile-item-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
          }

          .cc-mobile-item-head > div {
            display: grid;
            gap: 3px;
            min-width: 0;
          }

          .cc-mobile-item-head b {
            font-size: 14px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .cc-mobile-item-head span:not(.badge) {
            color: var(--text3);
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 190px;
          }

          .cc-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .cc-mobile-data > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
            min-width: 0;
          }

          .cc-mobile-data small,
          .cc-mobile-detail small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 700;
          }

          .cc-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .cc-warn {
            color: var(--warn);
          }

          .cc-mobile-pay-btn {
            width: 100%;
            justify-content: center;
          }

          .cc-mobile-detail {
            display: grid;
            gap: 5px;
            border-radius: 12px;
            background: var(--bg);
            padding: 9px 10px;
          }

          .cc-mobile-detail p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.4;
            overflow-wrap: anywhere;
          }

          .cc-modal {
            width: calc(100vw - 24px);
            max-width: calc(100vw - 24px);
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .cc-form-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .cc-modal-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .cc-modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .cc-mobile-list {
            padding: 10px;
          }

          .cc-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .cc-mobile-item-head {
            flex-direction: column;
            align-items: stretch;
          }

          .cc-mobile-item-head span:not(.badge) {
            max-width: 100%;
          }

          .cc-mobile-item-head .badge {
            width: fit-content;
          }

          .cc-mobile-data > div {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .cc-mobile-data strong {
            text-align: left;
          }
        }
      `}</style>
    </AppLayout>
  );
}