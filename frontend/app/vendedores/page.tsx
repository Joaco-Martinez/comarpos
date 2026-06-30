/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { normalizeArray } from '@/lib/helpers';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

const PAGE_SIZE = 10;

type UserView = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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

function toInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeResponseArray<T>(data: unknown): T[] {
  return normalizeArray<T>(
    (data as any)?.items ??
      (data as any)?.users ??
      (data as any)?.data ??
      (data as any)?.results ??
      (data as any)?.rows ??
      data
  );
}

function isSellerRole(role?: string | null) {
  const value = String(role ?? '').toUpperCase();
  return value === 'ADMIN' || value === 'EMPLEADO' || value === 'CONTADOR';
}

function getRoleBadgeClass(role?: string | null) {
  const value = String(role ?? '').toUpperCase();

  if (value === 'ADMIN') return 'badge-green';
  if (value === 'EMPLEADO') return 'badge-yellow';
  if (value === 'CONTADOR') return 'badge-gray';

  return 'badge-gray';
}

function getUserName(user: UserView) {
  return user.name || user.email || 'Usuario sin nombre';
}

export default function VendedoresPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserView[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(toInputDate());
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async (showSuccess = false) => {
    setLoading(true);

    try {
      const response = await api.get('/users');
      const loadedUsers = normalizeResponseArray<UserView>(response.data).filter((user) =>
        isSellerRole(user.role)
      );

      setUsers(loadedUsers);

      if (showSuccess) toast.success('Usuarios actualizados');
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, 'No se pudieron cargar los usuarios'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      [user.name, user.email, user.role]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(q))
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function openDetail(userId: string) {
    router.push(`/vendedores/${userId}?date=${date}`);
  }

  return (
    <AppLayout
      title="Vendedores"
      subtitle="Elegí un usuario para ver su actividad completa desde el endpoint único del backend"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={() => loadUsers(true)} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Actualizar
        </button>
      }
    >
      <div className="seller-toolbar">
        <div className="seller-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar vendedor por nombre, email o rol..."
          />
        </div>

        <label className="seller-date-filter">
          <CalendarDays size={14} />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <div className="seller-stats-grid">
        <div className="stat-card seller-stat-card">
          <span>
            <Users size={18} />
          </span>
          <div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Usuarios vendedores</div>
          </div>
        </div>

        <div className="stat-card seller-stat-card">
          <span>
            <ShieldCheck size={18} />
          </span>
          <div>
            <div className="stat-value">{users.filter((user) => user.isActive !== false).length}</div>
            <div className="stat-label">Activos</div>
          </div>
        </div>
      </div>

      <div className="card seller-card">
        {loading ? (
          <div style={{ padding: 18 }}>
            <div className="skeleton" style={{ height: 300 }} />
          </div>
        ) : filtered.length ? (
          <>
            <div className="seller-list">
              {paginated.map((user) => (
                <article key={user.id} className="seller-row">
                  <div className="seller-avatar">
                    <UserRound size={20} />
                  </div>

                  <div className="seller-main">
                    <div className="seller-head">
                      <div>
                        <h3>{getUserName(user)}</h3>
                        <p>{user.email || 'Sin email'}</p>
                      </div>

                      <div className="seller-badges">
                        <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                          {user.role || 'SIN ROL'}
                        </span>
                        <span className={`badge ${user.isActive === false ? 'badge-red' : 'badge-green'}`}>
                          {user.isActive === false ? 'Inactivo' : 'Activo'}
                        </span>
                      </div>
                    </div>

                    <p className="seller-hint">
                      El detalle se carga desde <b>/users/{user.id}/activity</b> con la fecha seleccionada.
                    </p>
                  </div>

                  <button className="btn btn-secondary btn-sm" onClick={() => openDetail(user.id)}>
                    <Eye size={14} />
                    Ver detalle
                  </button>
                </article>
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="seller-pagination">
                <span>
                  Página {currentPage} de {totalPages}
                </span>

                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>

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
          </>
        ) : (
          <div className="seller-empty">
            <Users size={40} />
            <b>Sin vendedores</b>
            <p>No encontré usuarios ADMIN, EMPLEADO o CONTADOR.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .seller-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px;
          gap: 10px;
          margin-bottom: 16px;
        }

        .seller-search,
        .seller-date-filter {
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

        .seller-search input,
        .seller-date-filter input {
          border: none;
          background: transparent;
          outline: none;
          width: 100%;
          color: var(--text);
          font: inherit;
        }

        .seller-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .seller-stat-card {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .seller-stat-card > span {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--surface2);
          color: var(--accent);
          flex-shrink: 0;
        }

        .seller-card {
          overflow: hidden;
        }

        .seller-list {
          display: grid;
        }

        .seller-row {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) auto;
          gap: 13px;
          align-items: center;
          padding: 14px;
          border-bottom: 1px solid var(--border);
        }

        .seller-row:last-child {
          border-bottom: none;
        }

        .seller-avatar {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          background: var(--surface2);
          display: grid;
          place-items: center;
          color: var(--accent);
        }

        .seller-main {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .seller-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .seller-head h3 {
          font-size: 14px;
          font-weight: 900;
          margin: 0 0 3px;
          color: var(--text);
        }

        .seller-head p,
        .seller-hint {
          margin: 0;
          color: var(--text3);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .seller-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .seller-pagination {
          border-top: 1px solid var(--border);
          padding: 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
        }

        .seller-pagination > div {
          display: flex;
          gap: 8px;
        }

        .seller-empty {
          padding: 34px 18px;
          text-align: center;
          color: var(--text3);
          display: grid;
          justify-items: center;
          gap: 8px;
        }

        .seller-empty b {
          color: var(--text);
        }

        .seller-empty p {
          margin: 0;
        }

        @media (max-width: 768px) {
          .seller-toolbar,
          .seller-stats-grid {
            grid-template-columns: 1fr;
          }

          .seller-row {
            grid-template-columns: 38px minmax(0, 1fr);
          }

          .seller-row > button {
            grid-column: 1 / -1;
            width: 100%;
            justify-content: center;
          }

          .seller-avatar {
            width: 38px;
            height: 38px;
            border-radius: 14px;
          }

          .seller-head {
            display: grid;
          }

          .seller-badges {
            justify-content: flex-start;
          }

          .seller-pagination {
            display: grid;
            text-align: center;
          }

          .seller-pagination > div {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </AppLayout>
  );
}
